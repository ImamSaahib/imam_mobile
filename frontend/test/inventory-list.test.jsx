import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageContent } from '../src/platform/pages/PageContent';

const device = (id, model) => ({ id, model, company: 'Samsung', imei: `3500000000${id}`, color: 'Black', condition: 'Pack', status: 'Available', purchasePrice: 40000, salePrice: 0, purchaseDate: '2026-11-01', saleDate: '' });
const dataSources = [{ id: 'ds-devices', key: 'devices' }, { id: 'ds-customers', key: 'customers' }];
const list = [{ id: 'c1', type: 'list', typeVersion: 1, config: { dataSourceId: 'ds-devices' } }];
const bootstrapUrl = 'https://api.test/api/bootstrap';
function mockPages(handler) {
  const fetchMock = vi.fn(async (url) => handler(new URL(url)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const ok = body => ({ ok: true, json: async () => body });
afterEach(() => vi.unstubAllGlobals());

it('loads the first keyset page and pages forward and back with the server total', async () => {
  const user = userEvent.setup();
  const fetchMock = mockPages(url => url.searchParams.get('after') === '8'
    ? ok({ items: [device(7, 'Third')], nextCursor: null, total: 3 })
    : ok({ items: [device(9, 'First'), device(8, 'Second')], nextCursor: '8', total: 3 }));
  render(<PageContent components={list} bootstrapUrl={bootstrapUrl} dataSources={dataSources} />);
  await screen.findByText('Showing 1–2 of 3');
  const first = new URL(fetchMock.mock.calls[0][0]);
  expect(first.pathname).toBe('/api/devices/page');
  expect(first.searchParams.get('limit')).toBe('25');
  expect(first.searchParams.has('after')).toBe(false);
  expect(screen.getByText('Second')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Previous', exact: true }).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Next', exact: true }));
  await screen.findByText('Showing 3–3 of 3');
  expect(new URL(fetchMock.mock.calls.at(-1)[0]).searchParams.get('after')).toBe('8');
  expect(screen.getByLabelText('Current page').textContent).toBe('Page 1');
  expect(screen.getByRole('button', { name: 'Next', exact: true }).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Previous', exact: true }));
  await screen.findByText('Showing 1–2 of 3');
  expect(new URL(fetchMock.mock.calls.at(-1)[0]).searchParams.has('after')).toBe(false);
});

it('does not offer Next when a full last page matches the total', async () => {
  mockPages(() => ok({ items: [device(2, 'A'), device(1, 'B')], nextCursor: '1', total: 2 }));
  render(<PageContent components={list} bootstrapUrl={bootstrapUrl} dataSources={dataSources} />);
  await screen.findByText('Showing 1–2 of 2');
  expect(screen.getByRole('button', { name: 'Next', exact: true }).disabled).toBe(true);
});

it('shows the empty state, keeps search inert and offers no row menu', async () => {
  mockPages(() => ok({ items: [], nextCursor: null, total: 0 }));
  render(<PageContent components={list} bootstrapUrl={bootstrapUrl} dataSources={dataSources} />);
  await screen.findByText('Showing 0 of 0');
  expect(screen.getByText('No records yet.')).toBeTruthy();
  const search = screen.getByRole('textbox', { name: 'Search Devices' });
  expect(search.disabled).toBe(true);
  expect(search.placeholder).toBe('Search is not available yet');
});

it('shows a safe error and recovers on retry', async () => {
  const user = userEvent.setup();
  let calls = 0;
  mockPages(() => ++calls === 1 ? { ok: false, status: 503, json: async () => ({ error: 'raw database failure' }) } : ok({ items: [device(1, 'Recovered')], nextCursor: null, total: 1 }));
  render(<PageContent components={list} bootstrapUrl={bootstrapUrl} dataSources={dataSources} />);
  await screen.findByText('Could not load records.');
  expect(screen.queryByText(/raw database failure/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Recovered');
});

it('rejects a malformed page instead of rendering it', async () => {
  mockPages(() => ok({ items: [{ id: 'x' }], nextCursor: null, total: 1 }));
  render(<PageContent components={list} bootstrapUrl={bootstrapUrl} dataSources={dataSources} />);
  await screen.findByText('Could not load records.');
});

it('renders only lists with valid settings for a data source that has a page read', async () => {
  const fetchMock = mockPages(() => ok({ items: [], nextCursor: null, total: 0 }));
  const { rerender } = render(<PageContent bootstrapUrl={bootstrapUrl} dataSources={dataSources}
    components={[{ type: 'list', typeVersion: 1, config: { dataSourceId: 'ds-customers' } }]} />);
  expect(screen.getByText('This list is unavailable in this version.')).toBeTruthy();
  rerender(<PageContent bootstrapUrl={bootstrapUrl} dataSources={dataSources}
    components={[{ type: 'list', typeVersion: 1, config: { dataSourceId: 'missing' } }]} />);
  expect(screen.getByText('This list is unavailable in this version.')).toBeTruthy();
  rerender(<PageContent bootstrapUrl={bootstrapUrl} dataSources={dataSources}
    components={[{ type: 'list', typeVersion: 1, config: { dataSourceId: 'ds-devices', extra: 1 } }]} />);
  expect(screen.getByText('This section has invalid settings.')).toBeTruthy();
  rerender(<PageContent bootstrapUrl={bootstrapUrl} dataSources={undefined} components={list} />);
  expect(screen.getByText('This list is unavailable in this version.')).toBeTruthy();
  rerender(<PageContent bootstrapUrl={bootstrapUrl} dataSources={dataSources}
    components={[{ type: 'list', typeVersion: 2, config: { dataSourceId: 'ds-devices' } }]} />);
  expect(screen.getByText('This section is unavailable in this version.')).toBeTruthy();
  await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
});

it('opens a row in a side panel from its action menu without another read', async () => {
  const user = userEvent.setup();
  const fetchMock = mockPages(() => ok({ items: [
    device(9, 'First'),
    { ...device(8, 'Second'), color: null, status: 'Sold Out', salePrice: 45000, saleDate: '2026-11-05' },
  ], nextCursor: null, total: 2 }));
  render(<PageContent components={list} bootstrapUrl={bootstrapUrl} dataSources={dataSources} />);
  await screen.findByText('Showing 1–2 of 2');
  await user.click(screen.getByRole('button', { name: 'Actions for First' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Open record' }));
  const panel = await screen.findByRole('dialog', { name: 'First' });
  expect(panel.textContent).toContain('Device details');
  const fields = Object.fromEntries([...panel.querySelectorAll('dt')].map(dt => [dt.textContent, dt.nextElementSibling.textContent]));
  expect(fields).toMatchObject({ Company: 'Samsung', Color: 'Black', Condition: 'Pack', Status: 'Available', IMEI: '35000000009', 'Purchase price': '40,000', 'Purchase date': '2026-11-01', 'Sale price': '—', 'Sale date': '—' });
  await user.click(screen.getByRole('button', { name: 'Close panel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await user.click(screen.getByRole('button', { name: 'Actions for Second' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Open record' }));
  const sold = await screen.findByRole('dialog', { name: 'Second' });
  const soldFields = Object.fromEntries([...sold.querySelectorAll('dt')].map(dt => [dt.textContent, dt.nextElementSibling.textContent]));
  expect(soldFields).toMatchObject({ Color: '—', Status: 'Sold Out', 'Sale price': '45,000', 'Sale date': '2026-11-05' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('rejects a page row that lacks the detail fields', async () => {
  mockPages(() => ok({ items: [{ id: 1, model: 'A', company: 'B', imei: '1', condition: 'Pack', status: 'Available', purchasePrice: 1 }], nextCursor: null, total: 1 }));
  render(<PageContent components={list} bootstrapUrl={bootstrapUrl} dataSources={dataSources} />);
  await screen.findByText('Could not load records.');
});
