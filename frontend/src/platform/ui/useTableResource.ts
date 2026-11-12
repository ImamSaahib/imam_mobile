import { useEffect, useState } from 'react';
import type { Page, Sort, TableState } from './DataTable';
export type TableRequest = { search: string; sort: Sort; cursor: string | null; revision: number };
export type TableLoader<T> = (request: TableRequest, signal: AbortSignal) => Promise<Page<T>>;
/** Pass stable loader and request identities (state or useMemo). Cancellation plus an effect-local guard protects against loaders that ignore AbortSignal. */
export function useTableResource<T>(load: TableLoader<T>, request: TableRequest, debounceMs = 200): TableState<T> {
  const [result, setResult] = useState<{ request: TableRequest; state: TableState<T> }>();
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const page = await load(request, controller.signal);
        if (current) setResult({ request, state: { status: 'ready', page } });
      } catch {
        if (current) setResult({ request, state: { status: 'error' } });
      }
    }, debounceMs);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [load, request, debounceMs]);
  return result?.request === request ? result.state : { status: 'loading' };
}
