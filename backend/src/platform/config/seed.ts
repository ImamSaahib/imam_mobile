// Initial seed installation (Contracts section 12.7). Upgrades are a separate operation (slice 01c-2).

import type { Actor } from "../policy";
import { PlatformError } from "../errors";
import { PLATFORM_VERSION, CONFIG_SCHEMA_VERSION, compareVersions } from "../version";
import { deriveSeedId, newId, sha256Hex, type ItemType } from "./ids";
import { canonicalJson, hashOf } from "./canonical";
import { buildSnapshot } from "./snapshot";
import { inspectCompatibility } from "./compat";
import type { ConfigRows, SeedItemType } from "./types";
import type { SeedPackage } from "./seed-types";
import { invalidateBootstrapCache } from "./bootstrap";
import { INSERT_ORDER, insertStatement } from "./rows-sql";

export type ExpandedSeed = {
  rows: ConfigRows;
  items: { itemId: string; itemType: SeedItemType; seedKey: string; value: Record<string, unknown> }[];
};

/** The editable value of an item: its row without the ID. Baseline hashes and merges compare these. */
export function itemValue(row: { id: string } & Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...value } = row;
  return value;
}

/** Turns a seed package into configuration rows with derived IDs. Pure apart from hashing. */
export async function expandSeed(pkg: SeedPackage): Promise<ExpandedSeed> {
  const key = pkg.applicationKey;
  const id = (type: ItemType, seedKey: string) => deriveSeedId(key, type, seedKey);
  const items: ExpandedSeed["items"] = [];
  const track = (itemType: SeedItemType, seedKey: string, row: { id: string } & Record<string, unknown>) =>
    items.push({ itemId: row.id, itemType, seedKey, value: itemValue(row) });

  const application = { id: await id("application", key), key, name: pkg.application.name, description: pkg.application.description ?? null, status: "active" as const };
  track("application", key, application);

  const rows: ConfigRows = { application, menus: [], modules: [], pages: [], components: [], dataSources: [], properties: [] };

  const dataSourceIds = new Map<string, string>();
  for (const ds of pkg.dataSources) dataSourceIds.set(ds.seedKey, await id("dataSource", ds.seedKey));
  const pageIds = new Map<string, string>();
  for (const page of pkg.pages) pageIds.set(page.seedKey, await id("page", page.seedKey));

  for (const ds of pkg.dataSources) {
    const dsRow = { id: dataSourceIds.get(ds.seedKey)!, key: ds.key, label: ds.label, tableName: ds.tableName, primaryKey: ds.primaryKey ?? "id" };
    rows.dataSources.push(dsRow); track("dataSource", ds.seedKey, dsRow);
    let position = 0;
    for (const prop of ds.properties) {
      const row = { id: await id("property", `${ds.seedKey}.${prop.seedKey}`), dataSourceId: dsRow.id, key: prop.key, label: prop.label, columnName: prop.columnName, type: prop.type, nullable: prop.nullable, position: ++position };
      rows.properties.push(row); track("property", `${ds.seedKey}.${prop.seedKey}`, row);
    }
  }
  for (const page of pkg.pages) {
    const pageRow = { id: pageIds.get(page.seedKey)!, title: page.title, description: page.description ?? null };
    rows.pages.push(pageRow); track("page", page.seedKey, pageRow);
    let position = 0;
    for (const c of page.components) {
      let config: Record<string, unknown> = { ...(c.config ?? {}) };
      if (c.dataSourceSeedKey) {
        const dsId = dataSourceIds.get(c.dataSourceSeedKey);
        if (!dsId) throw new PlatformError("SEED_INVALID", `Component ${c.seedKey} refers to unknown data source ${c.dataSourceSeedKey}.`, 400);
        config = { ...config, dataSourceId: dsId };
      }
      const row = { id: await id("component", c.seedKey), pageId: pageRow.id, type: c.type, typeVersion: c.typeVersion ?? 1, position: ++position, config };
      rows.components.push(row); track("component", c.seedKey, row);
    }
  }
  let menuPosition = 0;
  for (const menu of pkg.menus) {
    const menuRow = { id: await id("menu", menu.seedKey), label: menu.label, icon: menu.icon ?? null, display: menu.display, position: ++menuPosition };
    rows.menus.push(menuRow); track("menu", menu.seedKey, menuRow);
    let position = 0;
    for (const m of menu.modules) {
      const pageId = pageIds.get(m.pageSeedKey);
      if (!pageId) throw new PlatformError("SEED_INVALID", `Module ${m.seedKey} refers to unknown page ${m.pageSeedKey}.`, 400);
      const row = { id: await id("module", m.seedKey), menuId: menuRow.id, pageId, label: m.label, slug: m.slug, icon: m.icon ?? null, badge: m.badge ?? null, position: ++position, enabled: m.enabled ?? true };
      rows.modules.push(row); track("module", m.seedKey, row);
    }
  }
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.itemId)) throw new PlatformError("SEED_INVALID", `Duplicate seed key: ${item.itemType} ${item.seedKey}.`, 400);
    seen.add(item.itemId);
  }
  return { rows, items };
}

