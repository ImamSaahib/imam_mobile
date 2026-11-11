// Maintained counters (Contracts section 10.4, Story 04 slice 04e).
//
// A counter is a stored count that changes in the same db.batch() as the record write, so an unfiltered total
// or a KPI count costs one row read instead of a table scan. Definitions are registered here, in code.
// A counter key is "total", or "<column>=<value>" for a definition with a group column.
//
// The statements below are built for the legacy create, update and delete routes and are reused by the record
// write path of Stories 05 and 06. Statements that depend on the current row (a delete, a change of the group
// value) are placed BEFORE the write in the batch, so they read the row as it was. D1 runs a batch as one
// transaction, so the counters and the write succeed or fail together.
//
// rebuild recomputes every counter from the table and reports drift. It reads the whole table once, so it is an
// administrator action, not part of normal requests.

import type { Actor } from "./policy";
import { auditStatement } from "./audit";
import { PlatformError } from "./errors";
import { bumpVersionStatement } from "./versions";

export type CounterDefinition = {
  dataSource: string;
  table: string;
  /** Column whose values each get a counter "<column>=<value>". */
  groupBy?: string;
};

export const COUNTER_DEFINITIONS: readonly CounterDefinition[] = [
  { dataSource: "devices", table: "mobile_devices", groupBy: "status" },
  { dataSource: "customers", table: "customers" },
  { dataSource: "ledger", table: "customer_entries" },
  { dataSource: "sales", table: "sales" }
];

export function counterDefinition(dataSource: string): CounterDefinition {
  const def = COUNTER_DEFINITIONS.find((d) => d.dataSource === dataSource);
  if (!def) throw new PlatformError("COUNTER_NOT_DEFINED", `There are no counters for "${dataSource}".`, 404);
  return def;
}

