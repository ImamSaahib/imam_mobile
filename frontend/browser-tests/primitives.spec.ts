import { test, expect } from '@playwright/test';

for (const mode of ['light', 'dark']) {
  test(`primitive states, tooltip and modal focus in ${mode}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/__ui');
    if (mode === 'dark') await page.getByRole('button', { name: 'Switch theme' }).click();
    await expect(page.getByText('Showing 1–2 of 3')).toBeVisible();
    const controls = page.getByRole('region', { name: 'Buttons' });
    await expect(controls.getByRole('button', { name: 'Disabled action' })).toBeDisabled();
    const refresh = controls.getByRole('button', { name: 'Refresh', exact: true });
    await refresh.hover();
    await expect(page.locator('.kumo-tooltip-popup')).toBeVisible();
    await expect(page.locator('.kumo-tooltip-popup')).toHaveText('Refresh');
    await refresh.focus();
    await expect(refresh).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`primitives-${mode}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Open side panel' }).click();
    const panel = page.getByRole('dialog', { name: 'Fixture details' });
    const note = panel.getByRole('textbox', { name: 'Panel note' });
    await note.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(panel.getByRole('button', { name: 'Close panel' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(note).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`panel-${mode}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open side panel' })).toBeFocused();
    await expect(page.getByRole('region', { name: 'Resource states' }).getByRole('alert')).toHaveText('Could not load records.');
  });
}
