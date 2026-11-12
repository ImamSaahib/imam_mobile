import React, { useState } from 'react';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import '@cloudflare/kumo/styles/standalone';
import { Button, IconButton } from './Button';
import { TextInput } from './TextInput';

/** Development-only fixture, not a metadata runtime or measured shell. */
export default function Gallery() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [query, setQuery] = useState('');
  const [refreshes, setRefreshes] = useState(0);
  return <main data-mode={mode} style={{ colorScheme: mode }}>
    <h1>Shared component gallery</h1>
    <Button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>Switch theme</Button>
    <section aria-label="Buttons">
      <Button variant="primary" onClick={() => setRefreshes(n => n + 1)}>Primary action</Button>
      <Button disabled>Disabled action</Button>
      <Button loading>Loading action</Button>
      <Button variant="destructive">Destructive action</Button>
      <IconButton aria-label="Refresh" icon={ArrowClockwiseIcon} onClick={() => setRefreshes(n => n + 1)} />
      <p role="status" aria-label="Action count">Actions: {refreshes}</p>
    </section>
    <section aria-label="Inputs">
      <TextInput aria-label="Search fixture" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search fixture" />
      <TextInput aria-label="Disabled input" disabled value="Unavailable" />
      <p>Search: {query}</p>
    </section>
  </main>;
}
