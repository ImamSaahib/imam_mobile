import { useEffect, useState } from 'react';
import type { PublishedNavigation } from './model';

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const unique = (items: { id: string }[]) => new Set(items.map(item => item.id)).size === items.length;

/** Validate the navigation projection before exposing network data to renderers. */
export function parseNavigation(value: unknown): PublishedNavigation {
  if (!object(value) || !object(value.platform) || value.platform.configSchemaVersion !== 1 ||
      !object(value.application) || !text(value.application.id) || !text(value.application.key) || !text(value.application.name) ||
      !object(value.shell) || !Array.isArray(value.shell.menus) || !Array.isArray(value.shell.pages)) throw new Error('Invalid bootstrap');
  const menus = value.shell.menus;
  const pages = value.shell.pages;
  for (const menu of menus) {
    if (!object(menu) || !text(menu.id) || !text(menu.label) || !['group', 'section'].includes(String(menu.display)) || !Array.isArray(menu.modules)) throw new Error('Invalid menu');
    for (const module of menu.modules) {
      if (!object(module) || !text(module.id) || !text(module.label) || typeof module.slug !== 'string' ||
          !nullableText(module.badge) || !text(module.pageId) || typeof module.enabled !== 'boolean') throw new Error('Invalid module');
    }
  }
  for (const page of pages) {
    if (!object(page) || !text(page.id) || !text(page.title) || !nullableText(page.description)) throw new Error('Invalid page');
  }
  const snapshot = value as unknown as PublishedNavigation;
  if (!unique(snapshot.shell.menus) || !unique(snapshot.shell.pages) || !unique(snapshot.shell.menus.flatMap(menu => menu.modules))) throw new Error('Duplicate identity');
  return snapshot;
}

export type BootstrapState = { status: 'loading' } | { status: 'ready'; snapshot: PublishedNavigation } |
  { status: 'error'; message: string };
export type BootstrapLoader = (url: string, signal: AbortSignal) => Promise<PublishedNavigation>;
export const loadBootstrap: BootstrapLoader = async (url, signal) => {
  // Let the HTTP cache revalidate using the server ETag; no persistent application cache.
  const response = await fetch(url, { signal, cache: 'no-cache', credentials: 'same-origin' });
  if (!response.ok) throw new Error('Bootstrap unavailable');
  return parseNavigation(await response.json());
};

/** Explicit load/retry only. Endpoint changes and unmount cancel pending work. */
export function useBootstrap(url: string, revision = 0, load: BootstrapLoader = loadBootstrap): BootstrapState {
  const [result, setResult] = useState<{ url: string; revision: number; load: BootstrapLoader; state: BootstrapState }>();
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    load(url, controller.signal).then(snapshot => {
      if (current) setResult({ url, revision, load, state: { status: 'ready', snapshot } });
    }).catch(() => {
      if (current) setResult({ url, revision, load, state: { status: 'error', message: 'Could not load the application. Please try again.' } });
    });
    return () => { current = false; controller.abort(); };
  }, [url, revision, load]);
  return result?.url === url && result.revision === revision && result.load === load ? result.state : { status: 'loading' };
}
