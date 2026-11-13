import { expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { parseNavigation, useBootstrap, loadBootstrap, BootstrapLimitError } from '../src/platform/navigation/bootstrap';
const fixture = () => ({ platform: { configSchemaVersion: 1 }, application: { id: 'app', key: 'shop', name: 'Shop' }, shell: {
  menus: [{ id: 'menu', label: 'Work', display: 'group', modules: [{ id: 'module', label: 'Records', slug: 'records', badge: null, pageId: 'page', enabled: true }] }],
  pages: [{ id: 'page', title: 'Records', description: null }],
} });
it('accepts published navigation and rejects incompatible, malformed or ambiguous identities', () => {
  expect(parseNavigation(fixture()).application.name).toBe('Shop');
  for (const mutate of [s => { s.platform.configSchemaVersion = 99; }, s => { s.shell.menus[0].modules[0].enabled = 'yes'; }, s => { s.shell.pages.push(s.shell.pages[0]); }, s => { s.shell.menus[0].modules.push(s.shell.menus[0].modules[0]); }]) {
    const snapshot = fixture(); mutate(snapshot); expect(() => parseNavigation(snapshot)).toThrow();
  }
  expect(() => parseNavigation(null)).toThrow();
});
it('aborts old requests and ignores responses from loaders that ignore cancellation', async () => {
  const pending = [];
  const load = vi.fn((url, signal) => new Promise(resolve => pending.push({ url, signal, resolve })));
  const { result, rerender, unmount } = renderHook(({ url }) => useBootstrap(url, 0, load), { initialProps: { url: '/first' } });
  rerender({ url: '/second' });
  expect(pending[0].signal.aborted).toBe(true);
  const latest = fixture(); latest.application.name = 'Latest';
  await act(async () => pending[1].resolve(latest));
  await act(async () => pending[0].resolve(fixture()));
  expect(result.current.snapshot.application.name).toBe('Latest');
  unmount(); expect(pending[1].signal.aborted).toBe(true);
});
it('shows safe failure text and supports explicit retry without polling', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('private server detail')).mockResolvedValue(fixture());
  const { result, rerender } = renderHook(({ revision }) => useBootstrap('/api/bootstrap', revision, load), { initialProps: { revision: 0 } });
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.message).not.toContain('private');
  rerender({ revision: 1 });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(load).toHaveBeenCalledTimes(2);
});
it('revalidates HTTP cache and rejects failed responses before parsing', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fixture()), { status: 200 }));
  try {
    const signal = new AbortController().signal;
    expect((await loadBootstrap('/api/bootstrap', signal)).application.id).toBe('app');
    expect(fetchMock).toHaveBeenCalledWith('/api/bootstrap', { signal, cache: 'no-cache', credentials: 'same-origin' });
    fetchMock.mockResolvedValue(new Response('private detail', { status: 500 }));
    await expect(loadBootstrap('/api/bootstrap', signal)).rejects.toThrow('Bootstrap unavailable');
  } finally { fetchMock.mockRestore(); }
});
it('revalidates only after a hidden-to-visible transition and suppresses reads in conserve state', async () => {
  let visibility = 'visible';
  const spy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  const initial = fixture(), conserving = fixture(); conserving.resources = { state: 'conserve' };
  const load = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(conserving);
  const { result, unmount } = renderHook(() => useBootstrap('/api/bootstrap', 0, load));
  const change = async value => { visibility = value; await act(async () => document.dispatchEvent(new Event('visibilitychange'))); };
  try {
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await change('visible'); expect(load).toHaveBeenCalledTimes(1);
    await change('hidden'); await change('visible'); expect(load).toHaveBeenCalledTimes(2);
    await change('hidden'); await change('visible'); expect(load).toHaveBeenCalledTimes(2);
    unmount(); await change('hidden'); await change('visible'); expect(load).toHaveBeenCalledTimes(2);
  } finally { unmount(); spy.mockRestore(); }
});
it('keeps the last snapshot readable when return-to-tab revalidation fails', async () => {
  let visibility = 'visible';
  const spy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  const load = vi.fn().mockResolvedValueOnce(fixture()).mockRejectedValue(new Error('offline'));
  const { result, unmount } = renderHook(() => useBootstrap('/api/bootstrap', 0, load));
  try {
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
    expect(result.current.snapshot.application.name).toBe('Shop');
  } finally { unmount(); spy.mockRestore(); }
});
it('maps daily-limit failures without exposing the server error', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'DAILY_LIMIT_REACHED', error: 'private detail', resetAt: '2026-11-15T00:00:00Z' }), { status: 503 }));
  try {
    const { result, unmount } = renderHook(() => useBootstrap('/api/bootstrap'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.resources).toEqual({ state: 'limit', resetAt: '2026-11-15T00:00:00Z' });
    expect(result.current.message).not.toContain('private');
    unmount();
  } finally { fetchMock.mockRestore(); }
});

it('retains navigation on a limit response and resumes revalidation after reset', async () => {
  let visibility = 'visible';
  const spy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  const load = vi.fn().mockResolvedValueOnce(fixture()).mockRejectedValueOnce(new BootstrapLimitError('2000-01-01T00:00:00Z')).mockResolvedValue(fixture());
  const { result, unmount } = renderHook(() => useBootstrap('/api/bootstrap', 0, load));
  const cycle = async () => {
    await act(async () => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  };
  try {
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await cycle();
    expect(result.current.status).toBe('ready');
    expect(result.current.snapshot.resources.state).toBe('limit');
    expect(result.current.snapshot.application.name).toBe('Shop');
    await cycle();
    expect(load).toHaveBeenCalledTimes(3);
    expect(result.current.snapshot.resources).toBeUndefined();
  } finally { unmount(); spy.mockRestore(); }
});