export type InstallResult = { status: "installed" | "unchanged"; packageId: string; version: number; releaseVersion: number; itemCount: number };

/** Installs a seed package for the first time. Re-running the same version changes nothing. */
export async function installSeed(db: D1Database, pkg: SeedPackage, actor: Actor | null): Promise<InstallResult> {
  if (compareVersions(PLATFORM_VERSION, pkg.minPlatformVersion) < 0) {
    throw new PlatformError("PLATFORM_TOO_OLD", `This package needs platform ${pkg.minPlatformVersion} or newer. This installation runs ${PLATFORM_VERSION}.`, 409);
  }
  const existing = await db.prepare("SELECT version FROM cfg_seed_package WHERE package_id=?").bind(pkg.packageId).first<{ version: number }>();
  if (existing) {
    if (existing.version === pkg.version) {
      const active = await db.prepare("SELECT version FROM cfg_active_release a JOIN cfg_application p ON p.id=a.application_id WHERE p.key=?").bind(pkg.applicationKey).first<{ version: number }>();
      return { status: "unchanged", packageId: pkg.packageId, version: pkg.version, releaseVersion: active?.version ?? 0, itemCount: 0 };
    }
    throw new PlatformError("SEED_UPGRADE_REQUIRED", `Package ${pkg.packageId} version ${existing.version} is installed. Use the upgrade preview for version ${pkg.version}.`, 409);
  }
  const collision = await db.prepare("SELECT id FROM cfg_application WHERE key=?").bind(pkg.applicationKey).first();
  if (collision) throw new PlatformError("SEED_COLLISION", `An application with key ${pkg.applicationKey} already exists and is not owned by this package.`, 409);

  const { rows, items } = await expandSeed(pkg);
  const report = await inspectCompatibility(db, rows.dataSources.map((ds) => ({ key: ds.key, tableName: ds.tableName, properties: rows.properties.filter((x) => x.dataSourceId === ds.id) })));
  if (!report.ok) throw new PlatformError("SCHEMA_INCOMPATIBLE", "The configuration does not match the database tables. Nothing was installed.", 409, report);

  const snapshot = buildSnapshot(rows, pkg.minPlatformVersion);
  const snapshotJson = canonicalJson(snapshot);
  const snapshotHash = await sha256Hex(snapshotJson);
  const releaseId = newId("release");
  const etag = `1-${snapshotHash.slice(0, 12)}`;
  const now = new Date().toISOString();
  const by = actor ? actor.id : null;

  const stamp = { now, by };
  const app = rows.application;
  const byType: Record<SeedItemType, ({ id: string } & Record<string, any>)[]> = {
    application: [app], page: rows.pages, menu: rows.menus, dataSource: rows.dataSources, module: rows.modules, component: rows.components, property: rows.properties
  };
  const statements: D1PreparedStatement[] = [];
  for (const type of INSERT_ORDER) for (const row of byType[type]) statements.push(insertStatement(db, type, row, app.id, stamp));
  statements.push(db.prepare("INSERT INTO cfg_seed_package (package_id,application_key,version,min_platform_version,applied_at) VALUES (?,?,?,?,?)").bind(pkg.packageId, pkg.applicationKey, pkg.version, pkg.minPlatformVersion, now));
  for (const item of items) statements.push(db.prepare("INSERT INTO cfg_seed_item (item_id,item_type,package_id,seed_key,ownership,applied_version,baseline_hash) VALUES (?,?,?,?,?,?,?)").bind(item.itemId, item.itemType, pkg.packageId, item.seedKey, "seed_managed", pkg.version, await hashOf(item.value)));
  statements.push(db.prepare("INSERT INTO cfg_release (id,application_id,version,snapshot_json,snapshot_hash,config_schema_version,min_platform_version,summary,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(releaseId, app.id, 1, snapshotJson, snapshotHash, CONFIG_SCHEMA_VERSION, pkg.minPlatformVersion, `Initial install of ${pkg.packageId} ${pkg.version}`, now, by));
  statements.push(db.prepare("INSERT INTO cfg_active_release (application_id,release_id,version,etag) VALUES (?,?,?,?)").bind(app.id, releaseId, 1, etag));

  await db.batch(statements); // one batch: all rows and the release appear together or not at all
  invalidateBootstrapCache();
  return { status: "installed", packageId: pkg.packageId, version: pkg.version, releaseVersion: 1, itemCount: items.length };
}
