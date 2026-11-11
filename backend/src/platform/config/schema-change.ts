// Schema change service (Story 04, slice 04c). A closed list of operations. No operation accepts SQL text.
// Every statement is generated from validated parameters: identifiers match an allowlist pattern and are
// quoted, column types come from a fixed map, and values are bound parameters.
//
// Slice 04c has one operation, add_property, in guided_live mode. Slice 04d adds the others and
// migration_controlled mode.
//
// Apply runs one db.batch(): the ALTER TABLE, the property row, a new release, the log row and an audit event.
// D1 runs a batch as one transaction. test/schema-change.test.ts checks on the test runtime that a failing
// statement undoes the ALTER TABLE. If a change is ever interrupted in a way that leaves a column without a
// property, the column shows up as unmapped and Add as property (adoptColumn) recovers it.

import type { Actor } from "../policy";
import { auditStatement } from "../audit";
import { PlatformError } from "../errors";
import { canonicalJson } from "./canonical";
import { invalidateBootstrapCache } from "./bootstrap";
import { isBlockedTable, isValidName, quote, SYSTEM_COLUMNS } from "./compat";
import { newId, sha256Hex } from "./ids";
import { insertStatement } from "./rows-sql";
import { readActiveRelease, releaseStatements } from "./release";
import { COLUMN_LIMIT, COLUMN_WARN_AT, countRows, findDataSource, loadApplication, readColumns } from "./schema-inspect";
import { normalizeSettings, TYPE_CONTRACTS } from "./property-types";
import type { PropertyType } from "./types";

export const OPERATIONS = ["add_property"] as const;
export type Operation = (typeof OPERATIONS)[number];
export const MODES = ["guided_live"] as const;

/** Types add_property can create now. Relation, multi-select and server-assigned types need more than one column or extra steps and come later. */
const ADDABLE: PropertyType[] = ["text", "title", "number", "currency", "select", "status", "date", "timestamp", "checkbox", "email", "phone", "url"];
const RESERVED_COLUMNS = new Set(["id", "rowid", "oid", "_rowid_", "created_at", "updated_at", ...SYSTEM_COLUMNS]);
const OPERATION_ID = /^[A-Za-z0-9_-]{8,64}$/;

export type AddPropertyParams = {
  dataSource: string;
  /** The property key. Also the column name unless columnName is given. */
  key: string;
  columnName?: string;
  label?: string;
  type: PropertyType;
  description?: string | null;
  required?: boolean;
  defaultValue?: unknown;
  searchable?: boolean;
  sensitivity?: "normal" | "sensitive";
  config?: Record<string, unknown>;
};
const PARAM_KEYS = ["dataSource", "key", "columnName", "label", "type", "description", "required", "defaultValue", "searchable", "sensitivity", "config"];

export type ChangeRequest = { operation: Operation; mode?: string; params: AddPropertyParams };

function bad(message: string, field: string): never { throw new PlatformError("SCHEMA_CHANGE_INVALID", message, 400, { field }); }

function sqliteTypeFor(type: PropertyType, config: Record<string, unknown>): "TEXT" | "INTEGER" | "REAL" {
  if (type === "currency" || type === "checkbox") return "INTEGER";
  if (type === "number") return config.integer === false ? "REAL" : "INTEGER";
  return "TEXT";
}

export type Plan = {
  operation: Operation;
  mode: "guided_live";
  dataSource: string;
  table: string;
  sql: string;
  property: { key: string; label: string; columnName: string; type: PropertyType; nullable: true; position: number; config: Record<string, unknown> };
  /** Existing rows are not touched: SQLite adds the column with NULL for every row, without rewriting them. */
  affectedRows: { existing: number; capped: boolean; rewritten: 0 };
  capacity: { before: number; after: number; limit: number; warnAt: number; remainingAfter: number; warning: boolean };
  /** An additive change needs no backup. Changes that drop or rewrite data do, in Phase B. */
  backupRequired: false;
  releaseVersion: number;
  planHash: string;
};

type Prepared = { plan: Plan; applicationId: string; rows: Awaited<ReturnType<typeof loadApplication>>["rows"]; row: Record<string, unknown>; active: { release_id: string; version: number }; paramsJson: string };

