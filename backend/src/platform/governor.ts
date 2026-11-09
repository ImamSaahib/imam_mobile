// Resource governor and request rate limit (Contracts section 10.7).
//
// Each Worker instance adds up the rows its requests read and wrote and flushes the total to `usage_daily`
// at most every 5 minutes, and only when it changed. Instances do not share memory, so the estimate can be low.
// The thresholds are conservative for that reason.

import type { Usage } from "./usage";

export const BUDGET = { rowsRead: 1_000_000, rowsWritten: 100_000 } as const;
export const THRESHOLDS = { conserve: 0.7, essential: 0.9 } as const;
export const SYNC_INTERVAL_MS = 5 * 60 * 1000;
export const PROBE_INTERVAL_MS = 60 * 1000;

export type ResourceState = "normal" | "conserve" | "essential" | "limit";

export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
export function nextResetIso(now: number): string {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
}

/** State from the larger of the read and write shares of the daily budget. `limit` is set only by a real D1 limit error. */
export function stateForShare(share: number): Exclude<ResourceState, "limit"> {
  if (share >= THRESHOLDS.essential) return "essential";
  if (share >= THRESHOLDS.conserve) return "conserve";
  return "normal";
}

/** True when D1 reports that the account's daily row limit is used up (message documented by Cloudflare, September 2026). */
export function isLimitError(err: unknown): boolean {
  const message = String((err as { message?: unknown })?.message ?? "");
  return /daily row (read|write) limit/i.test(message);
}

export class Governor {
  private day = "";
  private baseRead = 0;
  private baseWritten = 0;
  private pendingRead = 0;
  private pendingWritten = 0;
  private lastSync = 0;
  private limitDay: string | null = null;
  private lastProbe = 0;

  reset() { this.day = ""; this.baseRead = this.baseWritten = this.pendingRead = this.pendingWritten = 0; this.lastSync = 0; this.limitDay = null; this.lastProbe = 0; }

  record(usage: Usage, now = Date.now()) { this.rollDay(now); this.pendingRead += usage.rowsRead; this.pendingWritten += usage.rowsWritten; }

  private rollDay(now: number) {
    const today = utcDay(now);
    if (today !== this.day) {
      this.day = today; this.baseRead = this.baseWritten = this.pendingRead = this.pendingWritten = 0; this.lastSync = 0;
      if (this.limitDay !== null && this.limitDay !== today) this.limitDay = null;
    }
  }

  /** Flushes this instance's usage and loads the day's total. Does I/O at most once per interval. Never throws. */
  async sync(db: D1Database, now = Date.now()): Promise<void> {
    this.rollDay(now);
    if (this.lastSync !== 0 && now - this.lastSync < SYNC_INTERVAL_MS) return;
    this.lastSync = now;
    const addRead = this.pendingRead, addWritten = this.pendingWritten;
    try {
      const row = await db.prepare(
        "INSERT INTO usage_daily (day, rows_read, rows_written, updated_at) VALUES (?,?,?,?) " +
        "ON CONFLICT(day) DO UPDATE SET rows_read=rows_read+excluded.rows_read, rows_written=rows_written+excluded.rows_written, updated_at=excluded.updated_at " +
        "RETURNING rows_read, rows_written"
      ).bind(this.day, addRead, addWritten, new Date(now).toISOString()).first<{ rows_read: number; rows_written: number }>();
      if (row) { this.baseRead = row.rows_read; this.baseWritten = row.rows_written; this.pendingRead -= addRead; this.pendingWritten -= addWritten; }
    } catch (err) {
      if (isLimitError(err)) this.markLimit(now);
      // Any other failure: keep the pending counts and try again at the next interval.
    }
  }

  markLimit(now = Date.now()) { this.limitDay = utcDay(now); }
  clearLimit() { this.limitDay = null; }

  /** While in the Limit state, lets one request through per minute to find out whether D1 works again. */
  shouldProbe(now = Date.now()): boolean {
    if (now - this.lastProbe < PROBE_INTERVAL_MS) return false;
    this.lastProbe = now;
    return true;
  }

  share(): { read: number; written: number; value: number } {
    const read = (this.baseRead + this.pendingRead) / BUDGET.rowsRead;
    const written = (this.baseWritten + this.pendingWritten) / BUDGET.rowsWritten;
    return { read, written, value: Math.max(read, written) };
  }

  state(now = Date.now()): ResourceState {
    this.rollDay(now);
    if (this.limitDay === utcDay(now)) return "limit";
    return stateForShare(this.share().value);
  }

  snapshot(now = Date.now()) {
    const state = this.state(now);
    const s = this.share();
    return { state, readShare: Math.round(s.read * 1000) / 1000, writeShare: Math.round(s.written * 1000) / 1000, ...(state === "limit" ? { resetAt: nextResetIso(now) } : {}) };
  }
}

/** Actions that stay available in the Essential and Limit states. Everything that only reads is always allowed. */
export const CORE_PERMISSIONS: ReadonlySet<string> = new Set(["sales.create", "ledger.create"]);

/** Fixed-window request limit per client, so one looping client cannot use up the day's budget. */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();
  constructor(private limit = 120, private windowMs = 60_000, private maxClients = 500) {}
  reset() { this.windows.clear(); }
  /** Returns 0 when the request is allowed, or the number of seconds to wait. */
  check(client: string, now = Date.now()): number {
    let w = this.windows.get(client);
    if (!w || now - w.start >= this.windowMs) {
      if (!w && this.windows.size >= this.maxClients) this.windows.delete(this.windows.keys().next().value as string);
      w = { start: now, count: 0 };
      this.windows.set(client, w);
    }
    w.count += 1;
    return w.count > this.limit ? Math.max(1, Math.ceil((w.start + this.windowMs - now) / 1000)) : 0;
  }
}

export const governor = new Governor();
export const rateLimiter = new RateLimiter();
