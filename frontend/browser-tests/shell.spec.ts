import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.abort());
});
for (const mode of ['light', 'dark']) {
  test(`desktop shell ${mode}: navigation, menus and screenshot`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/__ui');
    await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
    if (mode === 'dark') {
      await page.getByRole('button', { name: 'Super Menu' }).click();
      await page.getByRole('menuitem', { name: 'Use dark theme' }).click();
    }
    await expect(page.locator('.im-shell')).toHaveAttribute('data-mode', mode);
    await page.getByRole('button', { name: 'Imam Mobile', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Demo Workspace' }).click();
    await expect(page.getByRole('navigation', { name: 'Demo Workspace navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Customers' }).click();
    await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('textbox', { name: 'Quick search' })).toBeFocused();
    await page.keyboard.type('dashboard');
    await expect(page.getByRole('button', { name: 'Inventory', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await expect(page.locator('[aria-label="Reserved details panel"]')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`shell-${mode}.png`), fullPage: true });
    await testInfo.attach(`shell-${mode}`, { path: testInfo.outputPath(`shell-${mode}.png`), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
}
test('mobile drawer traps focus, closes, restores focus, and quick search opens it', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__ui');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Application navigation' });
  await expect(drawer).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    await expect.poll(() => drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Quick search' })).toBeFocused();
  await page.keyboard.type('customers');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Quick search' })).toHaveValue('');
  await page.getByRole('button', { name: 'Customers' }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('shell-mobile.png'), fullPage: true });
  await trigger.click();
  await page.screenshot({ path: testInfo.outputPath('shell-drawer.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Imam Mobile navigation' })).toBeVisible();
});

test('table controls remain usable in narrow and dark layouts', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/__ui');
  await expect(page.getByText('Showing 1–2 of 3')).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Search Devices' });
  await search.fill('Redmi');
  await expect(page.getByText('Showing 1–1 of 1')).toBeVisible();
  await search.fill('');
  await expect(page.getByText('Showing 1–2 of 3')).toBeVisible();
  const tableRegion = page.getByRole('region', { name: 'Devices table' });
  expect(await tableRegion.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Column settings' }).click();
  await page.getByRole('checkbox', { name: 'IMEI' }).uncheck();
  await page.getByRole('button', { name: 'Move Price earlier' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('columnheader', { name: 'IMEI' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Last', exact: true }).click();
  await expect(page.getByText('Showing 3–3 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'First', exact: true }).click();
  await expect(page.getByText('Showing 1–2 of 3')).toBeVisible();
  await tableRegion.evaluate(element => { element.scrollLeft = 0; });
  await page.screenshot({ path: testInfo.outputPath('table-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Super Menu' }).click();
  await page.getByRole('menuitem', { name: 'Use dark theme' }).click();
  await page.getByRole('button', { name: 'Price', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Price' })).toHaveAttribute('aria-sort', 'ascending');
  await expect(page.getByText('Showing 1–2 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Redmi 13C' }).click();
  await page.getByRole('menuitem', { name: 'Open record' }).click();
  await expect(page.getByText('Opened fixture: Redmi 13C')).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('table-dark.png'), fullPage: true, animations: 'disabled' });
});
