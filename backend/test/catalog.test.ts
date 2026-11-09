import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { call } from "./helpers";
import { deriveSeedId, newId, ID_PATTERN, sha256Hex } from "../src/platform/config/ids";
import { canonicalJson } from "../src/platform/config/canonical";
import { expandSeed, installSeed } from "../src/platform/config/seed";
import { buildSnapshot, loadRows } from "../src/platform/config/snapshot";
import { inspectCompatibility } from "../src/platform/config/compat";
import { getBootstrap } from "../src/platform/config/bootstrap";
import { PlatformError } from "../src/platform/errors";
import { imamMobileSeed } from "../../applications/imam-mobile/seed/package";
import type { SeedPackage } from "../src/platform/config/seed-types";

const actor = { id: "dev-placeholder", kind: "placeholder" as const, permissions: ["*"] };
const clone = (): SeedPackage => JSON.parse(JSON.stringify(imamMobileSeed));
const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
const CFG_TABLES = ["cfg_application", "cfg_menu", "cfg_module", "cfg_page", "cfg_component", "cfg_data_source", "cfg_property", "cfg_release", "cfg_active_release", "cfg_seed_package", "cfg_seed_item"];
const rejection = async (promise: Promise<unknown>) => { try { await promise; } catch (e) { return e as PlatformError; } throw new Error("expected a rejection"); };

describe("identifiers", () => {
  it("derives the same ID from the same application, type and seed key", async () => {
    const a = await deriveSeedId("imam-mobile", "menu", "workspace");
    expect(a).toBe(await deriveSeedId("imam-mobile", "menu", "workspace"));
    expect(a).toMatch(ID_PATTERN);
    expect(a.startsWith("mnu_")).toBe(true);
  });
  it("derives different IDs for different keys, types and applications", async () => {
    const base = await deriveSeedId("imam-mobile", "menu", "workspace");
    expect(await deriveSeedId("imam-mobile", "menu", "analyze")).not.toBe(base);
    expect(await deriveSeedId("imam-mobile", "page", "workspace")).not.toBe(base);
    expect(await deriveSeedId("other-app", "menu", "workspace")).not.toBe(base);
  });
  it("creates random IDs with the same shape", () => {
    const a = newId("menu"); const b = newId("menu");
    expect(a).toMatch(ID_PATTERN);
    expect(a).not.toBe(b);
  });
  it("keeps Imam Mobile seed IDs fixed (golden values)", async () => {
    // If these change, existing installations would no longer recognise their seed items.
    expect(await deriveSeedId("imam-mobile", "application", "imam-mobile")).toBe("app_6f8c8eb21614abbf");
    const { items } = await expandSeed(imamMobileSeed);
    const digest = await sha256Hex(items.map((i) => `${i.itemType}:${i.seedKey}:${i.itemId}`).sort().join("\n"));
    expect(items.length).toBe(61);
    expect(digest).toBe(GOLDEN_ID_DIGEST);
  });
  it("does not change an ID when a label changes", async () => {
    const changed = clone();
    changed.menus[0].label = "Renamed";
    changed.menus[0].modules[0].label = "Home";
    changed.dataSources[0].properties[1].label = "Handset model";
    const a = (await expandSeed(imamMobileSeed)).items.map((i) => i.itemId);
    const b = (await expandSeed(changed)).items.map((i) => i.itemId);
    expect(b).toEqual(a);
  });
  it("sorts object keys when making canonical JSON", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] }, u: undefined })).toBe('{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}');
  });
});

const GOLDEN_ID_DIGEST = "6a84d060a88c5e6d40a196367c787598c14f9f5d26bc99f93a3b778ac72954ad";

