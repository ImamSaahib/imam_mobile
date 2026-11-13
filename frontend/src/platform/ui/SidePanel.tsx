import React, { useState, type ReactNode } from 'react';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { Button } from './Button';

/** Modal panel with caller-owned content and native dialog focus handling. */
export function SidePanel({ trigger, title, description, children }: {
  trigger: string; title: string; description: string; children: ReactNode;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return <div ref={setContainer}><Dialog.Root>
    <Dialog.Trigger render={<Button />}>{trigger}</Dialog.Trigger>
    <Dialog container={container} className="im-side-panel">
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>
      {children}
      <Dialog.Close render={<Button />}>Close panel</Dialog.Close>
    </Dialog>
  </Dialog.Root></div>;
}
