import React, { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Sidebar } from '@cloudflare/kumo/components/sidebar';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { DropdownMenu } from '@cloudflare/kumo/components/dropdown';
import { CaretDownIcon, ListIcon, UserCircleIcon } from '@phosphor-icons/react';
import { Navigator, type NavigationGroup } from './Navigator';
import { Button } from './Button';
import { quickSearchKey } from '../ui-interactions';
import './shell.css';

// Kumo's documented mobile breakpoint; provisional until reference calibration.
const MOBILE_QUERY = '(max-width: 767px)';
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
type Application = { id: string; label: string };
type Props = {
  applications: readonly Application[]; applicationId: string; onApplicationChange: (id: string) => void;
  groups: readonly NavigationGroup[]; selectedId: string; onSelect: (id: string) => void;
  title: string; description?: string; primaryAction?: ReactNode; children: ReactNode;
  mode: 'light' | 'dark'; onModeChange: (mode: 'light' | 'dark') => void; releaseLabel: string;
};
export function Shell(props: Props) {
  const mobile = useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const searchRequested = useRef(false);
  const appName = props.applications.find(app => app.id === props.applicationId)?.label ?? 'Applications';
  useEffect(() => { setDrawerOpen(false); }, [mobile]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (mobile && !drawerOpen && quickSearchKey(event)) {
        event.preventDefault(); searchRequested.current = true; setDrawerOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobile, drawerOpen]);
  useEffect(() => {
    if (!drawerOpen || !searchRequested.current) return;
    const timer = setTimeout(() => {
      container?.querySelector<HTMLInputElement>('input[aria-label="Quick search"]')?.focus();
      searchRequested.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [drawerOpen, container]);
  const switcher = <DropdownMenu>
    <DropdownMenu.Trigger render={<Button className="im-app-switcher" />}>{appName}<CaretDownIcon aria-hidden /></DropdownMenu.Trigger>
    <DropdownMenu.Content container={container}>
      <DropdownMenu.Group><DropdownMenu.Label>Applications</DropdownMenu.Label>
      {props.applications.map(app => <DropdownMenu.Item key={app.id} selected={app.id === props.applicationId} onClick={() => {
        props.onApplicationChange(app.id); setDrawerOpen(false);
      }}>{app.label}</DropdownMenu.Item>)}
    </DropdownMenu.Group></DropdownMenu.Content>
  </DropdownMenu>;
  const navigation = <Navigator applicationName={appName} applicationSwitcher={switcher} groups={props.groups} selectedId={props.selectedId} onSelect={id => {
    props.onSelect(id); setDrawerOpen(false);
  }} />;
  return <div ref={setContainer} className="im-shell" data-mode={props.mode} style={{ colorScheme: props.mode }}>
    <Sidebar.Provider collapsible="none">
      {!mobile && <Sidebar className="im-desktop-navigation">{navigation}</Sidebar>}
      <div className="im-workspace">
        <header className="im-topbar">
          {mobile && <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Dialog.Trigger render={<Button aria-label="Open navigation" />}><ListIcon aria-hidden />Menu</Dialog.Trigger>
            <Dialog container={container} className="im-navigation-drawer">
              <Dialog.Title className="im-visually-hidden">Application navigation</Dialog.Title>
              <Dialog.Description className="im-visually-hidden">Choose an application or module.</Dialog.Description>
              <Dialog.Close render={<Button className="im-drawer-close" />}>Close navigation</Dialog.Close>
              {navigation}
            </Dialog>
          </Dialog.Root>}
          <span className="im-topbar-spacer" />
          <DropdownMenu>
            <DropdownMenu.Trigger render={<Button aria-label="Super Menu" />}><UserCircleIcon aria-hidden />Menu</DropdownMenu.Trigger>
            <DropdownMenu.Content container={container}>
              <DropdownMenu.Group><DropdownMenu.Label>{props.releaseLabel}</DropdownMenu.Label>
              <DropdownMenu.Item onClick={() => props.onModeChange(props.mode === 'light' ? 'dark' : 'light')}>Use {props.mode === 'light' ? 'dark' : 'light'} theme</DropdownMenu.Item>
              <DropdownMenu.Item disabled>Configure application (coming later)</DropdownMenu.Item>
            </DropdownMenu.Group></DropdownMenu.Content>
          </DropdownMenu>
        </header>
        <main className="im-page" id="module-content">
          <header className="im-page-header"><div><h1>{props.title}</h1>{props.description && <p>{props.description}</p>}</div>{props.primaryAction}</header>
          {props.children}
        </main>
      </div>
      <aside hidden aria-label="Reserved details panel" />
    </Sidebar.Provider>
  </div>;
}