describe("seed installation", () => {
  it("installs the Imam Mobile package: rows, ownership records and release 1", async () => {
    const result = await installSeed(env.DB, imamMobileSeed, actor);
    expect(result).toMatchObject({ status: "installed", packageId: "imam-mobile", version: 1, releaseVersion: 1, itemCount: 61 });
    expect(await count("cfg_application")).toBe(1);
    expect(await count("cfg_menu")).toBe(2);
    expect(await count("cfg_module")).toBe(6);
    expect(await count("cfg_page")).toBe(6);
    expect(await count("cfg_component")).toBe(5);
    expect(await count("cfg_data_source")).toBe(4);
    expect(await count("cfg_property")).toBe(37);
    expect(await count("cfg_seed_item")).toBe(61);
    expect(await count("cfg_release")).toBe(1);
    const items = await env.DB.prepare("SELECT ownership, applied_version, length(baseline_hash) AS len, deprecated FROM cfg_seed_item GROUP BY ownership, applied_version, len, deprecated").all();
    expect(items.results).toEqual([{ ownership: "seed_managed", applied_version: 1, len: 64, deprecated: 0 }]);
    const by = await env.DB.prepare("SELECT created_by FROM cfg_application").first();
    expect(by).toEqual({ created_by: "dev-placeholder" });
  });
  it("can be applied twice without duplicate rows", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const before = await Promise.all(CFG_TABLES.map(count));
    const again = await installSeed(env.DB, imamMobileSeed, actor);
    expect(again).toMatchObject({ status: "unchanged", releaseVersion: 1, itemCount: 0 });
    expect(await Promise.all(CFG_TABLES.map(count))).toEqual(before);
  });
  it("does not touch business records", async () => {
    await env.DB.prepare("INSERT INTO customers (name) VALUES ('Keep me')").run();
    await installSeed(env.DB, imamMobileSeed, actor);
    await installSeed(env.DB, imamMobileSeed, actor);
    expect(await count("customers")).toBe(1);
  });
  it("builds the stored snapshot from the same rows that the database now holds", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const app = await env.DB.prepare("SELECT id FROM cfg_application").first<{ id: string }>();
    const rows = await loadRows(env.DB, app!.id);
    const rebuilt = canonicalJson(buildSnapshot(rows!, "0.1.0"));
    const stored = await env.DB.prepare("SELECT snapshot_json, snapshot_hash FROM cfg_release").first<{ snapshot_json: string; snapshot_hash: string }>();
    expect(rebuilt).toBe(stored!.snapshot_json);
    expect(await sha256Hex(stored!.snapshot_json)).toBe(stored!.snapshot_hash);
  });
  it("links list components to their data source by ID, not by name", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const row = await env.DB.prepare("SELECT c.config_json, d.id AS ds FROM cfg_component c JOIN cfg_data_source d ON d.key='devices' WHERE c.type='list' AND c.config_json LIKE '%' || d.id || '%'").first<{ config_json: string; ds: string }>();
    expect(JSON.parse(row!.config_json)).toEqual({ dataSourceId: row!.ds });
  });
  it("rejects a package that needs a newer platform", async () => {
    const pkg = clone(); pkg.minPlatformVersion = "9.0.0";
    expect((await rejection(installSeed(env.DB, pkg, actor))).code).toBe("PLATFORM_TOO_OLD");
    expect(await count("cfg_application")).toBe(0);
  });
  it("asks for an upgrade instead of reinstalling a different version", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const next = clone(); next.version = 2;
    expect((await rejection(installSeed(env.DB, next, actor))).code).toBe("SEED_UPGRADE_REQUIRED");
  });
  it("refuses an application key that exists without this package", async () => {
    await env.DB.prepare("INSERT INTO cfg_application (id,key,name,created_at,updated_at) VALUES ('app_0000000000000001','imam-mobile','Hand made','x','x')").run();
    expect((await rejection(installSeed(env.DB, imamMobileSeed, actor))).code).toBe("SEED_COLLISION");
    expect(await count("cfg_menu")).toBe(0);
  });
  it("rejects invalid references and duplicate seed keys before writing", async () => {
    const badPage = clone(); badPage.menus[0].modules[0].pageSeedKey = "nope";
    expect((await rejection(installSeed(env.DB, badPage, actor))).code).toBe("SEED_INVALID");
    const badSource = clone(); badSource.pages[1].components[0].dataSourceSeedKey = "nope";
    expect((await rejection(installSeed(env.DB, badSource, actor))).code).toBe("SEED_INVALID");
    const dup = clone(); dup.pages[0].seedKey = dup.pages[1].seedKey;
    expect((await rejection(installSeed(env.DB, dup, actor))).code).toBe("SEED_INVALID");
    expect(await count("cfg_application")).toBe(0);
  });
  it("refuses metadata that does not match the physical tables and writes nothing", async () => {
    const pkg = clone(); pkg.dataSources[0].properties[1].columnName = "no_such_column";
    const err = await rejection(installSeed(env.DB, pkg, actor));
    expect(err.code).toBe("SCHEMA_INCOMPATIBLE");
    expect((err.details as any).dataSources[0].missing).toEqual([{ property: "model", column: "no_such_column" }]);
    for (const t of CFG_TABLES) expect(await count(t), t).toBe(0);
  });
  it("applies all rows in one batch: a failure part-way leaves nothing behind", async () => {
    const pkg = clone(); pkg.menus[0].modules[1].slug = pkg.menus[0].modules[0].slug; // UNIQUE (application_id, slug) fails mid-batch
    await expect(installSeed(env.DB, pkg, actor)).rejects.toThrow();
    for (const t of CFG_TABLES) expect(await count(t), t).toBe(0);
  });
});

