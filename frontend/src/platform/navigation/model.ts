/** Published bootstrap projection. IDs are identity; labels and slugs are presentation. */
export type PublishedNavigation = {
  resources?: { state: 'normal' | 'conserve' | 'essential' | 'limit'; resetAt?: string };
  application: { id: string; key: string; name: string };
  shell: {
    menus: { id: string; label: string; display: 'group' | 'section'; modules: {
      id: string; label: string; slug: string; badge: string | null; pageId: string; enabled: boolean;
    }[] }[];
    pages: { id: string; title: string; description: string | null; components?: unknown }[];
  };
};

export function navigationGroups(snapshot: PublishedNavigation) {
  return snapshot.shell.menus.map(menu => ({
    id: menu.id, label: menu.label, expandable: menu.display === 'group',
    modules: menu.modules.filter(module => module.enabled).map(module => ({
      id: module.id, label: module.label, badge: module.badge ?? undefined,
    })),
  })).filter(menu => menu.modules.length > 0);
}

export function modulePath(applicationId: string, moduleId: string) {
  return `/app/${encodeURIComponent(applicationId)}/module/${encodeURIComponent(moduleId)}`;
}

export type RouteResult =
  | { status: 'ready'; moduleId: string; page: PublishedNavigation['shell']['pages'][number] }
  | { status: 'not-found' | 'unavailable' };

/** Only explicit stable-ID routes are accepted; never fall back to a different page. */
export function resolveModule(snapshot: PublishedNavigation, pathname: string): RouteResult {
  const match = /^\/app\/([^/]+)\/module\/([^/]+)\/?$/.exec(pathname);
  if (!match) return { status: 'not-found' };
  let applicationId: string, moduleId: string;
  try { applicationId = decodeURIComponent(match[1]); moduleId = decodeURIComponent(match[2]); }
  catch { return { status: 'not-found' }; }
  if (applicationId !== snapshot.application.id) return { status: 'not-found' };
  const module = snapshot.shell.menus.flatMap(menu => menu.modules).find(module => module.id === moduleId);
  if (!module) return { status: 'not-found' };
  if (!module.enabled) return { status: 'unavailable' };
  const page = snapshot.shell.pages.find(page => page.id === module.pageId);
  if (!page) return { status: 'unavailable' };
  return { status: 'ready', moduleId, page };
}