/** Validates the request and builds the plan. Reads only. */
async function prepare(db: D1Database, request: ChangeRequest): Promise<Prepared> {
  if (typeof request !== "object" || request === null || Array.isArray(request)) throw new PlatformError("SCHEMA_CHANGE_INVALID", "Send a JSON object.", 400);
  for (const k of Object.keys(request)) if (!["operation", "mode", "params", "operationId", "confirm", "planHash"].includes(k)) throw new PlatformError("SCHEMA_CHANGE_INVALID", `"${k}" is not accepted. SQL and other free text are not accepted.`, 400, { field: k });
  if (!OPERATIONS.includes(request.operation)) throw new PlatformError("SCHEMA_CHANGE_INVALID", `Unknown operation. Available: ${OPERATIONS.join(", ")}.`, 400, { field: "operation", available: OPERATIONS });
  const mode = request.mode ?? "guided_live";
  if (mode === "migration_controlled") throw new PlatformError("MODE_UNAVAILABLE", "migration_controlled mode is not available yet.", 400, { field: "mode" });
  if (mode !== "guided_live") bad("mode must be guided_live.", "mode");
  const p = request.params;
  if (typeof p !== "object" || p === null || Array.isArray(p)) bad("params must be an object.", "params");
  for (const k of Object.keys(p)) if (!PARAM_KEYS.includes(k)) bad(`"${k}" is not a parameter of add_property. SQL and other free text are not accepted.`, k);
  if (typeof p.dataSource !== "string" || p.dataSource === "") bad("dataSource is required.", "dataSource");
  if (typeof p.key !== "string" || !isValidName(p.key)) bad("key must be lower-case letters, digits and underscores, starting with a letter, at most 64 characters.", "key");
  const columnName = p.columnName ?? p.key;
  if (typeof columnName !== "string" || !isValidName(columnName)) bad("columnName must be lower-case letters, digits and underscores, starting with a letter, at most 64 characters.", "columnName");
  if (RESERVED_COLUMNS.has(columnName)) bad(`"${columnName}" is reserved for the platform.`, "columnName");
  if (typeof p.type !== "string" || !TYPE_CONTRACTS[p.type]) bad(`Unknown property type "${String(p.type)}".`, "type");
  if (!ADDABLE.includes(p.type)) throw new PlatformError("TYPE_UNAVAILABLE", `${TYPE_CONTRACTS[p.type].label} properties cannot be added yet. Available: ${ADDABLE.join(", ")}.`, 400, { field: "type", available: ADDABLE });
  if (p.label !== undefined && (typeof p.label !== "string" || p.label.trim().length < 1 || p.label.trim().length > 80)) bad("The label must be 1 to 80 characters.", "label");

  const { id: applicationId, rows } = await loadApplication(db);
  const ds = findDataSource(rows, p.dataSource);
  if (isBlockedTable(ds.tableName)) throw new PlatformError("SCHEMA_DRIFT", `The table of ${ds.key} is not an approved data table.`, 409, { dataSource: ds.key });
  const active = await readActiveRelease(db, applicationId);
  if (!active) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet.", 404);

  const columns = await readColumns(db, ds.tableName);
  if (columns.length === 0) throw new PlatformError("SCHEMA_DRIFT", `The table ${ds.tableName} does not exist.`, 409, { dataSource: ds.key });
  const existing = rows.properties.filter((x) => x.dataSourceId === ds.id);
  const columnNames = new Set(columns.map((c) => c.name));
  const missing = existing.filter((x) => !columnNames.has(x.columnName));
  if (missing.length) throw new PlatformError("SCHEMA_DRIFT", `The configuration of ${ds.key} does not match its table. Fix the mismatch before changing the schema.`, 409, { dataSource: ds.key, missing: missing.map((x) => ({ property: x.key, column: x.columnName })) });
  if (columnNames.has(columnName)) throw new PlatformError("COLUMN_EXISTS", `The table already has a column "${columnName}". Use Add as property to map it.`, 409, { column: columnName });
  if (existing.some((x) => x.key === p.key)) throw new PlatformError("PROPERTY_EXISTS", `A property with the key "${p.key}" already exists in ${ds.key}.`, 409, { key: p.key });
  if (columns.length >= COLUMN_LIMIT) throw new PlatformError("COLUMN_LIMIT", `The table ${ds.tableName} has ${columns.length} columns, the maximum is ${COLUMN_LIMIT}.`, 409, { columns: columns.length, limit: COLUMN_LIMIT, remaining: 0 });

  const settings = normalizeSettings({ type: p.type, description: p.description, required: p.required, defaultValue: p.defaultValue, searchable: p.searchable, sensitivity: p.sensitivity, config: p.config ?? {} });
  const label = p.label !== undefined ? p.label.trim() : p.key.charAt(0).toUpperCase() + p.key.slice(1).replace(/_/g, " ");
  const position = existing.reduce((m, x) => Math.max(m, x.position), 0) + 1;
  const sql = `ALTER TABLE ${quote(ds.tableName)} ADD COLUMN ${quote(columnName)} ${sqliteTypeFor(p.type, settings.config)}`;
  const count = await countRows(db, ds.tableName);
  const after = columns.length + 1;
  const row = { id: newId("property"), dataSourceId: ds.id, key: p.key, label, columnName, type: p.type, nullable: true, position, ...settings };
  const paramsJson = canonicalJson({ operation: request.operation, mode, params: { ...p, columnName, label } });
  const planHash = await sha256Hex(canonicalJson({ paramsJson, sql, columns: columns.length, release: active.version }));
  const plan: Plan = {
    operation: request.operation, mode: "guided_live", dataSource: ds.key, table: ds.tableName, sql,
    property: { key: p.key, label, columnName, type: p.type, nullable: true, position, config: settings.config },
    affectedRows: { existing: count.value, capped: count.capped, rewritten: 0 },
    capacity: { before: columns.length, after, limit: COLUMN_LIMIT, warnAt: COLUMN_WARN_AT, remainingAfter: COLUMN_LIMIT - after, warning: after >= COLUMN_WARN_AT },
    backupRequired: false, releaseVersion: active.version + 1, planHash
  };
  return { plan, applicationId, rows, row, active, paramsJson };
}

