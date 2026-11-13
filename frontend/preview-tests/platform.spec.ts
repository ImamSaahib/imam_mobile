import { test, expect } from '@playwright/test';
test('built platform preview loads within request budget and supports direct routes', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/bootstrap', route => route.fulfill({ json: {
    platform: { configSchemaVersion: 1 }, application: { id: 'app', key: 'shop', name: 'Preview Shop' },
    shell: { menus: [{ id: 'menu', label: 'Work', display: 'section', modules: [{ id: 'module', label: 'Records', slug: 'records', badge: null, pageId: 'page', enabled: true }] }], pages: [{ id: 'page', title: 'Published records', description: null }] },
  } }));
  await page.goto('/__platform');
  await expect(page.getByRole('heading', { name: 'Published records' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(requests.length, requests.join('\n')).toBeLessThanOrEqual(10);
  expect(requests.filter(url => url.endsWith('/api/bootstrap'))).toHaveLength(1);
  await expect(page.getByRole('link', { name: 'Open existing application' })).toHaveAttribute('href', '/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Published records' })).toBeVisible();
  expect(errors).toEqual([]);
});
