import React, { useState, type ReactNode } from 'react';
import { Table } from '@cloudflare/kumo/components/table';
import { Popover } from '@cloudflare/kumo/components/popover';
import { DropdownMenu } from '@cloudflare/kumo/components/dropdown';
import { Tooltip, TooltipProvider } from '@cloudflare/kumo/components/tooltip';
import { ArrowClockwiseIcon, ArrowUpIcon, ArrowDownIcon, ArrowsDownUpIcon, MagnifyingGlassIcon, GearIcon, DotsThreeIcon } from '@phosphor-icons/react';
import { Button } from './Button';
import { TextInput } from './TextInput';
import './table.css';
import { ResourceState } from './ResourceState';

export type Sort = { key: string; direction: 'asc' | 'desc' } | null;
export type Column<T> = { key: string; label: string; sortable?: boolean; render: (row: T) => ReactNode };
export type Page<T> = { rows: T[]; summary: string; pageLabel?: string; previous: string | null; next: string | null; last?: string | null };
export type TableState<T> = { status: 'loading' | 'error' | 'ready'; page?: Page<T> };
type Props<T> = {
  label: string; columns: Column<T>[]; hidden: string[]; onHiddenChange: (keys: string[]) => void;
  onColumnsChange: (columns: Column<T>[]) => void; rowKey: (row: T) => string; rowLabel: (row: T) => string;
  state: TableState<T>; search: string; onSearch: (value: string) => void; sort: Sort; onSort: (value: Sort) => void;
  onRefresh: () => void; onPage: (cursor: string | null) => void; onOpen: (row: T) => void;
};
/** Controlled presentation. Permissions, data loading and action registration belong to callers. */
export function DataTable<T>(props: Props<T>) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const shown = props.columns.filter(column => !props.hidden.includes(column.key));
  const { state } = props;
  const busy = state.status === 'loading';
  const page = state.status === 'ready' ? state.page : undefined;
  function move(index: number, offset: number) {
    const columns = [...props.columns];
    [columns[index], columns[index + offset]] = [columns[index + offset], columns[index]];
    props.onColumnsChange(columns);
  }
  return <div ref={setContainer} className="im-data-table">
    <TooltipProvider>
      <div className="im-table-toolbar">
        <MagnifyingGlassIcon aria-hidden />
        <TextInput aria-label={`Search ${props.label}`} placeholder={`Search ${props.label.toLowerCase()}`} value={props.search} onChange={event => props.onSearch(event.target.value)} />
        <Tooltip content="Refresh records" container={container} render={<Button aria-label="Refresh records" disabled={busy} onClick={props.onRefresh} />}><ArrowClockwiseIcon aria-hidden /></Tooltip>
      </div>
      <div className="im-table-scroll" role="region" aria-label={`${props.label} table`} tabIndex={0}>
        <Table aria-label={props.label} aria-busy={busy}>
          <Table.Header><Table.Row>
            {shown.map(column => <Table.Head key={column.key} aria-sort={props.sort?.key === column.key ? props.sort.direction === 'asc' ? 'ascending' : 'descending' : column.sortable ? 'none' : undefined}>
              {column.sortable ? <Button variant="ghost" onClick={() => props.onSort(props.sort?.key !== column.key ? { key: column.key, direction: 'asc' } : props.sort.direction === 'asc' ? { key: column.key, direction: 'desc' } : null)}>
                {column.label}{props.sort?.key === column.key ? props.sort.direction === 'asc' ? <ArrowUpIcon aria-hidden /> : <ArrowDownIcon aria-hidden /> : <ArrowsDownUpIcon aria-hidden />}
              </Button> : column.label}
            </Table.Head>)}
            <Table.Head>
              <Popover><Popover.Trigger render={<Button aria-label="Column settings" title="Column settings" />}><GearIcon aria-hidden /></Popover.Trigger>
                <Popover.Content container={container} className="im-column-settings">
                  <Popover.Title>Columns</Popover.Title>
                  <Popover.Description>Choose visible columns and their order.</Popover.Description>
                  {props.columns.map((column, index) => <div key={column.key} className="im-column-control">
                    <label><input type="checkbox" checked={!props.hidden.includes(column.key)} disabled={shown.length === 1 && shown[0].key === column.key} onChange={event => props.onHiddenChange(event.target.checked ? props.hidden.filter(key => key !== column.key) : [...props.hidden, column.key])} />{column.label}</label>
                    <Button aria-label={`Move ${column.label} earlier`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUpIcon aria-hidden /></Button>
                    <Button aria-label={`Move ${column.label} later`} disabled={index === props.columns.length - 1} onClick={() => move(index, 1)}><ArrowDownIcon aria-hidden /></Button>
                  </div>)}
                </Popover.Content>
              </Popover>
            </Table.Head>
          </Table.Row></Table.Header>
          <Table.Body>
            {busy ? <Table.Row><Table.Cell colSpan={shown.length + 1}><ResourceState state="loading" /></Table.Cell></Table.Row>
              : state.status === 'error' ? <Table.Row><Table.Cell colSpan={shown.length + 1}><ResourceState state="error" onRetry={props.onRefresh} /></Table.Cell></Table.Row>
              : !page?.rows.length ? <Table.Row><Table.Cell colSpan={shown.length + 1}><ResourceState state={props.search.trim() ? "no-results" : "empty"} /></Table.Cell></Table.Row>
              : page.rows.map(row => <Table.Row key={props.rowKey(row)}>
                {shown.map(column => <Table.Cell key={column.key}>{column.render(row)}</Table.Cell>)}
                <Table.Cell><DropdownMenu>
                  <DropdownMenu.Trigger render={<Button aria-label={`Actions for ${props.rowLabel(row)}`} title={`Actions for ${props.rowLabel(row)}`} />}><DotsThreeIcon aria-hidden /></DropdownMenu.Trigger>
                  <DropdownMenu.Content container={container}><DropdownMenu.Item onClick={() => props.onOpen(row)}>Open record</DropdownMenu.Item></DropdownMenu.Content>
                </DropdownMenu></Table.Cell>
              </Table.Row>)}
          </Table.Body>
        </Table>
      </div>
      <footer className="im-table-footer">
        <p role="status" aria-label="Result summary">{page?.summary ?? (busy ? 'Loading…' : 'Results unavailable')}</p>
        <nav aria-label="Table pages">
          <Button disabled={!page?.previous} onClick={() => props.onPage(null)}>First</Button>
          <Button disabled={!page?.previous} onClick={() => props.onPage(page?.previous ?? null)}>Previous</Button>
          {page?.pageLabel && <span aria-label="Current page">{page.pageLabel}</span>}
          <Button disabled={!page?.next} onClick={() => props.onPage(page?.next ?? null)}>Next</Button>
          <Button disabled={!page?.next || !page?.last} onClick={() => props.onPage(page?.last ?? null)}>Last</Button>
        </nav>
      </footer>
    </TooltipProvider>
  </div>;
}
