// Schema change service (Story 04, slices 04c and 04d). A closed list of operations. No operation accepts SQL text.
// Every statement is generated from validated parameters: identifiers match an allowlist pattern and are
// quoted, column types come from a fixed map, and values are bound parameters.
//
// Operations: add_property, add_index, drop_index, hide_property, convert_presentation.
// Operations that rewrite stored data (drop a column, change what stored values mean) are not in the list.
// They need preview, backup and recovery, which Phase B provides.
//
// Modes
//   guided_live          Apply runs one db.batch(): the physical change (if any), the configuration change, a new release
//                        (if the configuration changed), the log row and an audit event. D1 runs a batch as one
//                        transaction, so a failure undoes all of it (checked in test/schema-change.test.ts).
//   migration_controlled The Worker cannot write repository files. For a physical change, the first apply returns the
//                        migration file name and text and records the change as "awaiting_migration". The maintainer
//                        commits the file, the deployment applies it, and a second apply with the same operation ID checks
//                        that the database shows the physical change, then publishes the configuration. The release is
//                        therefore never published before the schema it describes. Changes without a physical part
//                        (hide_property, convert_presentation) apply at once in either mode.
// If a change is interrupted in a way that leaves a column without a property, the column shows up as unmapped and
// Add as property (adoptColumn) recovers it.

import type { Actor } from "../policy";
import { auditStatement } from "../audit";
import { PlatformError } from "../errors";
import { canonicalJson } from "./canonical";
import { invalidateBootstrapCache } from "./bootstrap";
import { isBlockedTable, isValidName, quote, SYSTEM_COLUMNS } from "./compat";
import { newId, sha256Hex } from "./ids";
import { insertStatement } from "./rows-sql";
import { readActiveRelease, releaseStatements, type ActiveRelease } from "./release";
import { COLUMN_LIMIT, COLUMN_WARN_AT, ROW_COUNT_CAP, countRows, findDataSource, loadApplication, readColumns, readIndexes, type TableIndex } from "./schema-inspect";
import { checkOptionChanges, normalizeSettings, optionsOf, TYPE_CONTRACTS, validateValue } from "./property-types";
import type { ConfigRows, PropertySettings, PropertyType } from "./types";

export const OPERATIONS = ["add_property", "add_index", "drop_index", "hide_property", "convert_presentation"] as const;
export type Operation = (typeof OPERATIONS)[number];
export const MODES = ["guided_live", "migration_controlled"] as const;
export type Mode = (typeof MODES)[number];

/** Types add_property can create. Relation, multi-select and server-assigned types need more than one column or extra steps and come later. */
const ADDABLE: PropertyType[] = ["text", "title", "number", "currency", "select", "status", "date", "timestamp", "checkbox", "email", "phone", "url"];
/** Text-stored types whose values keep their meaning when one is converted to another. */
const TEXT_LIKE: PropertyType[] = ["text", "title", "email", "phone", "url"];
const OPTION_LIKE: PropertyType[] = ["select", "status"];
const RESERVED_COLUMNS = new Set(["id", "rowid", "oid", "_rowid_", "created_at", "updated_at", ...SYSTEM_COLUMNS]);
const OPERATION_ID = /^[A-Za-z0-9_-]{8,64}$/;
const INDEX_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_INDEX_COLUMNS = 3;
const INDEX_WARN_AT = 6;
const EXAMPLE_LIMIT = 20;

type Params = Record<string, unknown>;
export type ChangeRequest = { operation: Operation; mode?: Mode; params: Params };

const PARAM_KEYS: Record<Operation, string[]> = {
  add_property: ["dataSource", "key", "columnName", "label", "type", "description", "required", "defaultValue", "searchable", "sensitivity", "indexExceptionReason", "config"],
  add_index: ["dataSource", "name", "columns", "unique"],
  drop_index: ["dataSource", "index"],
  hide_property: ["dataSource", "property", "hidden"],
  convert_presentation: ["dataSource", "property", "to", "config", "defaultValue"]
};

function bad(message: string, field: string, status = 400): never { throw new PlatformError("SCHEMA_CHANGE_INVALID", message, status, { field }); }
const str = (p: Params, key: string): string => (typeof p[key] === "string" && (p[key] as string) !== "" ? (p[key] as string) : bad(`${key} is required.`, key));

function sqliteTypeFor(type: PropertyType, config: Record<string, unknown>): "TEXT" | "INTEGER" | "REAL" {
  if (type === "currency" || type === "checkbox") return "INTEGER";
  if (type === "number") return config.integer === false ? "REAL" : "INTEGER";
  return "TEXT";
}

export type Conversion = {
  from: PropertyType; to: PropertyType;
  /** Rows (or, for option types, distinct values) read to check the stored values. */
  checked: number;
  /** True when there were more than ROW_COUNT_CAP values, so not every value could be checked. */
  capped: boolean;
  nonConforming: { count: number; examples: { id: string | number | null; reason: string; value?: string }[] };
};

