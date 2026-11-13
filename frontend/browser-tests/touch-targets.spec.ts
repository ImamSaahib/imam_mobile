import { test, expect } from '@playwright/test';
test('mobile icon actions preserve both touch-target dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/__ui');
  await expect(page.getByText('Showing 1–2 of 3')).toBeVisible();
  for (const name of ['Refresh records', 'Column settings', 'Actions for Galaxy A15', 'Refresh']) {
    const button = page.getByRole('button', { name, exact: true });
    const box = await button.boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
