import { CONFIG_SCHEMA_VERSION } from "../version";
import type { ConfigRows, Snapshot, PropertySettings } from "./types";
import { SETTINGS_DEFAULTS, isDefaultSetting } from "./property-types";

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byKey = <T extends { key: string }>(a: T, b: T) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

const SETTING_KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof PropertySettings)[];

/** Only the settings that differ from the default. Rows built from seed values may leave settings out. */
function snapshotSettings(p: Partial<PropertySettings>): Partial<PropertySettings> {
  const out: Partial<PropertySettings> = {};
  for (const key of SETTING_KEYS) {
    const value = p[key] === undefined ? SETTINGS_DEFAULTS[key] : p[key];
    if (!isDefaultSetting(key, value)) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Builds the immutable release snapshot from configuration rows. Pure: same rows, same snapshot. */
export function buildSnapshot(rows: ConfigRows, minPlatformVersion: string): Snapshot {
  return {
    configSchemaVersion: CONFIG_SCHEMA_VERSION,
    minPlatformVersion,
    application: { id: rows.application.id, key: rows.application.key, name: rows.application.name, description: rows.application.description },
    menus: [...rows.menus].sort(byPosition).map((menu) => ({
      id: menu.id, label: menu.label, icon: menu.icon, display: menu.display,
      modules: rows.modules.filter((m) => m.menuId === menu.id).sort(byPosition)
        .map((m) => ({ id: m.id, label: m.label, slug: m.slug, icon: m.icon, badge: m.badge, pageId: m.pageId, enabled: m.enabled }))
    })),
    pages: [...rows.pages].sort(byId).map((page) => ({
      id: page.id, title: page.title, description: page.description,
      components: rows.components.filter((c) => c.pageId === page.id).sort(byPosition)
        .map((c) => ({ id: c.id, type: c.type, typeVersion: c.typeVersion, config: c.config }))
    })),
    dataSources: [...rows.dataSources].sort(byKey).map((ds) => ({
      id: ds.id, key: ds.key, label: ds.label, tableName: ds.tableName, primaryKey: ds.primaryKey,
      properties: rows.properties.filter((p) => p.dataSourceId === ds.id).sort(byPosition)
        .map((p) => ({ id: p.id, key: p.key, label: p.label, columnName: p.columnName, type: p.type, nullable: p.nullable, ...snapshotSettings(p) }))
    }))
  };
}

/** Reads the working configuration rows of one application from the database. Used by publish (Story 07). */
export async function loadRows(db: D1Database, applicationId: string): Promise<ConfigRows | null> {
  const app = await db.prepare("SELECT id, key, name, description, status FROM cfg_application WHERE id=?").bind(applicationId).first<{ id: string; key: string; name: string; description: string | null; status: "active" | "disabled" }>();
  if (!app) return null;
  const [menus, modules, pages, components, dataSources, properties] = await db.batch([
    db.prepare("SELECT id, label, icon, display, position FROM cfg_menu WHERE application_id=?").bind(applicationId),
    db.prepare("SELECT id, menu_id, page_id, label, slug, icon, badge, position, enabled FROM cfg_module WHERE application_id=?").bind(applicationId),
    db.prepare("SELECT id, title, description FROM cfg_page WHERE application_id=?").bind(applicationId),
    db.prepare("SELECT c.id, c.page_id, c.type, c.type_version, c.position, c.config_json FROM cfg_component c JOIN cfg_page p ON p.id=c.page_id WHERE p.application_id=?").bind(applicationId),
    db.prepare("SELECT id, key, label, table_name, primary_key FROM cfg_data_source WHERE application_id=?").bind(applicationId),
    db.prepare("SELECT p.id, p.data_source_id, p.key, p.label, p.column_name, p.type, p.nullable, p.position, p.description, p.required, p.default_json, p.searchable, p.sensitivity, p.config_json FROM cfg_property p JOIN cfg_data_source d ON d.id=p.data_source_id WHERE d.application_id=?").bind(applicationId)
  ]);
  const r = (x: D1Result) => x.results as Record<string, any>[];
  return {
    application: app,
    menus: r(menus).map((x) => ({ id: x.id, label: x.label, icon: x.icon, display: x.display, position: x.position })),
    modules: r(modules).map((x) => ({ id: x.id, menuId: x.menu_id, pageId: x.page_id, label: x.label, slug: x.slug, icon: x.icon, badge: x.badge, position: x.position, enabled: x.enabled === 1 })),
    pages: r(pages).map((x) => ({ id: x.id, title: x.title, description: x.description })),
    components: r(components).map((x) => ({ id: x.id, pageId: x.page_id, type: x.type, typeVersion: x.type_version, position: x.position, config: JSON.parse(x.config_json) })),
    dataSources: r(dataSources).map((x) => ({ id: x.id, key: x.key, label: x.label, tableName: x.table_name, primaryKey: x.primary_key })),
    properties: r(properties).map((x) => propertyFromRow(x))
  };
}

/** One property row as read from cfg_property (the columns selected by loadRows). */
export function propertyFromRow(x: Record<string, any>): ConfigRows["properties"][number] {
  return {
    id: x.id, dataSourceId: x.data_source_id, key: x.key, label: x.label, columnName: x.column_name, type: x.type, nullable: x.nullable === 1, position: x.position,
    description: x.description ?? null, required: x.required === 1, defaultValue: x.default_json === null || x.default_json === undefined ? null : JSON.parse(x.default_json),
    searchable: x.searchable === 1, sensitivity: x.sensitivity ?? "normal", config: JSON.parse(x.config_json ?? "{}")
  };
}
