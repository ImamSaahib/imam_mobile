// Metadata-to-physical-schema compatibility inspection (Contracts section 12.6).
// Read-only. Table and column names are validated and quoted, never concatenated raw.

import type { PropertyType } from "./types";
import { acceptedSqliteTypes, TYPE_CONTRACTS } from "./property-types";

export type DataSourceDef = {
  key: string;
  tableName: string;
  properties: { key: string; columnName: string; type: PropertyType }[];
};

export type DataSourceReport = {
  key: string;
  tableName: string;
  tableExists: boolean;
  blockedTable: boolean;
  mapped: { property: string; column: string; sqliteType: string }[];
  missing: { property: string; column: string }[];
  incompatible: { property: string; column: string; type: PropertyType; sqliteType: string }[];
  /** Columns that no property maps and that are not system columns. These can be adopted as properties. */
  unmapped: { column: string; sqliteType: string }[];
  /** Platform-managed columns (SYSTEM_COLUMNS). They are never offered for adoption. */
  system: { column: string; sqliteType: string }[];
};

export type CompatibilityReport = { ok: boolean; dataSources: DataSourceReport[] };

const NAME = /^[a-z][a-z0-9_]{0,63}$/;
const PLATFORM_TABLES = new Set(["audit_events", "app_configuration", "configuration_versions", "schema_changes", "custom_field_values"]);

export function isBlockedTable(name: string): boolean {
  return !NAME.test(name) || name.startsWith("cfg_") || name.startsWith("sqlite_") || name.startsWith("_cf_") || name.startsWith("d1_") || PLATFORM_TABLES.has(name);
}

/** Actor columns written by the platform. They are not business properties and are not offered for adoption. */
export const SYSTEM_COLUMNS = new Set(["created_by", "updated_by"]);

export const quote = (identifier: string) => '"' + identifier.replace(/"/g, '""') + '"';
export const isValidName = (name: string) => NAME.test(name);

/** Compares the properties of one data source with the columns read from its table (column name to upper-case SQLite type). */
export function compareTable(ds: DataSourceDef, columns: Map<string, string>): DataSourceReport {
  const report: DataSourceReport = { key: ds.key, tableName: ds.tableName, tableExists: columns.size > 0, blockedTable: false, mapped: [], missing: [], incompatible: [], unmapped: [], system: [] };
  const mappedColumns = new Set<string>();
  for (const property of ds.properties) {
    if (TYPE_CONTRACTS[property.type]?.physical === "junction") {
      // Junction tables are not inspected yet. Such a property is reported, never silently accepted.
      report.incompatible.push({ property: property.key, column: property.columnName, type: property.type, sqliteType: "junction" });
      continue;
    }
    const sqliteType = columns.get(property.columnName);
    if (sqliteType === undefined || !NAME.test(property.columnName)) report.missing.push({ property: property.key, column: property.columnName });
    else if (!acceptedSqliteTypes(property.type).includes(sqliteType)) report.incompatible.push({ property: property.key, column: property.columnName, type: property.type, sqliteType });
    else report.mapped.push({ property: property.key, column: property.columnName, sqliteType });
    mappedColumns.add(property.columnName);
  }
  for (const [column, sqliteType] of columns) {
    if (mappedColumns.has(column)) continue;
    (SYSTEM_COLUMNS.has(column) ? report.system : report.unmapped).push({ column, sqliteType });
  }
  return report;
}

export async function inspectCompatibility(db: D1Database, dataSources: DataSourceDef[]): Promise<CompatibilityReport> {
  const reports: DataSourceReport[] = [];
  for (const ds of dataSources) {
    if (isBlockedTable(ds.tableName)) {
      reports.push({ key: ds.key, tableName: ds.tableName, tableExists: false, blockedTable: true, mapped: [], missing: [], incompatible: [], unmapped: [], system: [] });
      continue;
    }
    const info = await db.prepare(`PRAGMA table_info(${quote(ds.tableName)})`).all<{ name: string; type: string }>();
    reports.push(compareTable(ds, new Map(info.results.map((c) => [c.name, (c.type || "").toUpperCase()]))));
  }
  const ok = reports.every((r) => r.tableExists && !r.blockedTable && r.missing.length === 0 && r.incompatible.length === 0);
  return { ok, dataSources: reports };
}
