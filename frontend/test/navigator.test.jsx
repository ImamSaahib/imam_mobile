import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigatorPreview } from '../src/platform/ui/Navigator';

const groups = [
  { id: 'shop', label: 'Shop', expandable: true, modules: [{ id: 'inventory', label: 'Inventory' }, { id: 'customers', label: 'Customers' }] },
  { id: 'workspace', label: 'Workspace', modules: [{ id: 'dashboard', label: 'Dashboard' }] },
];
function setup() {
  const onSelect = vi.fn();
  return { onSelect, user: userEvent.setup(), ...render(<NavigatorPreview applicationName="Imam Mobile" groups={groups} selectedId="inventory" onSelect={onSelect} />) };
}
it('selects through callbacks and exposes current module', async () => {
  const { user, onSelect } = setup();
  expect(screen.getByRole('button', { name: 'Inventory' }).getAttribute('aria-current')).toBe('page');
  await user.click(screen.getByRole('button', { name: 'Customers' }));
  expect(onSelect).toHaveBeenCalledWith('customers');
});
it('filters modules and group names, reveals collapsed matches and restores collapse on Escape', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Shop' }));
  expect(screen.queryByRole('button', { name: 'Inventory' })).toBeNull();
  const search = screen.getByRole('textbox', { name: 'Quick search' });
  await user.type(search, 'inventory');
  expect(screen.getByRole('button', { name: 'Inventory' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Customers' })).toBeNull();
  await user.clear(search);
  await user.type(search, ' SHOP ');
  expect(screen.getByRole('button', { name: 'Customers' })).toBeTruthy();
  await user.keyboard('{Escape}');
  expect(search.value).toBe('');
  expect(screen.queryByRole('button', { name: 'Inventory' })).toBeNull();
  await user.type(search, 'missing');
  expect(screen.getByRole('status').textContent).toContain('No matching');
});
it('supports arrow keys and Home/End without selecting a module', async () => {
  const { user, onSelect } = setup();
  screen.getByRole('button', { name: 'Shop' }).focus();
  await user.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inventory' }));
  await user.keyboard('{End}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dashboard' }));
  await user.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Shop' }));
  await user.keyboard('{ArrowUp}{Home}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Shop' }));
  expect(onSelect).not.toHaveBeenCalled();
});
it('focuses search for both shortcuts and removes the listener on unmount', async () => {
  const { user, unmount } = setup();
  await user.keyboard('{Control>}k{/Control}');
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Quick search' }));
  document.activeElement.blur();
  await user.keyboard('{Meta>}k{/Meta}');
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Quick search' }));
  unmount();
  const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
