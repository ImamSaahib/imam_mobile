import { test, expect } from '@playwright/test';
for (const mode of ['light', 'dark']) {
  test(`notification appears without stealing focus in ${mode}`, async ({ page }) => {
    await page.goto('/__ui');
    if (mode === 'dark') await page.getByRole('button', { name: 'Switch theme' }).click();
    const trigger = page.getByRole('button', { name: 'Show notification' });
    await trigger.click();
    await expect(page.getByText('Fixture saved', { exact: true })).toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.getByText('Fixture saved', { exact: true })).toBeHidden({ timeout: 15000 });
  });
}