export type Plan = {
  operation: Operation;
  mode: Mode;
  dataSource: string;
  table: string;
  summary: string;
  /** The generated statement, or null when the change is configuration only. */
  sql: string | null;
  property?: { key: string; label: string; columnName: string; type: PropertyType; nullable?: boolean; position?: number; hidden?: boolean; config?: Record<string, unknown> };
  index?: { name: string; columns: string[]; unique: boolean; existing: number; after: number };
  conversion?: Conversion;
  /** Existing rows are not rewritten by any operation in this list. */
  affectedRows: { existing: number; capped: boolean; rewritten: 0 } | null;
  capacity?: { before: number; after: number; limit: number; warnAt: number; remainingAfter: number; warning: boolean };
  warnings: string[];
  /** Set when apply would be refused. Preview still returns the plan so the reasons can be shown. */
  blocked: string | null;
  /** These operations lose no data, so none needs a backup. Operations that would are not available (Phase B). */
  backupRequired: false;
  publishesRelease: boolean;
  releaseVersion: number;
  migration: { fileName: string; sql: string } | null;
  planHash: string;
};

type Prepared = {
  plan: Plan; applicationId: string; active: ActiveRelease; paramsJson: string; entityType: string; entityId: string;
  /** The physical statement to run in guided_live mode. Null when there is none, or when finalizing a migration. */
  physical: string | null;
  config: ((db: D1Database, applicationId: string, stamp: { now: string; by: string | null }) => D1PreparedStatement[]) | null;
  rows: ConfigRows | null;
  /** True when the database already shows the physical change. Used to finalize migration_controlled changes. */
  physicalPresent: ((db: D1Database) => Promise<boolean>) | null;
};

type Context = Awaited<ReturnType<typeof context>>;

async function context(db: D1Database, p: Params) {
  const { id: applicationId, rows } = await loadApplication(db);
  const ds = findDataSource(rows, str(p, "dataSource"));
  if (isBlockedTable(ds.tableName)) throw new PlatformError("SCHEMA_DRIFT", `The table of ${ds.key} is not an approved data table.`, 409, { dataSource: ds.key });
  const active = await readActiveRelease(db, applicationId);
  if (!active) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet.", 404);
  const columns = await readColumns(db, ds.tableName);
  if (columns.length === 0) throw new PlatformError("SCHEMA_DRIFT", `The table ${ds.tableName} does not exist.`, 409, { dataSource: ds.key });
  const existing = rows.properties.filter((x) => x.dataSourceId === ds.id);
  const names = new Set(columns.map((c) => c.name));
  const missing = existing.filter((x) => TYPE_CONTRACTS[x.type]?.physical !== "junction" && !names.has(x.columnName));
  if (missing.length) throw new PlatformError("SCHEMA_DRIFT", `The configuration of ${ds.key} does not match its table. Fix the mismatch before changing the schema.`, 409, { dataSource: ds.key, missing: missing.map((x) => ({ property: x.key, column: x.columnName })) });
  return { applicationId, rows, ds, active, columns, existing, names };
}

async function nextMigrationName(db: D1Database, operation: string, table: string, thing: string): Promise<string> {
  let max = 0;
  try {
    const r = await db.prepare("SELECT name FROM d1_migrations").all<{ name: string }>();
    for (const row of r.results) { const m = /^(\d+)_/.exec(row.name); if (m) max = Math.max(max, Number(m[1])); }
  } catch { /* no migration table: the first number is used */ }
  const slug = `${operation}_${table}_${thing}`.replace(/[^a-z0-9_]/g, "_").slice(0, 80);
  return `${String(max + 1).padStart(4, "0")}_${slug}.sql`;
}

function migrationText(operation: string, sql: string): string {
  return `-- Generated by the schema change service (${operation}).\n-- Review, commit under backend/migrations, and let the deployment apply it.\n-- Then repeat the apply request with the same operation ID to publish the configuration change.\n${sql};\n`;
}

/** Final plan fields shared by every operation. */
async function finish(db: D1Database, mode: Mode, request: ChangeRequest, base: Omit<Plan, "mode" | "migration" | "planHash" | "backupRequired" | "warnings" | "blocked"> & { warnings?: string[]; blocked?: string | null }, ctx: Context, thing: string, finalize: boolean): Promise<{ plan: Plan; paramsJson: string }> {
  const migration = mode === "migration_controlled" && base.sql ? { fileName: await nextMigrationName(db, request.operation, base.table, thing), sql: migrationText(request.operation, base.sql) } : null;
  const paramsJson = canonicalJson({ operation: request.operation, mode, params: request.params });
  const draft = { ...base, mode, warnings: base.warnings ?? [], blocked: base.blocked ?? null, backupRequired: false as const, migration, planHash: "" };
  const planHash = await sha256Hex(canonicalJson({ paramsJson, sql: base.sql, columns: ctx.columns.length, release: ctx.active.version, conversion: base.conversion ?? null, finalize }));
  return { plan: { ...draft, planHash }, paramsJson };
}

// ---------------------------------------------------------------------------------------------
// add_property

