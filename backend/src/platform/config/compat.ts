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
  unmapped: { column: string; sqliteType: string }[];
};

export type CompatibilityReport = { ok: boolean; dataSources: DataSourceReport[] };

const NAME = /^[a-z][a-z0-9_]{0,63}$/;
const PLATFORM_TABLES = new Set(["audit_events", "app_configuration", "configuration_versions", "schema_changes", "custom_field_values"]);

export function isBlockedTable(name: string): boolean {
  return !NAME.test(name) || name.startsWith("cfg_") || name.startsWith("sqlite_") || name.startsWith("_cf_") || name.startsWith("d1_") || PLATFORM_TABLES.has(name);
}

const quote = (identifier: string) => '"' + identifier.replace(/"/g, '""') + '"';

export async function inspectCompatibility(db: D1Database, dataSources: DataSourceDef[]): Promise<CompatibilityReport> {
  const reports: DataSourceReport[] = [];
  for (const ds of dataSources) {
    const report: DataSourceReport = { key: ds.key, tableName: ds.tableName, tableExists: false, blockedTable: false, mapped: [], missing: [], incompatible: [], unmapped: [] };
    if (isBlockedTable(ds.tableName)) {
      report.blockedTable = true;
      reports.push(report);
      continue;
    }
    const info = await db.prepare(`PRAGMA table_info(${quote(ds.tableName)})`).all<{ name: string; type: string }>();
    const columns = new Map(info.results.map((c) => [c.name, (c.type || "").toUpperCase()]));
    report.tableExists = columns.size > 0;
    const mappedColumns = new Set<string>();
    for (const property of ds.properties) {
      if (TYPE_CONTRACTS[property.type]?.physical === "junction") {
        // Junction tables are inspected from slice 04b. Until then such a property is reported, never silently accepted.
        report.incompatible.push({ property: property.key, column: property.columnName, type: property.type, sqliteType: "junction" });
        continue;
      }
      const sqliteType = columns.get(property.columnName);
      if (sqliteType === undefined || !NAME.test(property.columnName)) report.missing.push({ property: property.key, column: property.columnName });
      else if (!acceptedSqliteTypes(property.type).includes(sqliteType)) report.incompatible.push({ property: property.key, column: property.columnName, type: property.type, sqliteType });
      else report.mapped.push({ property: property.key, column: property.columnName, sqliteType });
      mappedColumns.add(property.columnName);
    }
    for (const [column, sqliteType] of columns) if (!mappedColumns.has(column)) report.unmapped.push({ column, sqliteType });
    reports.push(report);
  }
  const ok = reports.every((r) => r.tableExists && !r.blockedTable && r.missing.length === 0 && r.incompatible.length === 0);
  return { ok, dataSources: reports };
}
