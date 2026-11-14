import React, { useEffect, useState } from 'react';

type Counts = { total: number; available: number; sold: number };

export function InventorySummary({ url }: { url: string }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (![data.total, data.available, data.sold].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error();
        if (!controller.signal.aborted) setCounts(data);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [url, revision]);
  if (failed) return <p>Could not load inventory totals. <button onClick={() => { setFailed(false); setRevision(value => value + 1); }}>Retry</button></p>;
  if (!counts) return <p role="status">Loading inventory totals…</p>;
  return <section aria-label="Inventory summary"><h2>Inventory summary</h2><dl>
    <dt>Total devices</dt><dd>{counts.total}</dd>
    <dt>Available</dt><dd>{counts.available}</dd>
    <dt>Sold out</dt><dd>{counts.sold}</dd>
  </dl></section>;
}