async function prepareAddProperty(db: D1Database, request: ChangeRequest, mode: Mode, finalize: boolean): Promise<Prepared> {
  const p = request.params;
  const key = str(p, "key");
  if (!isValidName(key)) bad("key must be lower-case letters, digits and underscores, starting with a letter, at most 64 characters.", "key");
  const columnName = p.columnName === undefined ? key : p.columnName;
  if (typeof columnName !== "string" || !isValidName(columnName)) bad("columnName must be lower-case letters, digits and underscores, starting with a letter, at most 64 characters.", "columnName");
  if (RESERVED_COLUMNS.has(columnName)) bad(`"${columnName}" is reserved for the platform.`, "columnName");
  const type = p.type as PropertyType;
  if (typeof type !== "string" || !TYPE_CONTRACTS[type]) bad(`Unknown property type "${String(type)}".`, "type");
  if (!ADDABLE.includes(type)) throw new PlatformError("TYPE_UNAVAILABLE", `${TYPE_CONTRACTS[type].label} properties cannot be added yet. Available: ${ADDABLE.join(", ")}.`, 400, { field: "type", available: ADDABLE });
  if (p.label !== undefined && (typeof p.label !== "string" || p.label.trim().length < 1 || p.label.trim().length > 80)) bad("The label must be 1 to 80 characters.", "label");

  const ctx = await context(db, p);
  const { ds, rows, existing, columns } = ctx;
  const settings = normalizeSettings({ type, description: p.description as never, required: p.required as never, defaultValue: p.defaultValue, searchable: p.searchable as never, sensitivity: p.sensitivity as never, indexExceptionReason: p.indexExceptionReason as never, config: (p.config as Record<string, unknown>) ?? {} });
  const sqliteType = sqliteTypeFor(type, settings.config);
  const found = columns.find((c) => c.name === columnName);
  if (finalize) {
    if (!found || found.sqliteType !== sqliteType) throw new PlatformError("MIGRATION_NOT_APPLIED", `The table does not show the column "${columnName}" as ${sqliteType} yet.`, 409);
  } else {
    if (found) throw new PlatformError("COLUMN_EXISTS", `The table already has a column "${columnName}". Use Add as property to map it.`, 409, { column: columnName });
    if (columns.length >= COLUMN_LIMIT) throw new PlatformError("COLUMN_LIMIT", `The table ${ds.tableName} has ${columns.length} columns, the maximum is ${COLUMN_LIMIT}.`, 409, { columns: columns.length, limit: COLUMN_LIMIT, remaining: 0 });
  }
  if (existing.some((x) => x.key === key)) throw new PlatformError("PROPERTY_EXISTS", `A property with the key "${key}" already exists in ${ds.key}.`, 409, { key });
  const count = await countRows(db, ds.tableName);
  if (settings.searchable && !settings.indexExceptionReason && count.capped) {
    throw new PlatformError("INDEX_REQUIRED", `The table ${ds.tableName} has more than ${ROW_COUNT_CAP} rows. A new column has no index, so it cannot be searchable unless an indexExceptionReason is recorded. Add the property, add an index, then turn search on.`, 409, { table: ds.tableName, column: columnName, rowLimit: ROW_COUNT_CAP });
  }
  const label = p.label !== undefined ? (p.label as string).trim() : key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
  const position = existing.reduce((m, x) => Math.max(m, x.position), 0) + 1;
  const after = finalize ? columns.length : columns.length + 1;
  const row = { id: newId("property"), dataSourceId: ds.id, key, label, columnName, type, nullable: true, position, ...settings };
  const sql = `ALTER TABLE ${quote(ds.tableName)} ADD COLUMN ${quote(columnName)} ${sqliteType}`;
  const { plan, paramsJson } = await finish(db, mode, request, {
    operation: "add_property", dataSource: ds.key, table: ds.tableName, sql,
    summary: `Added ${ds.key}.${key} as ${type} (column ${columnName})`,
    property: { key, label, columnName, type, nullable: true, position, config: settings.config },
    // SQLite adds the column with NULL for every row, without reading or rewriting them.
    affectedRows: { existing: count.value, capped: count.capped, rewritten: 0 },
    capacity: { before: after - 1, after, limit: COLUMN_LIMIT, warnAt: COLUMN_WARN_AT, remainingAfter: COLUMN_LIMIT - after, warning: after >= COLUMN_WARN_AT },
    publishesRelease: true, releaseVersion: ctx.active.version + 1
  }, ctx, columnName, finalize);
  return {
    plan, applicationId: ctx.applicationId, active: ctx.active, paramsJson, entityType: "property", entityId: String(row.id),
    physical: finalize || mode === "migration_controlled" ? null : sql,
    config: (d, appId, s) => [insertStatement(d, "property", row as never, appId, s)],
    rows: { ...rows, properties: [...rows.properties, row as never] },
    physicalPresent: async (d) => (await readColumns(d, ds.tableName)).some((c) => c.name === columnName && c.sqliteType === sqliteType)
  };
}

// ---------------------------------------------------------------------------------------------
// add_index and drop_index

const sameColumns = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c === b[i]);

