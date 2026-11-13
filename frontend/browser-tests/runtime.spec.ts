import { test, expect } from '@playwright/test';
const snapshot = { platform: { configSchemaVersion: 1 }, application: { id: 'app_shop', key: 'shop', name: 'Published Shop' }, shell: {
  menus: [{ id: 'menu', label: 'Business', display: 'section', modules: [
    { id: 'mod_stock', label: 'Stock', slug: 'stock', badge: null, pageId: 'page_stock', enabled: true },
    { id: 'mod_people', label: 'People', slug: 'people', badge: 'New', pageId: 'page_people', enabled: true },
    { id: 'mod_off', label: 'Disabled', slug: 'off', badge: null, pageId: 'page_stock', enabled: false },
  ] }], pages: [{ id: 'page_stock', title: 'Published stock', description: null }, { id: 'page_people', title: 'Published people', description: 'Customer directory' }],
} };
test('published shell navigation supports deep links and browser history', async ({ page }) => {
  await page.route('**/api/bootstrap', route => route.fulfill({ json: snapshot }));
  await page.goto('/__platform');
  await expect(page).toHaveURL(/\/app\/app_shop\/module\/mod_stock$/);
  await expect(page.getByRole('heading', { name: 'Published stock' })).toBeVisible();
  await page.getByRole('button', { name: 'People New' }).click();
  await expect(page.getByRole('heading', { name: 'Published people' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Published stock' })).toBeVisible();
  await page.goto('/app/app_shop/module/mod_off');
  await expect(page.getByRole('heading', { name: 'Page unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open existing application' })).toHaveAttribute('href', '/');
  await page.goto('/app/app_shop/module/missing');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
test('bootstrap failure is safe and retry loads the shell', async ({ page }) => {
  let fail = true;
  await page.route('**/api/bootstrap', route => fail ? route.fulfill({ status: 500, body: 'private server detail' }) : route.fulfill({ json: snapshot }));
  await page.goto('/__platform');
  await expect(page.getByRole('alert')).toHaveText('Could not load the application. Please try again.');
  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Published stock' })).toBeVisible();
});
