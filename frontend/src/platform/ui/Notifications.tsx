import React, { useState, type ReactNode } from 'react';
import { Toasty, useKumoToastManager } from '@cloudflare/kumo/components/toast';

/** Keep portals inside the themed application boundary. */
export function Notifications({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return <div ref={setContainer}><Toasty container={container}>{children}</Toasty></div>;
}

export function useNotifications() {
  const manager = useKumoToastManager();
  return {
    notify: (title: string, description?: string) => manager.add({ title, description }),
    dismiss: (id: string) => manager.close(id),
  };
}