async function prepareAddIndex(db: D1Database, request: ChangeRequest, mode: Mode, finalize: boolean): Promise<Prepared> {
  const p = request.params;
  if (!Array.isArray(p.columns) || p.columns.length < 1 || p.columns.length > MAX_INDEX_COLUMNS || p.columns.some((c) => typeof c !== "string")) bad(`columns must list 1 to ${MAX_INDEX_COLUMNS} property keys.`, "columns");
  if (new Set(p.columns as string[]).size !== p.columns.length) bad("columns must not repeat a property.", "columns");
  if (p.unique !== undefined && typeof p.unique !== "boolean") bad("unique must be true or false.", "unique");
  if (p.unique === true) throw new PlatformError("UNIQUE_INDEX_UNAVAILABLE", "Unique indexes need a check for existing duplicates and are not available yet.", 400, { field: "unique" });
  const ctx = await context(db, p);
  const { ds, existing } = ctx;
  const columns = (p.columns as string[]).map((key) => {
    const prop = existing.find((x) => x.key === key);
    if (!prop) throw new PlatformError("PROPERTY_NOT_FOUND", `${ds.key} has no property "${key}".`, 404, { field: "columns", key });
    if (TYPE_CONTRACTS[prop.type].physical !== "column") bad(`"${key}" is not stored in a column of this table, so it cannot be indexed here.`, "columns");
    return prop.columnName;
  });
  const name = p.name === undefined ? `idx_${ds.tableName}_${columns.join("_")}` : p.name;
  if (typeof name !== "string" || !/^idx_[a-z0-9_]{1,59}$/.test(name)) bad("The index name must start with idx_ and use lower-case letters, digits and underscores, at most 64 characters. Send a shorter name.", "name");
  const indexes = await readIndexes(db, ds.tableName);
  const same = indexes.find((i) => sameColumns(i.columns, columns));
  const present = indexes.find((i) => i.name === name && sameColumns(i.columns, columns));
  if (finalize) {
    if (!present) throw new PlatformError("MIGRATION_NOT_APPLIED", `The table does not show the index "${name}" yet.`, 409);
  } else {
    if (indexes.some((i) => i.name === name)) throw new PlatformError("INDEX_EXISTS", `An index named "${name}" already exists.`, 409, { index: name });
    if (same) throw new PlatformError("INDEX_EXISTS", `The index "${same.name}" already covers these columns.`, 409, { index: same.name });
  }
  const count = await countRows(db, ds.tableName);
  const after = finalize ? indexes.length : indexes.length + 1;
  const warnings = [`Every record write on ${ds.tableName} will write one more index row. The budget is 10 rows per record write.`];
  if (after >= INDEX_WARN_AT) warnings.push(`${ds.tableName} will have ${after} indexes. Check the rows written by a record create before adding more.`);
  if (count.capped) warnings.push(`${ds.tableName} has more than ${ROW_COUNT_CAP} rows. Building the index reads the whole table once.`);
  const sql = `CREATE INDEX ${quote(name)} ON ${quote(ds.tableName)} (${columns.map(quote).join(", ")})`;
  const { plan, paramsJson } = await finish(db, mode, request, {
    operation: "add_index", dataSource: ds.key, table: ds.tableName, sql, summary: `Added index ${name} on ${ds.tableName} (${columns.join(", ")})`,
    index: { name, columns, unique: false, existing: indexes.length, after },
    affectedRows: { existing: count.value, capped: count.capped, rewritten: 0 }, warnings,
    publishesRelease: false, releaseVersion: ctx.active.version
  }, ctx, name.replace(/^idx_/, ""), finalize);
  return {
    plan, applicationId: ctx.applicationId, active: ctx.active, paramsJson, entityType: "data_source", entityId: ds.key,
    physical: finalize || mode === "migration_controlled" ? null : sql, config: null, rows: null,
    physicalPresent: async (d) => (await readIndexes(d, ds.tableName)).some((i) => i.name === name && sameColumns(i.columns, columns))
  };
}

async function prepareDropIndex(db: D1Database, request: ChangeRequest, mode: Mode, finalize: boolean): Promise<Prepared> {
  const p = request.params;
  const name = str(p, "index");
  if (!INDEX_NAME.test(name)) bad("index must be an index name: lower-case letters, digits and underscores.", "index");
  const ctx = await context(db, p);
  const { ds, existing } = ctx;
  const indexes = await readIndexes(db, ds.tableName);
  const target = indexes.find((i) => i.name === name);
  if (finalize) {
    if (target) throw new PlatformError("MIGRATION_NOT_APPLIED", `The table still shows the index "${name}".`, 409);
  } else {
    if (!target) throw new PlatformError("INDEX_NOT_FOUND", `${ds.tableName} has no index "${name}".`, 404, { index: name });
    if (target.origin !== "created") throw new PlatformError("INDEX_PROTECTED", `"${name}" belongs to the table definition (primary key or unique constraint) and cannot be dropped.`, 409, { index: name });
    if (target.unique) throw new PlatformError("INDEX_ENFORCES_CONSTRAINT", `"${name}" is unique and enforces a rule on the data. Dropping it would remove that rule.`, 409, { index: name, columns: target.columns });
    const others = indexes.filter((i) => i.name !== name);
    const needed = existing.filter((x) => x.searchable && !x.indexExceptionReason && x.columnName === target.columns[0] && !others.some((i) => i.columns[0] === x.columnName));
    if (needed.length) throw new PlatformError("INDEX_IN_USE", `"${name}" is the only index for the searchable ${needed.map((x) => x.key).join(", ")}. Turn search off or record an indexExceptionReason first.`, 409, { index: name, properties: needed.map((x) => x.key) });
  }
  const count = await countRows(db, ds.tableName);
  const sql = `DROP INDEX ${quote(name)}`;
  const { plan, paramsJson } = await finish(db, mode, request, {
    operation: "drop_index", dataSource: ds.key, table: ds.tableName, sql, summary: `Dropped index ${name} on ${ds.tableName}`,
    index: { name, columns: target?.columns ?? [], unique: false, existing: indexes.length, after: finalize ? indexes.length : indexes.length - 1 },
    affectedRows: { existing: count.value, capped: count.capped, rewritten: 0 },
    warnings: ["Queries that used this index will read more rows. The index can be created again."],
    publishesRelease: false, releaseVersion: ctx.active.version
  }, ctx, name.replace(/^idx_/, ""), finalize);
  return {
    plan, applicationId: ctx.applicationId, active: ctx.active, paramsJson, entityType: "data_source", entityId: ds.key,
    physical: finalize || mode === "migration_controlled" ? null : sql, config: null, rows: null,
    physicalPresent: async (d) => !(await readIndexes(d, ds.tableName)).some((i) => i.name === name)
  };
}

