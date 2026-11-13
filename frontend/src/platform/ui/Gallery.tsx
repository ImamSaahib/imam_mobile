import React, { useState } from 'react';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import '@cloudflare/kumo/styles/standalone';
import { Button, IconButton } from './Button';
import { TextInput } from './TextInput';
import { ContextTarget } from './ContextMenu';
import { Shell } from './Shell';
import { ConfirmationDialog } from './ConfirmationDialog';
import { SidePanel } from './SidePanel';
import { Notifications, useNotifications } from './Notifications';
import { ResourceState } from './ResourceState';
import { TableFixture } from './TableFixture';

function NotificationFixture() {
  const { notify } = useNotifications();
  return <Button onClick={() => notify('Fixture saved', 'Your example changes were saved.')}>Show notification</Button>;
}

/** Development-only fixture, not a metadata runtime or measured shell. */
export default function Gallery() {
  const [editMode, setEditMode] = useState(false);
  const [contextAction, setContextAction] = useState('');
  const [applicationId, setApplicationId] = useState('shop');
  const [selected, setSelected] = useState('inventory');
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [query, setQuery] = useState('');
  const [refreshes, setRefreshes] = useState(0);
  return <Shell contextMenuEnabled={editMode} applications={[{ id: 'shop', label: 'Imam Mobile' }, { id: 'demo', label: 'Demo Workspace' }]} applicationId={applicationId} onApplicationChange={id => { setApplicationId(id); setSelected('inventory'); }}
    mode={mode} onModeChange={setMode} releaseLabel="Development preview" title={selected === 'inventory' ? 'Inventory' : selected === 'customers' ? 'Customers' : 'Dashboard'} description="Component fixtures — no business data" selectedId={selected} onSelect={setSelected} groups={[
      { id: 'business', label: 'Business', expandable: true, modules: [{ id: 'inventory', label: 'Inventory' }, { id: 'customers', label: 'Customers', badge: 'New' }] },
      { id: 'workspace', label: 'Workspace', modules: [{ id: 'dashboard', label: 'Dashboard' }] },
    ]} primaryAction={<Button variant="primary" onClick={() => setRefreshes(n => n + 1)}>Primary action</Button>}>
    <Button onClick={() => setEditMode(value => !value)}>{editMode ? 'Lock fixture' : 'Edit fixture'}</Button>
    <ContextTarget label="Configurable table" actions={[{ id: 'inspect', label: 'Inspect table', run: () => setContextAction('Table inspected') }, { id: 'remove', label: 'Remove table', disabled: true, run: () => {} }]}><TableFixture /></ContextTarget>
    <p role="status" aria-label="Context action">{contextAction}</p>
    <p role="status" aria-label="Selected module">Selected module: {selected}</p>
    <Button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>Switch theme</Button>
    <section className="im-gallery-controls" aria-label="Buttons">
      <SidePanel trigger="Open side panel" title="Fixture details" description="Shared panel example."><TextInput aria-label="Panel note" placeholder="Add a note" /></SidePanel>
      <Notifications><NotificationFixture /></Notifications>
      <Button disabled>Disabled action</Button>
      <Button loading>Loading action</Button>
      <ConfirmationDialog trigger="Destructive action" title="Reset fixture?" description="This clears the fixture action count only." confirmLabel="Reset fixture" onConfirm={() => setRefreshes(0)} />
      <IconButton aria-label="Refresh" icon={ArrowClockwiseIcon} onClick={() => setRefreshes(n => n + 1)} />
      <p role="status" aria-label="Action count">Actions: {refreshes}</p>
    </section>
    <section aria-label="Resource states">
      <ResourceState state="loading" />
      <ResourceState state="empty" />
      <ResourceState state="no-results" />
      <ResourceState state="error" onRetry={() => setRefreshes(n => n + 1)} />
    </section>
    <section className="im-gallery-controls" aria-label="Inputs">
      <TextInput aria-label="Search fixture" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search fixture" />
      <TextInput aria-label="Disabled input" disabled value="Unavailable" />
      <p>Search: {query}</p>
    </section>
  </Shell>;
}
