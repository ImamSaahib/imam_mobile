// Counts rows read and written from the metadata that D1 returns with every result (Contracts section 9, 10.7).
// Wrap the database once per request. All platform code then uses the wrapper like a normal D1Database.
// `first()` is answered through `all()` because D1 returns metadata only with `all()`, `run()` and `batch()`.

export type Usage = { rowsRead: number; rowsWritten: number; queries: number };
export const newUsage = (): Usage => ({ rowsRead: 0, rowsWritten: 0, queries: 0 });

type Meta = { rows_read?: number; rows_written?: number } | undefined;

function record(usage: Usage, meta: Meta) {
  usage.queries += 1;
  usage.rowsRead += meta?.rows_read ?? 0;
  usage.rowsWritten += meta?.rows_written ?? 0;
}

class MeteredStatement {
  constructor(readonly inner: D1PreparedStatement, private usage: Usage) {}
  bind(...values: unknown[]) { return new MeteredStatement(this.inner.bind(...values), this.usage); }
  async all<T = Record<string, unknown>>() { const r = await this.inner.all<T>(); record(this.usage, r.meta); return r; }
  async run<T = Record<string, unknown>>() { const r = await this.inner.run<T>(); record(this.usage, r.meta); return r; }
  async first<T = Record<string, unknown>>(column?: string) {
    const r = await this.inner.all<T>();
    record(this.usage, r.meta);
    const row = (r.results[0] ?? null) as Record<string, unknown> | null;
    return (column ? (row ? row[column] ?? null : null) : row) as T | null;
  }
  raw(options?: { columnNames?: boolean }) { this.usage.queries += 1; return (this.inner as any).raw(options); }
}

/** Returns a database that adds the rows read and written by every query to `usage`. */
export function meterDb(db: D1Database, usage: Usage): D1Database {
  const wrapper = {
    prepare: (sql: string) => new MeteredStatement(db.prepare(sql), usage),
    async batch(statements: MeteredStatement[]) {
      const results = await db.batch(statements.map((s) => (s instanceof MeteredStatement ? s.inner : (s as unknown as D1PreparedStatement))));
      for (const r of results) record(usage, r.meta);
      return results;
    },
    exec: (sql: string) => db.exec(sql),
    dump: () => db.dump(),
    withSession: (x?: unknown) => (db as any).withSession(x)
  };
  return wrapper as unknown as D1Database;
}