describe("schema compatibility inspection", () => {
  const ds = (tableName: string, properties: { key: string; columnName: string; type: any }[]) => [{ key: "x", tableName, properties }];
  it("reports mapped, unmapped, missing, incompatible and blocked cases", async () => {
    const report = await inspectCompatibility(env.DB, [
      ...ds("customers", [{ key: "name", columnName: "name", type: "title" }, { key: "gone", columnName: "gone", type: "text" }, { key: "typo", columnName: "id", type: "text" }]),
      { key: "b1", tableName: "cfg_page", properties: [] },
      { key: "b2", tableName: "audit_events", properties: [] },
      { key: "b3", tableName: "customers; DROP TABLE customers", properties: [] },
      { key: "n", tableName: "does_not_exist", properties: [] }
    ]);
    const [c, b1, b2, b3, n] = report.dataSources;
    expect(report.ok).toBe(false);
    expect(c.mapped.map((m) => m.property)).toEqual(["name"]);
    expect(c.missing).toEqual([{ property: "gone", column: "gone" }]);
    expect(c.incompatible).toEqual([{ property: "typo", column: "id", type: "text", sqliteType: "INTEGER" }]);
    expect(c.unmapped.map((u) => u.column)).toEqual(expect.arrayContaining(["mobile_number", "type", "created_by"]));
    expect([b1, b2, b3].map((r) => r.blockedTable)).toEqual([true, true, true]);
    expect(n.tableExists).toBe(false);
    expect(await count("customers")).toBe(0);
  });
  it("accepts the installed Imam Mobile configuration and offers unmapped columns", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const r = await call("GET", "/api/platform/schema-compatibility");
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    const devices = r.json.dataSources.find((d: any) => d.key === "devices");
    expect(devices.unmapped.map((u: any) => u.column).sort()).toEqual(["created_by", "updated_by"]);
    expect(devices.mapped).toHaveLength(13);
  });
  it("reports a problem when a physical column disappears from view of a mapped property", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    await env.DB.prepare("UPDATE cfg_property SET column_name='renamed_col' WHERE key='model'").run();
    const r = await call("GET", "/api/platform/schema-compatibility");
    expect(r.json.ok).toBe(false);
    expect(r.json.dataSources.find((d: any) => d.key === "devices").missing).toEqual([{ property: "model", column: "renamed_col" }]);
  });
  it("is not installed before seeding", async () => {
    const r = await call("GET", "/api/platform/schema-compatibility");
    expect(r.status).toBe(404);
    expect(r.json.code).toBe("NOT_INSTALLED");
  });
});