// ---------------------------------------------------------------------------------------------
// hide_property and convert_presentation (configuration only)

function findProperty(ctx: Context, p: Params) {
  const key = str(p, "property");
  const prop = ctx.existing.find((x) => x.key === key);
  if (!prop) throw new PlatformError("PROPERTY_NOT_FOUND", `${ctx.ds.key} has no property "${key}".`, 404, { field: "property", key });
  return prop;
}

async function prepareHide(db: D1Database, request: ChangeRequest, mode: Mode): Promise<Prepared> {
  const p = request.params;
  if (typeof p.hidden !== "boolean") bad("hidden must be true or false.", "hidden");
  const ctx = await context(db, p);
  const prop = findProperty(ctx, p);
  if (prop.hidden === p.hidden) throw new PlatformError("NO_CHANGE", `"${prop.key}" is already ${p.hidden ? "hidden" : "visible"}.`, 409, { property: prop.key });
  if (p.hidden && prop.required && prop.defaultValue === null) throw new PlatformError("PROPERTY_REQUIRED", `"${prop.key}" is required and has no default value. Hiding it would make forms that leave it out impossible to save. Give it a default or make it optional first.`, 409, { property: prop.key });
  const rows = { ...ctx.rows, properties: ctx.rows.properties.map((x) => (x.id === prop.id ? { ...x, hidden: p.hidden as boolean } : x)) };
  const { plan, paramsJson } = await finish(db, mode, request, {
    operation: "hide_property", dataSource: ctx.ds.key, table: ctx.ds.tableName, sql: null,
    summary: `${p.hidden ? "Hid" : "Showed"} ${ctx.ds.key}.${prop.key}`,
    property: { key: prop.key, label: prop.label, columnName: prop.columnName, type: prop.type, hidden: p.hidden },
    affectedRows: null, warnings: p.hidden ? ["The column and its data stay in the table. The property is left out of forms and lists."] : [],
    publishesRelease: true, releaseVersion: ctx.active.version + 1
  }, ctx, prop.key, false);
  return {
    plan, applicationId: ctx.applicationId, active: ctx.active, paramsJson, entityType: "property", entityId: prop.id, physical: null, rows, physicalPresent: null,
    config: (d, _a, s) => [d.prepare("UPDATE cfg_property SET hidden=?, updated_at=?, updated_by=? WHERE id=?").bind(p.hidden ? 1 : 0, s.now, s.by, prop.id)]
  };
}

/** Checks stored values against the new type. Reads at most ROW_COUNT_CAP + 1 values. Reports row IDs and reasons, never the values of text, email or phone columns. */
async function checkStoredValues(db: D1Database, table: string, primaryKey: string, column: string, to: PropertyType, config: Record<string, unknown>): Promise<Conversion["nonConforming"] & { checked: number; capped: boolean }> {
  const examples: Conversion["nonConforming"]["examples"] = [];
  let count = 0;
  if (OPTION_LIKE.includes(to)) {
    const keys = new Set(optionsOf(config).map((o) => o.key));
    const r = await db.prepare(`SELECT DISTINCT ${quote(column)} AS v FROM ${quote(table)} WHERE ${quote(column)} IS NOT NULL LIMIT ${ROW_COUNT_CAP + 1}`).all<{ v: unknown }>();
    const capped = r.results.length > ROW_COUNT_CAP;
    for (const { v } of r.results.slice(0, ROW_COUNT_CAP)) {
      if (typeof v === "string" && keys.has(v)) continue;
      count += 1;
      if (examples.length < EXAMPLE_LIMIT) examples.push({ id: null, reason: "The stored value is not one of the options.", value: String(v).slice(0, 40) });
    }
    return { count, examples, checked: Math.min(r.results.length, ROW_COUNT_CAP), capped };
  }
  const r = await db.prepare(`SELECT ${quote(primaryKey)} AS id, ${quote(column)} AS v FROM ${quote(table)} WHERE ${quote(column)} IS NOT NULL LIMIT ${ROW_COUNT_CAP + 1}`).all<{ id: string | number; v: unknown }>();
  const capped = r.results.length > ROW_COUNT_CAP;
  for (const { id, v } of r.results.slice(0, ROW_COUNT_CAP)) {
    if (typeof v === "string" && v.trim() === "") continue;
    const result = typeof v === "string" ? validateValue({ type: to, config, required: false }, v) : ({ ok: false, message: "The stored value is not text." } as const);
    let reason: string | null = null;
    if (!result.ok) reason = result.message;
    else if (result.value !== v) reason = "The stored value is not in the normalized form.";
    if (reason === null) continue;
    count += 1;
    if (examples.length < EXAMPLE_LIMIT) examples.push({ id, reason });
  }
  return { count, examples, checked: Math.min(r.results.length, ROW_COUNT_CAP), capped };
}

