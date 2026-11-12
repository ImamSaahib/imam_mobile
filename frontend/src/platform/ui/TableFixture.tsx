import React, { useState } from 'react';
import { Button } from './Button';
import { DataTable, type Column } from './DataTable';
import { useTableResource, type TableLoader, type TableRequest } from './useTableResource';
type Device = { id: string; model: string; company: string; imei: string; price: number; status: string };
const devices: Device[] = [
  { id: 'a', model: 'Galaxy A15', company: 'Samsung', imei: '350000000010001', price: 40000, status: 'Available' },
  { id: 'b', model: 'Redmi 13C', company: 'Redmi', imei: '350000000010002', price: 28500, status: 'Sold Out' },
  { id: 'c', model: 'Pixel 8', company: 'Google', imei: '350000000010003', price: 90000, status: 'Available' },
];
// In-memory demonstration only. Runtime loaders must use server keyset cursors (Contract 10.3).
const load: TableLoader<Device> = async request => {
  const rows = devices.filter(row => `${row.model} ${row.company} ${row.imei}`.toLowerCase().includes(request.search.trim().toLowerCase()));
  if (request.sort) {
    const { key, direction } = request.sort;
    rows.sort((a, b) => {
      const x = a[key as keyof Device], y = b[key as keyof Device];
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (direction === 'asc' ? 1 : -1);
    });
  }
  const size = 2;
  const start = request.cursor === 'last' ? Math.max(0, Math.ceil(rows.length / size) - 1) * size
    : request.cursor?.startsWith('after:') ? Math.max(0, rows.findIndex(row => row.id === request.cursor!.slice(6)) + 1) : 0;
  const page = rows.slice(start, start + size);
  return { rows: page, pageLabel: `Page ${Math.floor(start / size) + 1}`, summary: rows.length ? `Showing ${start + 1}–${start + page.length} of ${rows.length}` : 'Showing 0 of 0', previous: start ? 'first' : null, next: start + size < rows.length ? `after:${page[page.length - 1].id}` : null, last: rows.length > size ? 'last' : null };
};
export function TableFixture() {
  const [opened, setOpened] = useState('');
  const [request, setRequest] = useState<TableRequest>({ search: '', sort: null, cursor: null, revision: 0 });
  const [hidden, setHidden] = useState<string[]>([]);
  const [columns, setColumns] = useState<Column<Device>[]>(() => [
    { key: 'model', label: 'Model', sortable: true, render: row => <button className="im-record-link" onClick={() => setOpened(row.model)}>{row.model}</button> },
    { key: 'company', label: 'Company', sortable: true, render: row => row.company },
    { key: 'imei', label: 'IMEI', render: row => <span className="im-record-identifier" title={row.imei}>{row.imei}</span> },
    { key: 'price', label: 'Price', sortable: true, render: row => row.price.toLocaleString('en-US') },
    { key: 'status', label: 'Status', render: row => row.status },
  ]);
  const state = useTableResource(load, request);
  return <section aria-label="Inventory table fixture">
    <DataTable label="Devices" columns={columns} hidden={hidden} onHiddenChange={setHidden} onColumnsChange={setColumns} rowKey={row => row.id} rowLabel={row => row.model}
      state={state} search={request.search} onSearch={search => setRequest(current => ({ ...current, search, cursor: null }))} sort={request.sort} onSort={sort => setRequest(current => ({ ...current, sort, cursor: null }))}
      onRefresh={() => setRequest(current => ({ ...current, revision: current.revision + 1 }))} onPage={cursor => setRequest(current => ({ ...current, cursor }))} onOpen={row => setOpened(row.model)} />
    {opened && <p role="status">Opened fixture: {opened} <Button onClick={() => setOpened('')}>Dismiss</Button></p>}
  </section>;
}
