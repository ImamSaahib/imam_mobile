import React, { useState } from 'react';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import '@cloudflare/kumo/styles/standalone';
import { Button, IconButton } from './Button';
import { TextInput } from './TextInput';
import { Shell } from './Shell';

/** Development-only fixture, not a metadata runtime or measured shell. */
export default function Gallery() {
  const [applicationId, setApplicationId] = useState('shop');
  const [selected, setSelected] = useState('inventory');
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [query, setQuery] = useState('');
  const [refreshes, setRefreshes] = useState(0);
  return <Shell applications={[{ id: 'shop', label: 'Imam Mobile' }, { id: 'demo', label: 'Demo Workspace' }]} applicationId={applicationId} onApplicationChange={id => { setApplicationId(id); setSelected('inventory'); }}
    mode={mode} onModeChange={setMode} releaseLabel="Development preview" title={selected === 'inventory' ? 'Inventory' : selected === 'customers' ? 'Customers' : 'Dashboard'} description="Component fixtures — no business data" selectedId={selected} onSelect={setSelected} groups={[
      { id: 'business', label: 'Business', expandable: true, modules: [{ id: 'inventory', label: 'Inventory' }, { id: 'customers', label: 'Customers', badge: 'New' }] },
      { id: 'workspace', label: 'Workspace', modules: [{ id: 'dashboard', label: 'Dashboard' }] },
    ]} primaryAction={<Button variant="primary" onClick={() => setRefreshes(n => n + 1)}>Primary action</Button>}>
    <p role="status" aria-label="Selected module">Selected module: {selected}</p>
    <Button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>Switch theme</Button>
    <section className="im-gallery-controls" aria-label="Buttons">
      <Button disabled>Disabled action</Button>
      <Button loading>Loading action</Button>
      <Button variant="destructive">Destructive action</Button>
      <IconButton aria-label="Refresh" icon={ArrowClockwiseIcon} onClick={() => setRefreshes(n => n + 1)} />
      <p role="status" aria-label="Action count">Actions: {refreshes}</p>
    </section>
    <section className="im-gallery-controls" aria-label="Inputs">
      <TextInput aria-label="Search fixture" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search fixture" />
      <TextInput aria-label="Disabled input" disabled value="Unavailable" />
      <p>Search: {query}</p>
    </section>
  </Shell>;
}
