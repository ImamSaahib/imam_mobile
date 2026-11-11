// Property configuration changes that need no change to the database schema (Story 04, slice 04a):
// label, description, required, default, searchable, sensitivity and type settings such as options.
// Changes that alter the column or the meaning of stored values belong to the schema change service (slice 04c on).
//
// A change is one D1 batch: the property row, a new release with its snapshot, the active-release pointer
// and an audit event. Either all of it is written or none of it.

import type { Actor } from "../policy";
import { auditStatement } from "../audit";
import { PlatformError } from "../errors";
import { canonicalJson } from "./canonical";
import { invalidateBootstrapCache } from "./bootstrap";
import { loadRows, propertyFromRow } from "./snapshot";
import { readActiveRelease, releaseStatements } from "./release";
import { assertNoDrift, assertSearchIndexRule } from "./schema-inspect";
import { checkOptionChanges, normalizeSettings, optionsOf, SETTINGS_DEFAULTS, TYPE_CONTRACTS } from "./property-types";
import type { PropertySettings } from "./types";

export type PropertyView = {
  id: string; dataSource: string; key: string; label: string; columnName: string; type: string; nullable: boolean; position: number;
} & PropertySettings;

const PROPERTY_COLUMNS = "p.id, p.data_source_id, p.key, p.label, p.column_name, p.type, p.nullable, p.position, p.description, p.required, p.default_json, p.searchable, p.sensitivity, p.config_json, p.hidden, p.index_exception_reason, d.key AS data_source_key";

type RawRow = Record<string, any>;
const toView = (r: RawRow): PropertyView => ({ ...propertyFromRow(r), dataSource: r.data_source_key } as unknown as PropertyView);

/** Properties with their settings, optionally for one data source. Reads one row per property. */
export async function listProperties(db: D1Database, dataSourceKey?: string): Promise<PropertyView[]> {
  const base = `SELECT ${PROPERTY_COLUMNS} FROM cfg_property p JOIN cfg_data_source d ON d.id = p.data_source_id`;
  const result = dataSourceKey
    ? await db.prepare(`${base} WHERE d.key = ? ORDER BY d.key, p.position`).bind(dataSourceKey).all<RawRow>()
    : await db.prepare(`${base} ORDER BY d.key, p.position`).all<RawRow>();
  if (dataSourceKey && result.results.length === 0) {
    const exists = await db.prepare("SELECT 1 AS x FROM cfg_data_source WHERE key = ?").bind(dataSourceKey).first();
    if (!exists) throw new PlatformError("DATA_SOURCE_NOT_FOUND", `There is no data source "${dataSourceKey}".`, 404);
  }
  return result.results.map(toView);
}

export type PropertyUpdate = {
  propertyId: string;
  /** If given, the change is refused unless this is still the active release version. */
  releaseVersion?: number;
  label?: string;
  description?: string | null;
  required?: boolean;
  defaultValue?: unknown;
  searchable?: boolean;
  sensitivity?: PropertySettings["sensitivity"];
  indexExceptionReason?: string | null;
  config?: Record<string, unknown>;
};

export type PropertyUpdateResult = { status: "applied" | "unchanged"; property: PropertyView; releaseVersion: number; changed: string[] };

const ALLOWED = ["propertyId", "releaseVersion", "label", "description", "required", "defaultValue", "searchable", "sensitivity", "indexExceptionReason", "config"];

/** Settings that give stored values their meaning. Changing them needs a data conversion (Phase B), so they are locked here. */
const LOCKED_CONFIG: Record<string, string[]> = { currency: ["currency", "scale"], relation: ["target"], multiSelect: ["junction"] };

function lockedKeysChanged(type: string, before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of LOCKED_CONFIG[type] ?? []) {
    // Setting a value that was never set is allowed (a relation installed before targets existed).
    if (before[key] === undefined) continue;
    if (canonicalJson(before[key] ?? null) !== canonicalJson(after[key] ?? null)) out.push(key);
  }
  return out;
}

