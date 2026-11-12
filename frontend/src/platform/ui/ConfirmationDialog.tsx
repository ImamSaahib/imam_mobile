import React, { useRef, useState } from 'react';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { Button } from './Button';
type Props = { trigger: string; title: string; description: string; confirmLabel: string; onConfirm: () => void | Promise<void> };
/** Caller owns the action; pending actions cannot be submitted twice or dismissed. */
export function ConfirmationDialog({ trigger, title, description, confirmLabel, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const busy = useRef(false);
  async function confirm() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(false);
    try { await onConfirm(); setOpen(false); }
    catch { setError(true); }
    finally { busy.current = false; setPending(false); }
  }
  return <div ref={setContainer}><Dialog.Root role="alertdialog" open={open} onOpenChange={value => {
    if (busy.current) return;
    setOpen(value); setError(false);
  }}>
    <Dialog.Trigger render={<Button />}>{trigger}</Dialog.Trigger>
    <Dialog container={container} className="im-confirmation-dialog">
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>
      {error && <p role="alert">The action could not be completed. Please try again.</p>}
      {pending && <p role="status">Working…</p>}
      <div className="im-gallery-controls">
        <Dialog.Close render={<Button disabled={pending} />}>Cancel</Dialog.Close>
        <Button variant="destructive" loading={pending} onClick={confirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  </Dialog.Root></div>;
}
