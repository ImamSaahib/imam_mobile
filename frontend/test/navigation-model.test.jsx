import { expect, it } from 'vitest';
import { modulePath, navigationGroups, resolveModule } from '../src/platform/navigation/model';
const fixture = () => ({ application: { id: 'app_one', key: 'custom-shop', name: 'Custom Shop' }, shell: {
  menus: [{ id: 'menu', label: 'Work', display: 'section', modules: [
    { id: 'mod_two', label: 'Second', slug: 'second', badge: 'New', pageId: 'page', enabled: true },
    { id: 'mod_one', label: 'First', slug: 'first', badge: null, pageId: 'page', enabled: true },
    { id: 'mod_disabled', label: 'Hidden', slug: 'hidden', badge: null, pageId: 'page', enabled: false },
  ] }], pages: [{ id: 'page', title: 'Page', description: null }],
} });
it('preserves published order, presentation and badges while omitting disabled modules', () => {
  expect(navigationGroups(fixture())).toEqual([{ id: 'menu', label: 'Work', expandable: false, modules: [
    { id: 'mod_two', label: 'Second', badge: 'New' }, { id: 'mod_one', label: 'First', badge: undefined },
  ] }]);
});
it('keeps routes stable across label, slug and menu-order changes', () => {
  const snapshot = fixture(), path = modulePath(snapshot.application.id, 'mod_one');
  snapshot.shell.menus[0].modules[1].label = 'Renamed';
  snapshot.shell.menus[0].modules[1].slug = 'renamed';
  snapshot.shell.menus[0].modules.reverse();
  expect(resolveModule(snapshot, path)).toEqual({ status: 'ready', moduleId: 'mod_one', page: snapshot.shell.pages[0] });
});
it('distinguishes unavailable targets from unknown and malformed routes', () => {
  const snapshot = fixture();
  expect(resolveModule(snapshot, modulePath('app_one', 'mod_disabled')).status).toBe('unavailable');
  for (const path of ['/app/app_other/module/mod_one', '/app/app_one/module/missing', '/app/%zz/module/mod_one', '/inventory']) {
    expect(resolveModule(snapshot, path).status).toBe('not-found');
  }
  snapshot.shell.pages = [];
  expect(resolveModule(snapshot, modulePath('app_one', 'mod_one')).status).toBe('unavailable');
});
it('encodes opaque IDs and omits menus with no enabled modules', () => {
  const snapshot = fixture();
  snapshot.application.id = 'app / one';
  expect(resolveModule(snapshot, modulePath(snapshot.application.id, 'mod_one')).status).toBe('ready');
  snapshot.shell.menus[0].modules.forEach(module => { module.enabled = false; });
  expect(navigationGroups(snapshot)).toEqual([]);
});
