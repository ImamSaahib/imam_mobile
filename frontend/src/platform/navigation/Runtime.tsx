import React, { useEffect, useState } from 'react';
import '@cloudflare/kumo/styles/standalone';
import { Shell } from '../ui/Shell';
import { ResourceState } from '../ui/ResourceState';
import { useBootstrap } from './bootstrap';
import { modulePath, navigationGroups, resolveModule, type PublishedNavigation } from './model';

function PublishedShell({ snapshot }: { snapshot: PublishedNavigation }) {
  const [path, setPath] = useState(window.location.pathname);
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const groups = navigationGroups(snapshot);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    if (path !== '/__platform') return;
    const first = groups[0]?.modules[0];
    if (!first) return;
    const next = modulePath(snapshot.application.id, first.id);
    window.history.replaceState(null, '', next); setPath(next);
  }, [path, snapshot]);
  const route = resolveModule(snapshot, path);
  const title = route.status === 'ready' ? route.page.title : route.status === 'unavailable' ? 'Page unavailable' : 'Page not found';
  return <Shell applications={[{ id: snapshot.application.id, label: snapshot.application.name }]}
    applicationId={snapshot.application.id} onApplicationChange={() => {}}
    groups={groups} selectedId={route.status === 'ready' ? route.moduleId : ''}
    onSelect={id => { const next = modulePath(snapshot.application.id, id); if (next !== path) window.history.pushState(null, '', next); setPath(next); }}
    title={title} description={route.status === 'ready' ? route.page.description ?? undefined : undefined}
    mode={mode} onModeChange={setMode} releaseLabel="Published navigation preview">
    {route.status === 'ready' ? <p>Page content is being migrated. Use the existing application for business workflows.</p>
      : <ResourceState state="empty" message={route.status === 'unavailable' ? 'This page is currently unavailable.' : 'Choose an available page from the navigation.'} />}
    <a href="/">Open existing application</a>
  </Shell>;
}

/** Local development integration entry; published navigation with legacy escape hatch. */
export default function NavigationRuntime({ bootstrapUrl }: { bootstrapUrl: string }) {
  const [revision, setRevision] = useState(0);
  const state = useBootstrap(bootstrapUrl, revision);
  if (state.status === 'ready') return <PublishedShell snapshot={state.snapshot} />;
  return <main className="im-shell im-page" data-mode="light">
    <h1>Application</h1>
    <ResourceState state={state.status === 'loading' ? 'loading' : 'error'} message={state.status === 'loading' ? 'Loading application…' : state.message} onRetry={() => setRevision(value => value + 1)} />
    <a href="/">Open existing application</a>
  </main>;
}
