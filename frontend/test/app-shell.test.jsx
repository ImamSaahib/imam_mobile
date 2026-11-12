import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';

// All requests are fixtures; no test contacts a deployed Worker or D1.
const device = { id: 1, model: 'Fixture phone', company: 'Samsung', color: 'Blue',
  condition: 'Pack', status: 'Available', imei: '000000000000001', purchasePrice: 100,
  purchaseDate: '2026-01-01' };
const fixtures = {
  '/api/devices': [device], '/api/customers': [], '/api/customer-entries': [],
  '/api/sales': [], '/api/configuration': { configuration: null },
};
let unexpected;
beforeEach(() => {
  unexpected = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    const path = new URL(url).pathname;
    if (!(path in fixtures) || (options?.method && options.method !== 'GET')) {
      unexpected.push(path);
      throw new Error('Unexpected test request: ' + path);
    }
    return { ok: true, json: async () => structuredClone(fixtures[path]) };
  }));
});
afterEach(() => { vi.unstubAllGlobals(); expect(unexpected).toEqual([]); });

async function mount() {
  const view = render(<App />);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
  await screen.findByRole('heading', { name: 'Shop overview' });
  return view;
}

describe('legacy shell regression baseline', () => {
  it.each([{ ctrlKey: true }, { metaKey: true }])('focuses search for the supported shortcut %j', async modifiers => {
    await mount();
    const input = screen.getByRole('textbox', { name: 'Search Dashboard' });
    const event = new KeyboardEvent('keydown', { key: 'k', ...modifiers, cancelable: true });
    fireEvent(window, event);
    expect(document.activeElement).toBe(input);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps inventory navigation and record filtering working', async () => {
    const user = userEvent.setup();
    await mount();
    await user.click(screen.getByRole('button', { name: /^Inventory/ }));
    expect(await screen.findByText('Fixture phone')).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: 'Search Inventory' }), 'absent');
    expect(screen.queryByText('Fixture phone')).toBeNull();
    await user.clear(screen.getByRole('textbox', { name: 'Search Inventory' }));
    expect(screen.getByText('Fixture phone')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('removes its global shortcut listener when unmounted', async () => {
    const { unmount } = await mount();
    unmount();
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
  });
});