describe("bootstrap", () => {
  it("says plainly that nothing is installed yet", async () => {
    const r = await call("GET", "/api/bootstrap");
    expect(r.status).toBe(404);
    expect(r.json).toMatchObject({ code: "NOT_INSTALLED" });
    expect(String(r.json.error)).not.toMatch(/SQL|stack|undefined/i);
  });
  it("installs through the route and returns the application shell from the release", async () => {
    const seeded = await call("POST", "/api/platform/seed", {});
    expect(seeded.status).toBe(201);
    expect((await call("POST", "/api/platform/seed", {})).status).toBe(200);
    const r = await call("GET", "/api/bootstrap");
    expect(r.status).toBe(200);
    expect(r.json.deployment).toEqual({ key: "imam-mobile-dev", environment: "development" });
    expect(r.json.platform).toEqual({ version: "0.1.0", configSchemaVersion: 1 });
    expect(r.json.application).toMatchObject({ key: "imam-mobile", name: "Imam Mobile" });
    expect(r.json.release).toMatchObject({ version: 1 });
    const { menus, pages, dataSources } = r.json.shell;
    expect(menus.map((m: any) => [m.label, m.modules.map((x: any) => x.label)])).toEqual([
      ["Workspace", ["Dashboard", "Inventory", "Customers", "Customer Entries", "Sales"]],
      ["Analyze", ["Reports"]]
    ]);
    expect(pages).toHaveLength(6);
    expect(dataSources.map((d: any) => d.key)).toEqual(["customers", "devices", "ledger", "sales"]);
  });
  it("sends a version tag and tells the browser to revalidate", async () => {
    await call("POST", "/api/platform/seed", {});
    const r = await call("GET", "/api/bootstrap");
    expect(r.headers.get("ETag")).toMatch(/^"1-[0-9a-f]{12}-p0\.1\.0"$/);
    expect(r.headers.get("Cache-Control")).toBe("no-cache");
  });
  it("answers 304 with no body when the version matches, and 200 when it does not", async () => {
    await call("POST", "/api/platform/seed", {});
    const first = await call("GET", "/api/bootstrap");
    const etag = first.headers.get("ETag")!;
    const same = await call("GET", "/api/bootstrap", undefined, { "If-None-Match": etag });
    expect(same.status).toBe(304);
    expect(same.json).toBeNull();
    expect(same.headers.get("ETag")).toBe(etag);
    expect((await call("GET", "/api/bootstrap", undefined, { "If-None-Match": '"stale"' })).status).toBe(200);
    expect((await call("GET", "/api/bootstrap", undefined, { "If-None-Match": `W/${etag}` })).status).toBe(304);
  });
  it("runs one query when the version matches and two when it does not, and never reads configuration rows", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const record = (db: D1Database, log: string[]) => ({ prepare: (sql: string) => { log.push(sql); return db.prepare(sql); } }) as unknown as D1Database;
    const warm: string[] = [];
    const first = await getBootstrap(record(env.DB, warm), env, null);
    expect(warm).toHaveLength(2);
    const cold: string[] = [];
    await getBootstrap(record(env.DB, cold), env, first.etag);
    expect(cold).toHaveLength(1);
    for (const sql of [...warm, ...cold]) expect(sql).not.toMatch(/cfg_(menu|module|page|component|data_source|property)/);
  });
  it("refuses a release that needs a newer platform, with a plain message", async () => {
    await call("POST", "/api/platform/seed", {});
    await env.DB.prepare("UPDATE cfg_release SET min_platform_version='9.0.0'").run();
    const r = await call("GET", "/api/bootstrap");
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("PLATFORM_TOO_OLD");
  });
  it("rejects an unknown package name", async () => {
    const r = await call("POST", "/api/platform/seed", { packageId: "nope" });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("SEED_UNKNOWN");
  });
});
