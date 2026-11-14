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