async function prepareConvert(db: D1Database, request: ChangeRequest, mode: Mode): Promise<Prepared> {
  const p = request.params;
  const to = p.to as PropertyType;
  if (typeof to !== "string" || !TYPE_CONTRACTS[to]) bad(`Unknown property type "${String(to)}".`, "to");
  const ctx = await context(db, p);
  const prop = findProperty(ctx, p);
  const from = prop.type;
  if (from === to) throw new PlatformError("NO_CHANGE", `"${prop.key}" is already ${to}.`, 409, { property: prop.key });
  const ok = (TEXT_LIKE.includes(from) && TEXT_LIKE.includes(to)) || (OPTION_LIKE.includes(from) && OPTION_LIKE.includes(to));
  if (!ok) throw new PlatformError("CONVERSION_REWRITES_DATA", `Converting ${from} to ${to} would change what the stored values mean or how they are stored. That needs preview, backup and recovery, which come with Phase B.`, 409, { from, to, allowed: TEXT_LIKE.includes(from) ? TEXT_LIKE : OPTION_LIKE.includes(from) ? OPTION_LIKE : [] });
  if (!TEXT_LIKE.includes(from) && p.config === undefined) bad("config is required: send the options of the new type. Every existing option key must be kept.", "config");
  const config = p.config !== undefined ? (p.config as Record<string, unknown>) : typeof prop.config.maxLength === "number" ? { maxLength: prop.config.maxLength } : {};
  const next: PropertySettings = normalizeSettings({ type: to, description: prop.description, required: prop.required, defaultValue: p.defaultValue !== undefined ? p.defaultValue : prop.defaultValue, searchable: prop.searchable, sensitivity: prop.sensitivity, hidden: prop.hidden, indexExceptionReason: prop.indexExceptionReason, config });
  if (OPTION_LIKE.includes(from)) checkOptionChanges(optionsOf(prop.config), optionsOf(next.config));

  const stored = await checkStoredValues(db, ctx.ds.tableName, ctx.ds.primaryKey, prop.columnName, to, next.config);
  const conversion: Conversion = { from, to, checked: stored.checked, capped: stored.capped, nonConforming: { count: stored.count, examples: stored.examples } };
  const count = await countRows(db, ctx.ds.tableName);
  const blocked = stored.count > 0 ? `${stored.count} stored value${stored.count === 1 ? " does" : "s do"} not fit ${to}. Fix them first.`
    : stored.capped ? `More than ${ROW_COUNT_CAP} values are stored, so they cannot all be checked here. Larger tables are checked in Phase B.` : null;
  const rows = { ...ctx.rows, properties: ctx.rows.properties.map((x) => (x.id === prop.id ? { ...x, type: to, ...next } : x)) };
  const { plan, paramsJson } = await finish(db, mode, request, {
    operation: "convert_presentation", dataSource: ctx.ds.key, table: ctx.ds.tableName, sql: null,
    summary: `Converted ${ctx.ds.key}.${prop.key} from ${from} to ${to}`,
    property: { key: prop.key, label: prop.label, columnName: prop.columnName, type: to, config: next.config },
    conversion, affectedRows: { existing: count.value, capped: count.capped, rewritten: 0 }, blocked,
    warnings: ["No stored value is changed. Only how the value is validated and shown changes."],
    publishesRelease: true, releaseVersion: ctx.active.version + 1
  }, ctx, prop.key, false);
  return {
    plan, applicationId: ctx.applicationId, active: ctx.active, paramsJson, entityType: "property", entityId: prop.id, physical: null, rows, physicalPresent: null,
    config: (d, _a, s) => [d.prepare("UPDATE cfg_property SET type=?, default_json=?, config_json=?, updated_at=?, updated_by=? WHERE id=?")
      .bind(to, next.defaultValue === null || next.defaultValue === undefined ? null : canonicalJson(next.defaultValue), canonicalJson(next.config), s.now, s.by, prop.id)]
  };
}

// ---------------------------------------------------------------------------------------------
// Request handling

