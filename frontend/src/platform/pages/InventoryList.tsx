import React, { useCallback, useRef, useState } from 'react';
import { DataTable, type Column, type Page } from '../ui/DataTable';
import { SidePanel } from '../ui/SidePanel';
import { useTableResource, type TableLoader, type TableRequest } from '../ui/useTableResource';

type Device = {
  id: number; model: string; company: string; color: string | null; imei: string; condition: string; status: string;
  purchasePrice: number; salePrice: number; purchaseDate: string; saleDate: string;
};
const PAGE_SIZE = 25;

const money = (value: number) => value.toLocaleString('en-US');
const columns: Column<Device>[] = [
  { key: 'model', label: 'Model', render: row => row.model },
  { key: 'company', label: 'Company', render: row => row.company },
  { key: 'imei', label: 'IMEI', render: row => row.imei },
  { key: 'condition', label: 'Condition', render: row => row.condition },
  { key: 'purchasePrice', label: 'Purchase price', render: row => money(row.purchasePrice) },
  { key: 'status', label: 'Status', render: row => row.status },
];

function parseDevice(value: unknown): Device {
  const row = value as Partial<Device> | null;
  if (!row || !Number.isSafeInteger(row.id) || (row.id as number) < 1 || typeof row.model !== 'string' || typeof row.company !== 'string'
    || typeof row.imei !== 'string' || typeof row.condition !== 'string' || typeof row.status !== 'string'
    || typeof row.purchasePrice !== 'number' || !Number.isFinite(row.purchasePrice) || typeof row.salePrice !== 'number' || !Number.isFinite(row.salePrice)
    || (row.color !== null && typeof row.color !== 'string') || typeof row.purchaseDate !== 'string' || typeof row.saleDate !== 'string') throw new Error('Invalid device');
  return row as Device;
}

/**
 * Published Inventory list over the keyset page read (Contracts 10.3). Cursor tokens are 'first' or 'after:<id>'. The server
 * only knows "after this id", so the component remembers, per token, the previous token and the row offset to offer Previous
 * and "Showing x–y of z". Search and sorting are not available yet and are shown as such.
 */
export function InventoryList({ url }: { url: string }) {
  const trail = useRef(new Map<string, { previous: string | null; start: number }>([['first', { previous: null, start: 0 }]]));
  const [hidden, setHidden] = useState<string[]>([]);
  const [shownColumns, setShownColumns] = useState(columns);
  const [opened, setOpened] = useState<Device | null>(null);
  const [request, setRequest] = useState<TableRequest>({ search: '', sort: null, cursor: null, revision: 0 });
  const load = useCallback<TableLoader<Device>>(async (req, signal) => {
    const token = req.cursor ?? 'first';
    const target = new URL(url);
    target.searchParams.set('limit', String(PAGE_SIZE));
    if (token !== 'first') target.searchParams.set('after', token.slice(6));
    const response = await fetch(target.href, { signal });
    if (!response.ok) throw new Error('Read failed');
    const data = await response.json();
    if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0 || data.items.length > PAGE_SIZE
      || (data.nextCursor !== null && !/^[1-9]\d*$/.test(String(data.nextCursor)))) throw new Error('Invalid page');
    const rows = data.items.map(parseDevice);
    const here = trail.current.get(token) ?? { previous: 'first', start: 0 };
    const end = here.start + rows.length;
    // A full page may be the last one; the exact total decides whether Next is offered.
    const next = data.nextCursor !== null && end < data.total ? `after:${data.nextCursor}` : null;
    if (next) trail.current.set(next, { previous: token, start: end });
    const page: Page<Device> = {
      rows, previous: here.previous, next,
      pageLabel: `Page ${Math.floor(here.start / PAGE_SIZE) + 1}`,
      summary: rows.length ? `Showing ${here.start + 1}–${end} of ${data.total}` : 'Showing 0 of 0',
    };
    return page;
  }, [url]);
  const state = useTableResource(load, request, 0);
  const details: [string, string][] = opened ? [
    ['Company', opened.company], ['Color', opened.color || '—'], ['Condition', opened.condition], ['Status', opened.status], ['IMEI', opened.imei],
    ['Purchase price', money(opened.purchasePrice)], ['Purchase date', opened.purchaseDate],
    ['Sale price', opened.saleDate ? money(opened.salePrice) : '—'], ['Sale date', opened.saleDate || '—'],
  ] : [];
  return <><DataTable<Device> label="Devices" columns={shownColumns} hidden={hidden} onHiddenChange={setHidden} onColumnsChange={setShownColumns}
    rowKey={row => String(row.id)} rowLabel={row => row.model} state={state}
    search="" onSearch={() => {}} searchDisabled sort={null} onSort={() => {}}
    onRefresh={() => setRequest(current => ({ ...current, revision: current.revision + 1 }))}
    onOpen={setOpened}
    onPage={cursor => setRequest(current => ({ ...current, cursor: cursor === 'first' ? null : cursor, revision: current.revision }))} />
    {/* Read-only details from the page row: opening a record costs no extra read (Contracts 9, record open). */}
    <SidePanel open={Boolean(opened)} onOpenChange={open => { if (!open) setOpened(null); }} title={opened?.model ?? 'Device'} description="Device details">
      <dl>{details.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl>
    </SidePanel></>;
}
