// Schema inspection and column adoption (Story 04, slice 04b).
//
// Inspection is read-only. Adoption writes configuration only: it maps an existing column to a new property.
// No operation here changes the physical schema (that is the schema change service, slice 04c on).
// Table and column names are checked against an allowlist pattern and quoted, never concatenated raw.

import type { Actor } from "../policy";
import { auditStatement } from "../audit";
import { PlatformError } from "../errors";
import { invalidateBootstrapCache } from "./bootstrap";
import { compareTable, isBlockedTable, isValidName, quote, SYSTEM_COLUMNS, type DataSourceReport } from "./compat";
import { newId } from "./ids";
import { insertStatement } from "./rows-sql";
import { readActiveRelease, releaseStatements } from "./release";
import { loadRows } from "./snapshot";
import { acceptedSqliteTypes, normalizeSettings, TYPE_CONTRACTS } from "./property-types";
import type { ConfigRows, PropertyType } from "./types";

/** D1 allows at most 100 columns per table. Warn from 80 so there is room to plan (Contracts section 9). */
export const COLUMN_LIMIT = 100;
export const COLUMN_WARN_AT = 80;
/** Row counts read at most ROW_COUNT_CAP + 1 rows, because an unbounded COUNT(*) reads the whole table. */
export const ROW_COUNT_CAP = 1000;

export type TableColumn = { name: string; sqliteType: string; notNull: boolean; primaryKey: boolean };
export type TableIndex = { name: string; unique: boolean; origin: "created" | "unique_constraint" | "primary_key"; partial: boolean; columns: string[] };

const ORIGIN: Record<string, TableIndex["origin"]> = { c: "created", u: "unique_constraint", pk: "primary_key" };

/** Types a column of this SQLite type can be adopted as: stored in a column and written by users. */
export function adoptableTypes(sqliteType: string): PropertyType[] {
  return (Object.keys(TYPE_CONTRACTS) as PropertyType[]).filter((t) => TYPE_CONTRACTS[t].physical === "column" && TYPE_CONTRACTS[t].writable && acceptedSqliteTypes(t).includes(sqliteType));
}

/**
 * A searchable property on a table over 1,000 rows needs an index that starts with its column, or a recorded
 * reason why not. Without one, a search reads the whole table (Contracts section 9).
 */
export async function assertSearchIndexRule(db: D1Database, table: string, column: string, exceptionReason: string | null): Promise<void> {
  if (exceptionReason) return;
  if ((await readIndexes(db, table)).some((i) => i.columns[0] === column)) return;
  if ((await countRows(db, table)).capped) {
    throw new PlatformError("INDEX_REQUIRED", `The table ${table} has more than ${ROW_COUNT_CAP} rows and no index starts with "${column}". Add an index first, or record why there is none (indexExceptionReason).`, 409, { table, column, rowLimit: ROW_COUNT_CAP });
  }
}

export async function readColumns(db: D1Database, table: string): Promise<TableColumn[]> {
  const info = await db.prepare(`PRAGMA table_info(${quote(table)})`).all<{ name: string; type: string; notnull: number; pk: number }>();
  return info.results.map((c) => ({ name: c.name, sqliteType: (c.type || "").toUpperCase(), notNull: c.notnull === 1, primaryKey: c.pk > 0 }));
}

export async function readIndexes(db: D1Database, table: string): Promise<TableIndex[]> {
  const list = await db.prepare(`PRAGMA index_list(${quote(table)})`).all<{ name: string; unique: number; origin: string; partial: number }>();
  const out: TableIndex[] = [];
  for (const ix of list.results) {
    const cols = await db.prepare(`PRAGMA index_info(${quote(ix.name)})`).all<{ seqno: number; name: string | null }>();
    out.push({ name: ix.name, unique: ix.unique === 1, origin: ORIGIN[ix.origin] ?? "created", partial: ix.partial === 1, columns: cols.results.sort((a, b) => a.seqno - b.seqno).map((c) => c.name ?? "(expression)") });
  }
  return out;
}

