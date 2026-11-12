import React, { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { Sidebar } from '@cloudflare/kumo/components/sidebar';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import { TextInput } from './TextInput';
import { focusQuickSearch } from '../ui-interactions';

type Module = { id: string; label: string; icon?: ComponentType<{ className?: string }>; badge?: string };
export type NavigationGroup = { id: string; label: string; expandable?: boolean; modules: readonly Module[] };
type Props = { applicationName: string; groups: readonly NavigationGroup[]; selectedId: string; onSelect: (id: string) => void };

/** Fixture/data-driven presentation only. The owning shell supplies routing and permissions. */
export function Navigator({ applicationName, groups, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const search = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const term = query.trim().toLocaleLowerCase();
  const visible = groups.map(group => ({ ...group, modules: group.label.toLocaleLowerCase().includes(term)
    ? group.modules : group.modules.filter(module => module.label.toLocaleLowerCase().includes(term)) }))
    .filter(group => group.modules.length > 0);
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => focusQuickSearch(event, () => search.current?.querySelector('input')?.focus());
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  function moveFocus(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !(event.target instanceof HTMLButtonElement)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-navigation-item]'));
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }
  return <nav aria-label={`${applicationName} navigation`} onKeyDown={moveFocus}>
    <Sidebar.Header>
      <strong>{applicationName}</strong>
      <div ref={search}><TextInput aria-label="Quick search" placeholder="Search menus and modules" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setQuery(''); }
      }} /></div>
      <small>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}</small>
    </Sidebar.Header>
    <Sidebar.Content>
      {visible.map(group => {
        const expanded = Boolean(term) || !collapsed.has(group.id);
        const id = `${prefix}-${group.id}`;
        return <Sidebar.Group key={group.id}>
          {group.expandable ? <Sidebar.Menu><Sidebar.MenuButton data-navigation-item aria-expanded={expanded} aria-controls={id} onClick={() => setCollapsed(current => {
            const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next;
          })} icon={expanded ? CaretDownIcon : CaretRightIcon}>{group.label}</Sidebar.MenuButton></Sidebar.Menu>
            : <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>}
          {expanded && <Sidebar.Menu id={id} aria-label={group.label}>
            {group.modules.map(module => <Sidebar.MenuButton key={module.id} data-navigation-item icon={module.icon} active={selectedId === module.id} aria-current={selectedId === module.id ? 'page' : undefined} onClick={() => onSelect(module.id)}>
              {module.label}{module.badge && <Sidebar.MenuBadge>{module.badge}</Sidebar.MenuBadge>}
            </Sidebar.MenuButton>)}
          </Sidebar.Menu>}
        </Sidebar.Group>;
      })}
      {visible.length === 0 && <p role="status">No matching menus or modules.</p>}
    </Sidebar.Content>
  </nav>;
}

/** Keep Kumo context private to our UI layer; shell layout follows in its own slice. */
export function NavigatorPreview(props: Props) {
  return <Sidebar.Provider contained collapsible="none"><Sidebar><Navigator {...props} /></Sidebar></Sidebar.Provider>;
}