async function prepare(db: D1Database, request: ChangeRequest, finalize = false): Promise<Prepared> {
  if (typeof request !== "object" || request === null || Array.isArray(request)) throw new PlatformError("SCHEMA_CHANGE_INVALID", "Send a JSON object.", 400);
  for (const k of Object.keys(request)) if (!["operation", "mode", "params", "operationId", "confirm", "planHash"].includes(k)) throw new PlatformError("SCHEMA_CHANGE_INVALID", `"${k}" is not accepted. SQL and other free text are not accepted.`, 400, { field: k });
  if (!OPERATIONS.includes(request.operation)) throw new PlatformError("SCHEMA_CHANGE_INVALID", `Unknown operation. Available: ${OPERATIONS.join(", ")}.`, 400, { field: "operation", available: OPERATIONS });
  const mode: Mode = request.mode ?? "guided_live";
  if (!MODES.includes(mode)) bad(`mode must be one of: ${MODES.join(", ")}.`, "mode");
  const p = request.params;
  if (typeof p !== "object" || p === null || Array.isArray(p)) bad("params must be an object.", "params");
  for (const k of Object.keys(p)) if (!PARAM_KEYS[request.operation].includes(k)) bad(`"${k}" is not a parameter of ${request.operation}. SQL and other free text are not accepted.`, k);
  switch (request.operation) {
    case "add_property": return prepareAddProperty(db, request, mode, finalize);
    case "add_index": return prepareAddIndex(db, request, mode, finalize);
    case "drop_index": return prepareDropIndex(db, request, mode, finalize);
    case "hide_property": return prepareHide(db, request, mode);
    case "convert_presentation": return prepareConvert(db, request, mode);
  }
}

/** Read-only. Shows the SQL, the migration text (migration_controlled), the affected rows, any blocking reason and the plan hash. */
export async function previewChange(db: D1Database, request: ChangeRequest): Promise<Plan> {
  return (await prepare(db, request)).plan;
}

export type ApplyRequest = ChangeRequest & { operationId: string; confirm: boolean; planHash?: string };
export type ApplyResult = { status: "applied" | "awaiting_migration"; repeated: boolean; operationId: string; releaseVersion: number; plan: Plan; message?: string };

/** Migrations 0007 and 0008 can reach the database a moment after the code that needs them is deployed. Say so, do not fail with a raw error. */
async function withLogTable<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (err) {
    if (err instanceof Error && /no such (table: schema_change_log|column: (status|migration_file))/i.test(err.message)) throw new PlatformError("MIGRATION_PENDING", "The schema change log is not up to date yet. Apply migrations 0007 and 0008 and try again.", 503);
    throw err;
  }
}

type Stored = { request_hash: string; result_json: string; status: "applied" | "awaiting_migration" };
const readStored = (db: D1Database, operationId: string) =>
  withLogTable(() => db.prepare("SELECT request_hash, result_json, status FROM schema_change_log WHERE id = ?").bind(operationId).first<Stored>());

const LOG_INSERT = "INSERT INTO schema_change_log (id,application_id,operation,data_source_key,mode,request_hash,params_json,sql_text,result_json,release_version,created_at,created_by,status,migration_file) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