export async function countRows(db: D1Database, table: string): Promise<{ value: number; capped: boolean }> {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM ${quote(table)} LIMIT ${ROW_COUNT_CAP + 1})`).first<{ n: number }>();
  const n = r?.n ?? 0;
  return n > ROW_COUNT_CAP ? { value: ROW_COUNT_CAP, capped: true } : { value: n, capped: false };
}

export async function loadApplication(db: D1Database): Promise<{ id: string; rows: ConfigRows }> {
  const app = await db.prepare("SELECT id FROM cfg_application ORDER BY id LIMIT 1").first<{ id: string }>();
  if (!app) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet.", 404);
  const rows = await loadRows(db, app.id);
  if (!rows) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet.", 404);
  return { id: app.id, rows };
}

export function findDataSource(rows: ConfigRows, key: string) {
  const ds = rows.dataSources.find((d) => d.key === key);
  if (!ds) throw new PlatformError("DATA_SOURCE_NOT_FOUND", `There is no data source "${key}".`, 404);
  return ds;
}

const defOf = (rows: ConfigRows, ds: ConfigRows["dataSources"][number]) => ({ key: ds.key, tableName: ds.tableName, properties: rows.properties.filter((p) => p.dataSourceId === ds.id) });

export type SchemaReport = DataSourceReport & {
  columns: (TableColumn & { property: string | null; system: boolean })[];
  adoptable: { column: string; sqliteType: string; nullable: boolean; types: PropertyType[] }[];
  indexes: TableIndex[];
  capacity: { columns: number; limit: number; warnAt: number; remaining: number; state: "ok" | "warning" | "full" };
  rowCount: { value: number; capped: boolean } | null;
  /** Searchable properties that no index starts with and that have no recorded exception. A search on them reads the whole table. */
  searchWithoutIndex: { property: string; column: string }[];
};

/** Everything slice 04c needs to decide a change, for one data source. Reads one row per column, per index and per indexed column, plus at most 1,001 table rows. */
export async function inspectSchema(db: D1Database, dataSourceKey: string): Promise<SchemaReport> {
  const { rows } = await loadApplication(db);
  const ds = findDataSource(rows, dataSourceKey);
  const def = defOf(rows, ds);
  const empty = { columns: [], adoptable: [], indexes: [], capacity: { columns: 0, limit: COLUMN_LIMIT, warnAt: COLUMN_WARN_AT, remaining: COLUMN_LIMIT, state: "ok" as const }, rowCount: null, searchWithoutIndex: [] };
  if (isBlockedTable(ds.tableName)) {
    return { ...compareTable(def, new Map()), blockedTable: true, ...empty };
  }
  const columns = await readColumns(db, ds.tableName);
  const report = compareTable(def, new Map(columns.map((c) => [c.name, c.sqliteType])));
  if (!report.tableExists) return { ...report, ...empty };
  const byColumn = new Map(def.properties.map((p) => [p.columnName, p.key]));
  const [indexes, rowCount] = [await readIndexes(db, ds.tableName), await countRows(db, ds.tableName)];
  const n = columns.length;
  return {
    ...report,
    columns: columns.map((c) => ({ ...c, property: byColumn.get(c.name) ?? null, system: SYSTEM_COLUMNS.has(c.name) })),
    adoptable: columns.filter((c) => report.unmapped.some((u) => u.column === c.name) && !c.primaryKey && isValidName(c.name))
      .map((c) => ({ column: c.name, sqliteType: c.sqliteType, nullable: !c.notNull, types: adoptableTypes(c.sqliteType) })).filter((a) => a.types.length > 0),
    indexes,
    searchWithoutIndex: def.properties.filter((p) => p.searchable && !p.indexExceptionReason && !indexes.some((i) => i.columns[0] === p.columnName)).map((p) => ({ property: p.key, column: p.columnName })),
    capacity: { columns: n, limit: COLUMN_LIMIT, warnAt: COLUMN_WARN_AT, remaining: Math.max(0, COLUMN_LIMIT - n), state: n >= COLUMN_LIMIT ? "full" : n >= COLUMN_WARN_AT ? "warning" : "ok" },
    rowCount
  };
}

/**
 * Refuses a publish while the metadata of a data source disagrees with its table: a mapped column that is missing,
 * a mapped column of an incompatible type, a missing table or a blocked table. This is how metadata can never
 * expose a column that is absent from the physical schema.
 */
export async function assertNoDrift(db: D1Database, rows: ConfigRows, dataSourceId: string): Promise<void> {
  const ds = rows.dataSources.find((d) => d.id === dataSourceId);
  if (!ds) throw new PlatformError("DATA_SOURCE_NOT_FOUND", "The data source of this property no longer exists.", 404);
  if (isBlockedTable(ds.tableName)) throw new PlatformError("SCHEMA_DRIFT", `The table of ${ds.key} is not an approved data table.`, 409, { dataSource: ds.key });
  const columns = await readColumns(db, ds.tableName);
  const r = compareTable(defOf(rows, ds), new Map(columns.map((c) => [c.name, c.sqliteType])));
  if (!r.tableExists || r.missing.length || r.incompatible.length) {
    throw new PlatformError("SCHEMA_DRIFT", `The configuration of ${ds.key} does not match its table. Fix the mismatch before publishing a change.`, 409, { dataSource: ds.key, tableExists: r.tableExists, missing: r.missing, incompatible: r.incompatible });
  }
}

export type AdoptInput = {
  dataSource: string;
  column: string;
  type: PropertyType;
  /** If given, the change is refused unless this is still the active release version. */
  releaseVersion?: number;
  label?: string;
  description?: string | null;
  required?: boolean;
  defaultValue?: unknown;
  searchable?: boolean;
  sensitivity?: "normal" | "sensitive";
  config?: Record<string, unknown>;
};
const ADOPT_ALLOWED = ["dataSource", "column", "type", "releaseVersion", "label", "description", "required", "defaultValue", "searchable", "sensitivity", "config"];

const humanize = (column: string) => { const s = column.replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); };

/** Adds a property for a column that already exists. Metadata only: the table is not changed and no stored value is read or rewritten. */
export async function adoptColumn(db: D1Database, input: AdoptInput, actor: Actor | null) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new PlatformError("PROPERTY_INVALID", "Send a JSON object.", 400);
  for (const key of Object.keys(input)) if (!ADOPT_ALLOWED.includes(key)) throw new PlatformError("PROPERTY_INVALID", `"${key}" is not accepted here.`, 400, { field: key });
  if (typeof input.dataSource !== "string" || input.dataSource === "") throw new PlatformError("PROPERTY_INVALID", "dataSource is required.", 400, { field: "dataSource" });
  if (typeof input.column !== "string" || !isValidName(input.column)) throw new PlatformError("PROPERTY_INVALID", "column must be a column name: lower-case letters, digits and underscores, starting with a letter.", 400, { field: "column" });
  if (typeof input.type !== "string" || !TYPE_CONTRACTS[input.type]) throw new PlatformError("PROPERTY_INVALID", `Unknown property type "${String(input.type)}".`, 400, { field: "type" });
  if (input.releaseVersion !== undefined && !Number.isInteger(input.releaseVersion)) throw new PlatformError("PROPERTY_INVALID", "releaseVersion must be a whole number.", 400, { field: "releaseVersion" });
  if (input.label !== undefined && (typeof input.label !== "string" || input.label.trim().length < 1 || input.label.trim().length > 80)) throw new PlatformError("PROPERTY_INVALID", "The label must be 1 to 80 characters.", 400, { field: "label" });

  const { id: applicationId, rows } = await loadApplication(db);
  const ds = findDataSource(rows, input.dataSource);
  const active = await readActiveRelease(db, applicationId);
  if (!active) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet.", 404);
  if (input.releaseVersion !== undefined && input.releaseVersion !== active.version) {
    throw new PlatformError("STALE_RELEASE", `The configuration changed: release ${active.version} is active, not ${input.releaseVersion}. Reload and try again.`, 409, { activeVersion: active.version });
  }
  await assertNoDrift(db, rows, ds.id);

  const column = (await readColumns(db, ds.tableName)).find((c) => c.name === input.column);
  if (!column) throw new PlatformError("COLUMN_NOT_FOUND", `The table ${ds.tableName} has no column "${input.column}".`, 404, { column: input.column });
  if (SYSTEM_COLUMNS.has(column.name)) throw new PlatformError("COLUMN_RESERVED", `"${column.name}" is a platform-managed column and cannot become a property.`, 400, { column: column.name });
  const existing = rows.properties.filter((p) => p.dataSourceId === ds.id);
  if (existing.some((p) => p.columnName === column.name)) throw new PlatformError("ALREADY_MAPPED", `The column "${column.name}" already has a property.`, 409, { column: column.name });
  if (column.primaryKey) throw new PlatformError("COLUMN_RESERVED", `"${column.name}" is the primary key and is already mapped by the data source.`, 400, { column: column.name });
  if (existing.some((p) => p.key === column.name)) throw new PlatformError("PROPERTY_EXISTS", `A property with the key "${column.name}" already exists in ${ds.key}.`, 409, { key: column.name });
  const allowed = adoptableTypes(column.sqliteType);
  if (!allowed.includes(input.type)) {
    throw new PlatformError("TYPE_INCOMPATIBLE", `A ${column.sqliteType || "typeless"} column cannot be adopted as ${input.type}. Choose one of: ${allowed.join(", ") || "none"}.`, 400, { column: column.name, sqliteType: column.sqliteType, allowed });
  }

  const settings = normalizeSettings({ type: input.type, description: input.description, required: input.required, defaultValue: input.defaultValue, searchable: input.searchable, sensitivity: input.sensitivity, config: input.config ?? {} });
  const label = input.label !== undefined ? input.label.trim() : humanize(column.name);
  const position = existing.reduce((m, p) => Math.max(m, p.position), 0) + 1;
  const row = { id: newId("property"), dataSourceId: ds.id, key: column.name, label, columnName: column.name, type: input.type, nullable: !column.notNull, position, ...settings };

  const now = new Date().toISOString();
  const by = actor ? actor.id : null;
  const summary = `Adopted ${ds.key}.${column.name} as ${input.type}`;
  const { statements, releaseVersion } = await releaseStatements(db, { applicationId, active, rows: { ...rows, properties: [...rows.properties, row] }, summary, now, by });
  try {
    await db.batch([
      insertStatement(db, "property", row, applicationId, { now, by }),
      ...statements,
      auditStatement(db, actor, { action: "property.adopt", entityType: "property", entityId: row.id, outcome: "success", summary, details: { dataSource: ds.key, column: column.name, type: input.type, releaseVersion } })
    ]);
  } catch {
    throw new PlatformError("UPDATE_FAILED", "The change could not be written because the configuration changed at the same time. Reload and try again.", 409);
  }
  invalidateBootstrapCache();
  return { status: "applied" as const, property: { ...row, dataSource: ds.key }, releaseVersion };
}