/** Read-only. Shows the SQL, the affected rows, the capacity and the plan hash that apply can check. */
export async function previewChange(db: D1Database, request: ChangeRequest): Promise<Plan> {
  return (await prepare(db, request)).plan;
}

export type ApplyRequest = ChangeRequest & { operationId: string; confirm: boolean; planHash?: string };
export type ApplyResult = { status: "applied"; repeated: boolean; operationId: string; releaseVersion: number; plan: Plan };

/** Migration 0007 can reach the database a moment after the code that needs it is deployed. Say so, do not fail with a raw error. */
async function withLogTable<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (err) {
    if (err instanceof Error && /no such table: schema_change_log/i.test(err.message)) throw new PlatformError("MIGRATION_PENDING", "The schema change log table is not available yet. Apply migration 0007 and try again.", 503);
    throw err;
  }
}

async function storedResult(db: D1Database, operationId: string, requestHash: string): Promise<ApplyResult | null> {
  const row = await withLogTable(() => db.prepare("SELECT request_hash, result_json FROM schema_change_log WHERE id = ?").bind(operationId).first<{ request_hash: string; result_json: string }>());
  if (!row) return null;
  if (row.request_hash !== requestHash) throw new PlatformError("OPERATION_ID_REUSED", "This operation ID was already used for a different change. Use a new operation ID.", 409, { operationId });
  return { ...(JSON.parse(row.result_json) as ApplyResult), repeated: true };
}

