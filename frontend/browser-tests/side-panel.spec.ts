import { test, expect } from '@playwright/test';
for (const mode of ['light', 'dark']) {
  test(`side panel dismissal and containment in ${mode}`, async ({ page }) => {
    await page.goto('/__ui');
    if (mode === 'dark') await page.getByRole('button', { name: 'Switch theme' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const trigger = page.getByRole('button', { name: 'Open side panel' });
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Fixture details' });
    await expect(panel).toBeVisible();
    await panel.getByRole('textbox', { name: 'Panel note' }).fill('Fixture note');
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await panel.getByRole('button', { name: 'Close panel' }).click();
    await expect(trigger).toBeFocused();
  });
}