export async function updateProperty(db: D1Database, input: PropertyUpdate, actor: Actor | null): Promise<PropertyUpdateResult> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new PlatformError("PROPERTY_INVALID", "Send a JSON object.", 400);
  for (const key of Object.keys(input)) {
    if (!ALLOWED.includes(key)) throw new PlatformError("PROPERTY_INVALID", `"${key}" cannot be changed here. The column, key, type and nullability change through schema changes.`, 400, { field: key });
  }
  if (typeof input.propertyId !== "string" || input.propertyId === "") throw new PlatformError("PROPERTY_INVALID", "propertyId is required.", 400, { field: "propertyId" });
  if (input.releaseVersion !== undefined && !Number.isInteger(input.releaseVersion)) throw new PlatformError("PROPERTY_INVALID", "releaseVersion must be a whole number.", 400, { field: "releaseVersion" });
  if (input.label !== undefined && (typeof input.label !== "string" || input.label.trim().length < 1 || input.label.trim().length > 80)) throw new PlatformError("PROPERTY_INVALID", "The label must be 1 to 80 characters.", 400, { field: "label" });

  const rawRow = await db.prepare(`SELECT ${PROPERTY_COLUMNS}, d.application_id FROM cfg_property p JOIN cfg_data_source d ON d.id = p.data_source_id WHERE p.id = ?`).bind(input.propertyId).first<RawRow>();
  if (!rawRow) throw new PlatformError("PROPERTY_NOT_FOUND", "There is no property with this ID.", 404);
  const before = toView(rawRow);
  const applicationId: string = rawRow.application_id;

  const active = await readActiveRelease(db, applicationId);
  if (!active) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet.", 404);
  if (input.releaseVersion !== undefined && input.releaseVersion !== active.version) {
    throw new PlatformError("STALE_RELEASE", `The configuration changed: release ${active.version} is active, not ${input.releaseVersion}. Reload and try again.`, 409, { activeVersion: active.version });
  }

  // Merge the requested changes onto the stored settings and validate the whole result against the type.
  const merged = {
    type: before.type as never,
    description: input.description !== undefined ? input.description : before.description,
    required: input.required !== undefined ? input.required : before.required,
    defaultValue: input.defaultValue !== undefined ? input.defaultValue : before.defaultValue,
    searchable: input.searchable !== undefined ? input.searchable : before.searchable,
    sensitivity: input.sensitivity !== undefined ? input.sensitivity : before.sensitivity,
    hidden: before.hidden,
    // The reason belongs to the searchable setting: turning search off clears it unless the request says otherwise.
    indexExceptionReason: input.indexExceptionReason !== undefined ? input.indexExceptionReason : (input.searchable === false ? null : before.indexExceptionReason),
    config: input.config !== undefined ? input.config : before.config
  };
  const next = normalizeSettings(merged);

  if (input.config !== undefined) {
    const locked = lockedKeysChanged(before.type, before.config, next.config);
    if (locked.length) throw new PlatformError("CONFIG_LOCKED", `${locked.join(" and ")} cannot change while the property may hold data. Changing it needs a data conversion, which is not available yet.`, 409, { keys: locked });
    if (TYPE_CONTRACTS[before.type as keyof typeof TYPE_CONTRACTS].usesOptions) checkOptionChanges(optionsOf(before.config), optionsOf(next.config));
  }
  const label = input.label !== undefined ? input.label.trim() : before.label;

  const changed: string[] = [];
  if (label !== before.label) changed.push("label");
  for (const key of Object.keys(SETTINGS_DEFAULTS) as (keyof PropertySettings)[]) {
    if (canonicalJson(next[key] ?? null) !== canonicalJson(before[key] ?? null)) changed.push(key);
  }
  if (changed.length === 0) return { status: "unchanged", property: before, releaseVersion: active.version, changed };

  const now = new Date().toISOString();
  const by = actor ? actor.id : null;
  const after: PropertyView = { ...before, label, ...next };

  // Build the new snapshot from the stored rows with this one change applied.
  const rows = await loadRows(db, applicationId);
  if (!rows) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet.", 404);
  await assertNoDrift(db, rows, rawRow.data_source_id);
  if (next.searchable && (!before.searchable || next.indexExceptionReason !== before.indexExceptionReason)) {
    const table = rows.dataSources.find((d) => d.id === rawRow.data_source_id)!.tableName;
    await assertSearchIndexRule(db, table, before.columnName, next.indexExceptionReason);
  }
  rows.properties = rows.properties.map((p) => (p.id === before.id ? { ...p, label, ...next } : p));
  const summary = `Changed ${changed.join(", ")} of ${before.dataSource}.${before.key}`;
  const { statements: releaseStmts, releaseVersion } = await releaseStatements(db, { applicationId, active, rows, summary, now, by });

  const statements = [
    db.prepare("UPDATE cfg_property SET label=?, description=?, required=?, default_json=?, searchable=?, sensitivity=?, config_json=?, hidden=?, index_exception_reason=?, updated_at=?, updated_by=? WHERE id=?")
      .bind(label, next.description, next.required ? 1 : 0, next.defaultValue === null || next.defaultValue === undefined ? null : canonicalJson(next.defaultValue), next.searchable ? 1 : 0, next.sensitivity, canonicalJson(next.config), next.hidden ? 1 : 0, next.indexExceptionReason, now, by, before.id),
    ...releaseStmts,
    auditStatement(db, actor, { action: "property.update", entityType: "property", entityId: before.id, outcome: "success", summary, details: { dataSource: before.dataSource, property: before.key, changed, releaseVersion } })
  ];
  try {
    // UNIQUE (application_id, version) on cfg_release makes a concurrent change with the same next version fail
    // the whole batch, so two changes cannot both be written from the same starting release.
    await db.batch(statements);
  } catch {
    throw new PlatformError("UPDATE_FAILED", "The change could not be written because the configuration changed at the same time. Reload and try again.", 409);
  }
  invalidateBootstrapCache();
  return { status: "applied", property: after, releaseVersion, changed };
}
