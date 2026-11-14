import { test, expect } from '@playwright/test';
test('built platform preview loads within request budget and supports direct routes', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/bootstrap', route => route.fulfill({ json: {
    platform: { configSchemaVersion: 1 }, application: { id: 'app', key: 'shop', name: 'Preview Shop' },
    shell: { menus: [{ id: 'menu', label: 'Work', display: 'section', modules: [{ id: 'module', label: 'Records', slug: 'records', badge: null, pageId: 'page', enabled: true }] }], pages: [{ id: 'page', title: 'Published records', description: null, components: [
      { id: 'intro', type: 'heading', typeVersion: 1, config: { text: 'Opening hours' } },
      { id: 'future', type: 'heading', typeVersion: 2, config: { text: 'Future' } },
      { id: 'details', type: 'text', typeVersion: 1, config: { text: 'Saturday mornings' } },
    ] }] },
  } }));
  await page.goto('/__platform');
  await expect(page.getByRole('heading', { name: 'Published records' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Opening hours', level: 2 })).toBeVisible();
  await expect(page.getByText('This section is unavailable in this version.')).toBeVisible();
  await expect(page.getByText('Saturday mornings')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(requests.length, requests.join('\n')).toBeLessThanOrEqual(10);
  expect(requests.filter(url => url.endsWith('/api/bootstrap'))).toHaveLength(1);
  await expect(page.getByRole('link', { name: 'Open existing application' })).toHaveAttribute('href', '/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Published records' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('published inventory summary can retry a failed read', async ({ page }) => {
  await page.route('**/api/bootstrap', route => route.fulfill({ json: {
    platform: { configSchemaVersion: 1 }, application: { id: 'app', key: 'shop', name: 'Shop' },
    shell: { menus: [{ id: 'menu', label: 'Work', display: 'section', modules: [{ id: 'home', label: 'Home', slug: 'home', badge: null, pageId: 'dashboard', enabled: true }] }],
      pages: [{ id: 'dashboard', title: 'Dashboard', description: null, components: [{ type: 'summary', typeVersion: 1, config: {} }] }] },
  } }));
  let attempts = 0;
  await page.route('**/api/devices/summary', route => ++attempts === 1
    ? route.fulfill({ status: 503 }) : route.fulfill({ json: { total: 7, available: 5, sold: 2 } }));
  await page.goto('/__platform');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('region', { name: 'Inventory summary' }).locator('dd')).toHaveText(['7', '5', '2']);
});

test('published inventory list pages through the keyset read', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/bootstrap', route => route.fulfill({ json: {
    platform: { configSchemaVersion: 1 }, application: { id: 'app', key: 'shop', name: 'Shop' },
    shell: { menus: [{ id: 'menu', label: 'Work', display: 'section', modules: [{ id: 'stock', label: 'Inventory', slug: 'inventory', badge: null, pageId: 'inventory', enabled: true }] }],
      pages: [{ id: 'inventory', title: 'Inventory', description: null, components: [{ id: 'list', type: 'list', typeVersion: 1, config: { dataSourceId: 'ds-devices' } }] }],
      dataSources: [{ id: 'ds-devices', key: 'devices', label: 'Devices', tableName: 'mobile_devices', primaryKey: 'id' }] },
  } }));
  const row = (id: number, model: string) => ({ id, model, company: 'Samsung', imei: `3500000000${id}`, color: null, condition: 'Pack', status: 'Available', purchasePrice: 40000, salePrice: 0, purchaseDate: '2026-11-01', saleDate: '' });
  const afters: (string | null)[] = [];
  await page.route('**/api/devices/page**', route => {
    const after = new URL(route.request().url()).searchParams.get('after');
    afters.push(after);
    return route.fulfill({ json: after === '8' ? { items: [row(7, 'Galaxy A05')], nextCursor: null, total: 3 }
      : { items: [row(9, 'Galaxy A15'), row(8, 'Redmi 13C')], nextCursor: '8', total: 3 } });
  });
  await page.goto('/__platform');
  await expect(page.getByRole('status', { name: 'Result summary' })).toHaveText('Showing 1–2 of 3');
  await expect(page.getByRole('cell', { name: 'Galaxy A15', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Result summary' })).toHaveText('Showing 3–3 of 3');
  await expect(page.getByRole('cell', { name: 'Galaxy A05', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Result summary' })).toHaveText('Showing 1–2 of 3');
  expect(afters).toEqual([null, '8', null]);
  expect(errors).toEqual([]);
});

test('published inventory list opens a record in a side panel and restores focus', async ({ page }) => {
  await page.route('**/api/bootstrap', route => route.fulfill({ json: {
    platform: { configSchemaVersion: 1 }, application: { id: 'app', key: 'shop', name: 'Shop' },
    shell: { menus: [{ id: 'menu', label: 'Work', display: 'section', modules: [{ id: 'stock', label: 'Inventory', slug: 'inventory', badge: null, pageId: 'inventory', enabled: true }] }],
      pages: [{ id: 'inventory', title: 'Inventory', description: null, components: [{ id: 'list', type: 'list', typeVersion: 1, config: { dataSourceId: 'ds-devices' } }] }],
      dataSources: [{ id: 'ds-devices', key: 'devices', label: 'Devices', tableName: 'mobile_devices', primaryKey: 'id' }] },
  } }));
  let reads = 0;
  await page.route('**/api/devices/page**', route => { reads++; return route.fulfill({ json: { items: [
    { id: 4, model: 'Y1915', company: 'Vivo', imei: '860000000000000', color: 'Blue', condition: 'Used', status: 'Sold Out', purchasePrice: 500000, salePrice: 520000, purchaseDate: '2026-10-01', saleDate: '2026-10-20' },
  ], nextCursor: null, total: 1 } }); });
  await page.goto('/__platform');
  await expect(page.getByRole('cell', { name: 'Y1915', exact: true })).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Actions for Y1915' });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Open record' }).click();
  const panel = page.getByRole('dialog', { name: 'Y1915' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('520,000')).toBeVisible();
  await expect(panel.getByText('Blue')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(reads).toBe(1);
});
