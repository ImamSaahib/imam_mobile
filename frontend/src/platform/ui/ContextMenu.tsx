import React, { createContext, useContext, useId, useMemo, useRef, useState, useEffect, type ReactNode, type SyntheticEvent } from 'react';
import { ContextMenu } from '@cloudflare/kumo/primitives/context-menu';
import { contextMenuKey } from '../ui-interactions';
export type ContextAction = { id: string; label: string; disabled?: boolean; run: () => void };
const Registry = createContext<Map<string, readonly ContextAction[]> | null>(null);
/** Targets supply descriptors; only the shell renders a menu. */
export function ContextTarget({ actions, children, label }: { actions: readonly ContextAction[]; children: ReactNode; label: string }) {
  const registry = useContext(Registry);
  const id = useId();
  useEffect(() => { registry?.set(id, actions); return () => { registry?.delete(id); }; }, [registry, id, actions]);
  return <div data-context-target={id} tabIndex={0} aria-label={label}>{children}</div>;
}
export function ShellContextMenu({ children, enabled = false }: { children: ReactNode; enabled?: boolean }) {
  const registry = useMemo(() => new Map<string, readonly ContextAction[]>(), []);
  const [actions, setActions] = useState<readonly ContextAction[]>([]);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  useEffect(() => { if (!enabled) setOpen(false); }, [enabled]);
  function prepare(event: SyntheticEvent) {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-context-target]') : null;
    const items = target ? registry.get(target.dataset.contextTarget!) : undefined;
    if (!enabled || !target || !items?.length) { return false; }
    origin.current = target; setActions(items); return true;
  }
  return <Registry.Provider value={registry}><div ref={setContainer}>
    <ContextMenu.Root open={open} onOpenChange={setOpen} disabled={!enabled}>
      <ContextMenu.Trigger onContextMenu={event => { if (!prepare(event)) event.preventBaseUIHandler(); }} onTouchStart={event => { if (!prepare(event)) event.preventBaseUIHandler(); }} onKeyDown={event => {
        if (!contextMenuKey(event) || !prepare(event)) return;
        event.preventDefault();
        const target = origin.current!; const rect = target.getBoundingClientRect();
        target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.x, clientY: rect.y + Math.min(rect.height, 44) }));
      }}>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal container={container}><ContextMenu.Positioner className="im-context-positioner" sideOffset={4}>
        <ContextMenu.Popup className="im-context-menu" aria-label="Element actions">
          {actions.map(action => <ContextMenu.Item key={action.id} disabled={action.disabled} className="im-context-action" onClick={() => { if (!action.disabled) action.run(); }}>{action.label}</ContextMenu.Item>)}
        </ContextMenu.Popup>
      </ContextMenu.Positioner></ContextMenu.Portal>
    </ContextMenu.Root>
  </div></Registry.Provider>;
}