export async function applyChange(db: D1Database, request: ApplyRequest, actor: Actor | null): Promise<ApplyResult> {
  if (typeof request !== "object" || request === null || Array.isArray(request)) throw new PlatformError("SCHEMA_CHANGE_INVALID", "Send a JSON object.", 400);
  if (typeof request.operationId !== "string" || !OPERATION_ID.test(request.operationId)) bad("operationId is required: 8 to 64 letters, digits, underscores or hyphens. Create a new one for each change.", "operationId");
  if (request.confirm !== true) throw new PlatformError("CONFIRMATION_REQUIRED", "Show the preview to the user and send confirm: true to apply it.", 400, { field: "confirm" });
  const { operationId, confirm: _c, planHash: expectedHash, ...rest } = request;
  for (const k of Object.keys(rest)) if (!["operation", "mode", "params"].includes(k)) throw new PlatformError("SCHEMA_CHANGE_INVALID", `"${k}" is not accepted. SQL and other free text are not accepted.`, 400, { field: k });

  const mode: Mode = rest.mode ?? "guided_live";
  const requestHash = await sha256Hex(canonicalJson({ operation: rest.operation, mode, params: rest.params }));
  const stored = await readStored(db, operationId);
  if (stored && stored.request_hash !== requestHash) throw new PlatformError("OPERATION_ID_REUSED", "This operation ID was already used for a different change. Use a new operation ID.", 409, { operationId });
  // A repeat returns the first result, before any validation that depends on the current schema (the change is now in place).
  if (stored?.status === "applied") return { ...(JSON.parse(stored.result_json) as ApplyResult), repeated: true };
  const finalizing = stored?.status === "awaiting_migration";

  let prepared: Prepared;
  try {
    prepared = await prepare(db, rest, finalizing);
  } catch (err) {
    // The migration has not reached the database yet. Report that the change is still waiting, and change nothing.
    if (finalizing && err instanceof PlatformError && err.code === "MIGRATION_NOT_APPLIED") {
      return { ...(JSON.parse(stored!.result_json) as ApplyResult), repeated: true, message: `The database does not show the change yet (${err.message}) Wait for the migration to be applied, then send this request again.` };
    }
    throw err;
  }
  const { plan } = prepared;
  if (plan.blocked) throw new PlatformError("CHANGE_BLOCKED", plan.blocked, 409, { operation: plan.operation, conversion: plan.conversion });
  if (expectedHash !== undefined && expectedHash !== plan.planHash) {
    throw new PlatformError("PLAN_CHANGED", "The schema or the configuration changed since the preview. Preview again and confirm again.", 409, { expected: expectedHash, current: plan.planHash });
  }
  const now = new Date().toISOString();
  const by = actor ? actor.id : null;
  const audit = (outcome: "success" | "failed", details: Record<string, unknown>) => auditStatement(db, actor, {
    action: `schema.${plan.operation}`, entityType: prepared.entityType, entityId: prepared.entityId, outcome,
    summary: outcome === "success" ? plan.summary : `Could not apply: ${plan.summary}`, details: { operationId, dataSource: plan.dataSource, sql: plan.sql, ...details }
  });
  const migrationFile = plan.migration?.fileName ?? null;

  // migration_controlled, first call: record the change and hand back the migration. Nothing is changed yet.
  if (mode === "migration_controlled" && plan.sql && !finalizing) {
    const result: ApplyResult = { status: "awaiting_migration", repeated: false, operationId, releaseVersion: 0, plan, message: "Commit the migration file, let the deployment apply it, then send this request again to publish the configuration." };
    try {
      await db.batch([
        db.prepare(LOG_INSERT).bind(operationId, prepared.applicationId, plan.operation, plan.dataSource, mode, requestHash, prepared.paramsJson, plan.sql, canonicalJson(result), 0, now, by, "awaiting_migration", migrationFile),
        audit("success", { awaitingMigration: migrationFile })
      ]);
    } catch {
      const raced = await readStored(db, operationId);
      if (raced) return { ...(JSON.parse(raced.result_json) as ApplyResult), repeated: true };
      throw new PlatformError("SCHEMA_CHANGE_FAILED", "The change could not be recorded. Preview again and retry with a new operation ID.", 409);
    }
    return result;
  }

  // migration_controlled, later call: publish only when the database shows the physical change.
  if (finalizing && prepared.physicalPresent && !(await prepared.physicalPresent(db))) {
    return { ...(JSON.parse(stored!.result_json) as ApplyResult), repeated: true, message: "The database does not show the change yet. Wait for the migration to be applied, then send this request again." };
  }

  const result: ApplyResult = { status: "applied", repeated: false, operationId, releaseVersion: plan.releaseVersion, plan };
  const statements: D1PreparedStatement[] = [];
  if (prepared.physical) statements.push(db.prepare(prepared.physical));
  if (prepared.config) statements.push(...prepared.config(db, prepared.applicationId, { now, by }));
  if (plan.publishesRelease && prepared.rows) {
    statements.push(...(await releaseStatements(db, { applicationId: prepared.applicationId, active: prepared.active, rows: prepared.rows, summary: plan.summary, now, by })).statements);
  }
  statements.push(finalizing
    ? db.prepare("UPDATE schema_change_log SET status='applied', result_json=?, release_version=? WHERE id=? AND status='awaiting_migration'").bind(canonicalJson(result), plan.releaseVersion, operationId)
    : db.prepare(LOG_INSERT).bind(operationId, prepared.applicationId, plan.operation, plan.dataSource, mode, requestHash, prepared.paramsJson, plan.sql ?? "", canonicalJson(result), plan.releaseVersion, now, by, "applied", migrationFile));
  statements.push(audit("success", { releaseVersion: plan.releaseVersion }));
  try {
    await db.batch(statements);
  } catch {
    // The batch is one transaction, so nothing was written. Two callers with the same operation ID can race: the second one fails.
    const raced = await readStored(db, operationId);
    if (raced?.status === "applied") return { ...(JSON.parse(raced.result_json) as ApplyResult), repeated: true };
    await db.batch([audit("failed", {})]).catch(() => undefined);
    throw new PlatformError("SCHEMA_CHANGE_FAILED", "The change could not be applied and nothing was changed. The configuration may have changed at the same time. Preview again and retry with a new operation ID.", 409);
  }
  if (plan.publishesRelease) invalidateBootstrapCache();
  return result;
}

export type LogEntry = { operationId: string; operation: string; dataSource: string; mode: string; status: string; sql: string; migrationFile: string | null; releaseVersion: number; createdAt: string; createdBy: string | null };

/** The most recent log entries, at most 50. */
export async function listChanges(db: D1Database, dataSourceKey?: string): Promise<LogEntry[]> {
  const base = "SELECT id, operation, data_source_key, mode, status, migration_file, sql_text, release_version, created_at, created_by FROM schema_change_log";
  const r = await withLogTable(() => dataSourceKey
    ? db.prepare(`${base} WHERE data_source_key = ? ORDER BY created_at DESC, id LIMIT 50`).bind(dataSourceKey).all<Record<string, any>>()
    : db.prepare(`${base} ORDER BY created_at DESC, id LIMIT 50`).all<Record<string, any>>());
  return r.results.map((x) => ({ operationId: x.id, operation: x.operation, dataSource: x.data_source_key, mode: x.mode, status: x.status, sql: x.sql_text, migrationFile: x.migration_file, releaseVersion: x.release_version, createdAt: x.created_at, createdBy: x.created_by }));
}
