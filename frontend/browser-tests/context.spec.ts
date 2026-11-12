import { test, expect } from '@playwright/test';
test('context menu mouse and keyboard', async ({ page }) => {
 await page.goto('/__ui');
 await page.getByRole('button', { name: 'Edit fixture' }).click();
 const target = page.getByLabel('Configurable table');
 await target.click({ button: 'right' });
 await expect(page.getByRole('menuitem', { name: 'Inspect table' })).toBeVisible();
 await expect(page.getByRole('menuitem', { name: 'Remove table' })).toBeDisabled();
 await page.getByRole('menuitem', { name: 'Inspect table' }).click();
 await expect(page.getByLabel('Context action')).toHaveText('Table inspected');
 await target.focus(); await page.keyboard.press('Shift+F10');
 await expect(page.getByRole('menuitem', { name: 'Inspect table' })).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('menu')).toHaveCount(0);
 await expect(target).toBeFocused();
 await target.focus(); await page.keyboard.press('ContextMenu');
 await expect(page.getByRole('menuitem', { name: 'Inspect table' })).toBeVisible();
 await page.keyboard.press('Escape');
 await page.getByRole('button', { name: 'Lock fixture' }).click();
 await target.click({ button: 'right' });
 await expect(page.getByRole('menu')).toHaveCount(0);
});
test('context menu touch hold and movement cancellation', async ({ page }) => {
 await page.goto('/__ui');
 await page.getByRole('button', { name: 'Edit fixture' }).click();
 const target = page.getByLabel('Configurable table');
 await target.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 100, clientY: 300 }] });
 await expect(page.getByRole('menuitem', { name: 'Inspect table' })).toBeVisible();
 await target.dispatchEvent('touchend', { touches: [] });
 await page.keyboard.press('Escape');
 await target.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 100, clientY: 300 }] });
 await target.dispatchEvent('touchmove', { touches: [{ identifier: 1, clientX: 150, clientY: 300 }] });
 await page.waitForTimeout(600);
 await expect(page.getByRole('menu')).toHaveCount(0);
 await target.dispatchEvent('touchend', { touches: [] });
});

test('context menu preserves ordinary targets and closes when its origin disappears', async ({ page }) => {
 await page.goto('/__ui');
 await page.getByRole('button', { name: 'Edit fixture' }).click();
 await page.getByRole('heading', { name: 'Inventory', exact: true }).click({ button: 'right' });
 await expect(page.getByRole('menu')).toHaveCount(0);
 await page.getByRole('textbox', { name: 'Search Devices' }).click({ button: 'right' });
 await expect(page.getByRole('menu')).toHaveCount(0);
 const target = page.getByLabel('Configurable table');
 const size = page.viewportSize()!;
 await target.dispatchEvent('contextmenu', { clientX: size.width - 1, clientY: size.height - 1 });
 const menu = page.getByRole('menu', { name: 'Element actions' });
 await expect(menu).toBeVisible();
 await expect.poll(async () => {
   const box = await menu.boundingBox();
   return Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height);
 }).toBe(true);
 await target.evaluate(element => element.remove());
 await expect(menu).toHaveCount(0);
});