export async function applyChange(db: D1Database, request: ApplyRequest, actor: Actor | null): Promise<ApplyResult> {
  if (typeof request !== "object" || request === null || Array.isArray(request)) throw new PlatformError("SCHEMA_CHANGE_INVALID", "Send a JSON object.", 400);
  if (typeof request.operationId !== "string" || !OPERATION_ID.test(request.operationId)) bad("operationId is required: 8 to 64 letters, digits, underscores or hyphens. Create a new one for each change.", "operationId");
  if (request.confirm !== true) throw new PlatformError("CONFIRMATION_REQUIRED", "Show the preview to the user and send confirm: true to apply it.", 400, { field: "confirm" });
  const { operationId, confirm: _c, planHash: expectedHash, ...rest } = request;
  for (const k of Object.keys(rest)) if (!["operation", "mode", "params"].includes(k)) throw new PlatformError("SCHEMA_CHANGE_INVALID", `"${k}" is not accepted. SQL and other free text are not accepted.`, 400, { field: k });

  const requestHash = await sha256Hex(canonicalJson({ operation: rest.operation, mode: rest.mode ?? "guided_live", params: rest.params }));
  // A repeat returns the first result, before any validation that depends on the current schema (the column now exists).
  const repeat = await storedResult(db, operationId, requestHash);
  if (repeat) return repeat;

  const { plan, applicationId, rows, row, active, paramsJson } = await prepare(db, rest);
  if (expectedHash !== undefined && expectedHash !== plan.planHash) {
    throw new PlatformError("PLAN_CHANGED", "The schema or the configuration changed since the preview. Preview again and confirm again.", 409, { expected: expectedHash, current: plan.planHash });
  }
  const now = new Date().toISOString();
  const by = actor ? actor.id : null;
  const summary = `Added ${plan.dataSource}.${plan.property.key} as ${plan.property.type} (column ${plan.property.columnName})`;
  const { statements, releaseVersion } = await releaseStatements(db, { applicationId, active, rows: { ...rows, properties: [...rows.properties, row as never] }, summary, now, by });
  const result: ApplyResult = { status: "applied", repeated: false, operationId, releaseVersion, plan };
  try {
    await db.batch([
      db.prepare(plan.sql),
      insertStatement(db, "property", row as never, applicationId, { now, by }),
      ...statements,
      db.prepare("INSERT INTO schema_change_log (id,application_id,operation,data_source_key,mode,request_hash,params_json,sql_text,result_json,release_version,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(operationId, applicationId, plan.operation, plan.dataSource, plan.mode, requestHash, paramsJson, plan.sql, canonicalJson(result), releaseVersion, now, by),
      auditStatement(db, actor, { action: "schema.add_property", entityType: "property", entityId: String(row.id), outcome: "success", summary, details: { operationId, dataSource: plan.dataSource, column: plan.property.columnName, type: plan.property.type, sql: plan.sql, releaseVersion } })
    ]);
  } catch {
    // The batch is one transaction, so nothing was written. Two callers with the same operation ID can race: the second one fails on the primary key.
    const raced = await storedResult(db, operationId, requestHash);
    if (raced) return raced;
    await db.batch([auditStatement(db, actor, { action: "schema.add_property", entityType: "data_source", entityId: plan.dataSource, outcome: "failed", summary: `Could not add ${plan.dataSource}.${plan.property.key}`, details: { operationId, sql: plan.sql } })]).catch(() => undefined);
    throw new PlatformError("SCHEMA_CHANGE_FAILED", "The change could not be applied and nothing was changed. The configuration may have changed at the same time. Preview again and retry with a new operation ID.", 409);
  }
  invalidateBootstrapCache();
  return result;
}

export type LogEntry = { operationId: string; operation: string; dataSource: string; mode: string; sql: string; releaseVersion: number; createdAt: string; createdBy: string | null };

/** The most recent log entries, at most 50. */
export async function listChanges(db: D1Database, dataSourceKey?: string): Promise<LogEntry[]> {
  const base = "SELECT id, operation, data_source_key, mode, sql_text, release_version, created_at, created_by FROM schema_change_log";
  const r = await withLogTable(() => dataSourceKey
    ? db.prepare(`${base} WHERE data_source_key = ? ORDER BY created_at DESC, id LIMIT 50`).bind(dataSourceKey).all<Record<string, any>>()
    : db.prepare(`${base} ORDER BY created_at DESC, id LIMIT 50`).all<Record<string, any>>());
  return r.results.map((x) => ({ operationId: x.id, operation: x.operation, dataSource: x.data_source_key, mode: x.mode, sql: x.sql_text, releaseVersion: x.release_version, createdAt: x.created_at, createdBy: x.created_by }));
}