const quote = (identifier: string) => '"' + identifier.replace(/"/g, '""') + '"';
const UPSERT = "INSERT INTO data_source_counters (data_source_key,counter_key,value,updated_at) VALUES (?,?,1,datetime('now')) ON CONFLICT(data_source_key,counter_key) DO UPDATE SET value=value+1, updated_at=datetime('now')";

/** A record is created: the total goes up, and so does the counter of its group value. */
export function countersOnCreate(db: D1Database, dataSource: string, groupValue?: string): D1PreparedStatement[] {
  const def = counterDefinition(dataSource);
  const out = [db.prepare(UPSERT).bind(dataSource, "total")];
  if (def.groupBy) {
    if (groupValue === undefined) throw new PlatformError("COUNTER_GROUP_MISSING", `${dataSource} counters need a ${def.groupBy} value.`, 500);
    out.push(db.prepare(UPSERT).bind(dataSource, `${def.groupBy}=${groupValue}`));
  }
  return out;
}

/** A record is deleted. Put these before the DELETE. They do nothing when the record does not exist. */
export function countersOnDelete(db: D1Database, dataSource: string, id: number): D1PreparedStatement[] {
  const def = counterDefinition(dataSource);
  const exists = `EXISTS (SELECT 1 FROM ${quote(def.table)} WHERE id=?)`;
  const out = [db.prepare(`UPDATE data_source_counters SET value=value-1, updated_at=datetime('now') WHERE data_source_key=? AND counter_key='total' AND ${exists}`).bind(dataSource, id)];
  if (def.groupBy) {
    out.push(db.prepare(`UPDATE data_source_counters SET value=value-1, updated_at=datetime('now') WHERE data_source_key=? AND counter_key = ? || (SELECT ${quote(def.groupBy)} FROM ${quote(def.table)} WHERE id=?) AND ${exists}`).bind(dataSource, `${def.groupBy}=`, id, id));
  }
  return out;
}

/**
 * The group value of a record is about to become newValue. Put these before the UPDATE. They change nothing when
 * the record does not exist or already has that value.
 */
export function countersOnGroupChange(db: D1Database, dataSource: string, id: number, newValue: string): D1PreparedStatement[] {
  const def = counterDefinition(dataSource);
  if (!def.groupBy) return [];
  const col = quote(def.groupBy), table = quote(def.table);
  const differs = `(SELECT ${col} FROM ${table} WHERE id=?) != ?`;
  return [
    db.prepare(`UPDATE data_source_counters SET value=value-1, updated_at=datetime('now') WHERE data_source_key=? AND counter_key = ? || (SELECT ${col} FROM ${table} WHERE id=?) AND ${differs}`).bind(dataSource, `${def.groupBy}=`, id, id, newValue),
    db.prepare(`INSERT INTO data_source_counters (data_source_key,counter_key,value,updated_at) SELECT ?,?,1,datetime('now') WHERE ${differs} ON CONFLICT(data_source_key,counter_key) DO UPDATE SET value=value+1, updated_at=datetime('now')`).bind(dataSource, `${def.groupBy}=${newValue}`, id, newValue)
  ];
}

/** Every write to a data source adds this to its batch (Story 04 scope item 15). */
export const versionBump = bumpVersionStatement;

// ---------------------------------------------------------------------------------------------
// Reading, checking and rebuilding

export type CounterValue = { key: string; value: number };
export type CounterDrift = { key: string; stored: number | null; actual: number };
export type CounterReport = { dataSource: string; table: string; counters: CounterValue[]; actual: CounterValue[]; drift: CounterDrift[]; ok: boolean };

/** Stored counters of one data source (or all). Reads one row per counter. */
export async function listCounters(db: D1Database, dataSource?: string): Promise<{ dataSource: string; counters: CounterValue[] }[]> {
  const defs = dataSource ? [counterDefinition(dataSource)] : COUNTER_DEFINITIONS;
  const r = dataSource
    ? await db.prepare("SELECT data_source_key, counter_key, value FROM data_source_counters WHERE data_source_key=? ORDER BY counter_key").bind(dataSource).all<{ data_source_key: string; counter_key: string; value: number }>()
    : await db.prepare("SELECT data_source_key, counter_key, value FROM data_source_counters ORDER BY data_source_key, counter_key").all<{ data_source_key: string; counter_key: string; value: number }>();
  return defs.map((d) => ({ dataSource: d.dataSource, counters: r.results.filter((x) => x.data_source_key === d.dataSource).map((x) => ({ key: x.counter_key, value: x.value })) }));
}

async function actualCounts(db: D1Database, def: CounterDefinition): Promise<CounterValue[]> {
  if (def.groupBy) {
    const col = quote(def.groupBy);
    const r = await db.prepare(`SELECT ${col} AS g, COUNT(*) AS n FROM ${quote(def.table)} GROUP BY ${col} ORDER BY ${col}`).all<{ g: string | null; n: number }>();
    const total = r.results.reduce((s, x) => s + x.n, 0);
    return [{ key: "total", value: total }, ...r.results.map((x) => ({ key: `${def.groupBy}=${x.g}`, value: x.n }))];
  }
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${quote(def.table)}`).first<{ n: number }>();
  return [{ key: "total", value: r?.n ?? 0 }];
}

async function compare(db: D1Database, def: CounterDefinition): Promise<CounterReport> {
  const stored = (await listCounters(db, def.dataSource))[0].counters;
  const actual = await actualCounts(db, def);
  const storedMap = new Map(stored.map((c) => [c.key, c.value]));
  const actualMap = new Map(actual.map((c) => [c.key, c.value]));
  const drift: CounterDrift[] = [];
  for (const key of new Set([...storedMap.keys(), ...actualMap.keys()])) {
    const s = storedMap.get(key) ?? null, a = actualMap.get(key) ?? 0;
    // A stored counter that is zero for a value no record has any more is not drift.
    if ((s ?? 0) !== a || (s === null && a !== 0)) drift.push({ key, stored: s, actual: a });
  }
  drift.sort((x, y) => x.key.localeCompare(y.key));
  return { dataSource: def.dataSource, table: def.table, counters: stored, actual, drift, ok: drift.length === 0 };
}

/**
 * Recomputes counters from the tables. With apply false it only reports drift. With apply true it also writes the
 * actual values and one audit event, in one batch. Reads each table once.
 */
export async function rebuildCounters(db: D1Database, input: { dataSource?: string; apply?: boolean }, actor: Actor | null): Promise<{ applied: boolean; reports: CounterReport[] }> {
  const defs = input.dataSource ? [counterDefinition(input.dataSource)] : COUNTER_DEFINITIONS;
  const reports: CounterReport[] = [];
  for (const def of defs) reports.push(await compare(db, def));
  const apply = input.apply === true;
  const drifted = reports.filter((r) => !r.ok);
  if (apply && drifted.length) {
    const statements: D1PreparedStatement[] = [];
    for (const r of drifted) {
      for (const d of r.drift) {
        statements.push(db.prepare("INSERT INTO data_source_counters (data_source_key,counter_key,value,updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(data_source_key,counter_key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')").bind(r.dataSource, d.key, d.actual));
      }
    }
    statements.push(auditStatement(db, actor, { action: "counters.rebuild", entityType: "data_source", entityId: drifted.map((r) => r.dataSource).join(","), outcome: "success", summary: `Rebuilt counters of ${drifted.map((r) => r.dataSource).join(", ")}`, details: { drift: drifted.map((r) => ({ dataSource: r.dataSource, drift: r.drift })) } }));
    await db.batch(statements);
  }
  return { applied: apply && drifted.length > 0, reports };
}

/** A data source's total, from its counter. Null when there is no counter (a table without a definition, or not backfilled). */
export async function counterTotal(db: D1Database, dataSource: string): Promise<number | null> {
  if (!COUNTER_DEFINITIONS.some((d) => d.dataSource === dataSource)) return null;
  const r = await db.prepare("SELECT value FROM data_source_counters WHERE data_source_key=? AND counter_key='total'").bind(dataSource).first<{ value: number }>();
  return r ? r.value : null;
}
