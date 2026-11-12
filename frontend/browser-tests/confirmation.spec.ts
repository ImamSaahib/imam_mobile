import { test, expect } from '@playwright/test';
test('confirmation dialog cancels, restores focus and confirms in dark mode', async ({ page }) => {
 await page.goto('/__ui');
 await page.getByRole('button', { name: 'Switch theme' }).click();
 const trigger = page.getByRole('button', { name: 'Destructive action' });
 await trigger.click();
 const dialog = page.getByRole('alertdialog', { name: 'Reset fixture?' });
 await expect(dialog).toBeVisible();
 await page.getByRole('button', { name: 'Cancel', exact: true }).click();
 await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
 await page.getByRole('button', { name: 'Primary action' }).click();
 await expect(page.getByLabel('Action count')).toHaveText('Actions: 1');
 await trigger.click();
 await page.getByRole('button', { name: 'Reset fixture', exact: true }).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByLabel('Action count')).toHaveText('Actions: 0');
});
