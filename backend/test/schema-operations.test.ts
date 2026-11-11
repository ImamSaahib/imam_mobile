import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env } from "cloudflare:workers";
import { call, callWithEnv } from "./helpers";
import { installSeed } from "../src/platform/config/seed";
import { imamMobileSeed } from "../../applications/imam-mobile/seed/package";

const actor = { id: "dev-placeholder", kind: "placeholder" as const, permissions: ["*"] };
const now = "2026-11-11T00:00:00.000Z";
const TABLE = "synthetic_items";
const DS = "dsr_" + "a".repeat(16);
const pid = (n: number) => "prp_" + String(n).padStart(16, "0");
const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
const activeVersion = async () => (await env.DB.prepare("SELECT version FROM cfg_active_release").first<{ version: number }>())!.version;
const columnNames = async () => (await env.DB.prepare(`PRAGMA table_info(${TABLE})`).all<{ name: string }>()).results.map((c) => c.name);
const indexNames = async () => (await env.DB.prepare(`PRAGMA index_list(${TABLE})`).all<{ name: string }>()).results.map((i) => i.name).sort();
const props = async () => (await call("GET", "/api/platform/properties?dataSource=synthetic")).json.properties as any[];
const prop = async (key: string) => (await props()).find((p) => p.key === key);

const KIND_OPTIONS = JSON.stringify({ options: [{ key: "a", label: "A", color: "blue", active: true }, { key: "b", label: "B", color: "red", active: true }] });
const DDL = `CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, title TEXT NOT NULL, email TEXT, kind TEXT, qty INTEGER, sku TEXT UNIQUE, created_by TEXT, updated_by TEXT)`;
// [key, type, extra columns]
const MAPPED: [string, string, Record<string, unknown>?][] = [
  ["id", "uniqueId"], ["title", "title"], ["email", "text"], ["kind", "select", { config_json: KIND_OPTIONS }], ["qty", "number"], ["sku", "text"]
];

async function setup(rowsSql?: string) {
  await env.DB.exec(`DELETE FROM cfg_property WHERE data_source_id = '${DS}'; DELETE FROM cfg_data_source WHERE id = '${DS}'`);
  await env.DB.exec(`DROP TABLE IF EXISTS ${TABLE}`);
  await env.DB.prepare(DDL).run();
  if (rowsSql) await env.DB.exec(rowsSql);
  const app = (await env.DB.prepare("SELECT id FROM cfg_application").first<{ id: string }>())!;
  await env.DB.prepare("INSERT INTO cfg_data_source (id,application_id,key,label,table_name,primary_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(DS, app.id, "synthetic", "Synthetic", TABLE, "id", now, now).run();
  for (const [i, [key, type, extra]] of MAPPED.entries()) {
    await env.DB.prepare("INSERT INTO cfg_property (id,data_source_id,key,label,column_name,type,nullable,position,config_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(pid(i + 1), DS, key, key, key, type, 1, i + 1, (extra?.config_json as string) ?? "{}", now, now).run();
  }
}

/** The number after the highest applied migration, as the service computes it. */
async function nextMigrationNumber() {
  const names = (await env.DB.prepare("SELECT name FROM d1_migrations").all<{ name: string }>()).results.map((r) => r.name);
  return String(Math.max(...names.map((x) => Number(/^(\d+)_/.exec(x)![1]))) + 1).padStart(4, "0");
}

let n = 0;
const opId = () => `op_ops_${String(++n).padStart(6, "0")}`;
const req = (operation: string, params: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ operation, params: { dataSource: "synthetic", ...params }, ...extra });
const preview = (operation: string, params: Record<string, unknown>, extra: Record<string, unknown> = {}) => call("POST", "/api/platform/schema-changes/preview", req(operation, params, extra));
const apply = (operation: string, params: Record<string, unknown>, extra: Record<string, unknown> = {}) => call("POST", "/api/platform/schema-changes", req(operation, params, { operationId: opId(), confirm: true, ...extra }));

beforeEach(async () => { await installSeed(env.DB, imamMobileSeed, actor); await setup(); });
afterEach(async () => { await env.DB.exec(`DROP TABLE IF EXISTS ${TABLE}`); });

describe("add_index", () => {
  it("previews, then creates the index, a log entry and an audit event without publishing a release", async () => {
    const v = await activeVersion();
    const p = await preview("add_index", { columns: ["qty"] });
    expect(p.status).toBe(200);
    expect(p.json).toMatchObject({ operation: "add_index", sql: `CREATE INDEX "idx_${TABLE}_qty" ON "${TABLE}" ("qty")`, publishesRelease: false, releaseVersion: v, backupRequired: false, migration: null, blocked: null, index: { name: `idx_${TABLE}_qty`, columns: ["qty"], unique: false } });
    expect(p.json.warnings[0]).toMatch(/one more index row/);
    expect(await indexNames()).toEqual([`sqlite_autoindex_${TABLE}_1`]);
    expect(Number(p.headers.get("x-rows-written"))).toBe(0);

    const r = await apply("add_index", { columns: ["qty"] }, { planHash: p.json.planHash });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ status: "applied", releaseVersion: v });
    expect(await indexNames()).toEqual([`idx_${TABLE}_qty`, `sqlite_autoindex_${TABLE}_1`]);
    expect(await activeVersion()).toBe(v);
    expect((await call("GET", "/api/platform/schema-changes?dataSource=synthetic")).json.changes[0]).toMatchObject({ operation: "add_index", status: "applied", mode: "guided_live" });
    expect((await env.DB.prepare("SELECT outcome FROM audit_events WHERE action = 'schema.add_index'").all()).results).toEqual([{ outcome: "success" }]);
    expect(Number(r.headers.get("x-rows-written"))).toBeLessThanOrEqual(10); // measured: 9 written (log row and its index, audit event and its index, property of none)
    const schema = (await call("GET", "/api/platform/schema?dataSource=synthetic")).json;
    expect(schema.indexes.map((i: any) => i.name)).toContain(`idx_${TABLE}_qty`);
  });

  it("supports a name and up to three columns, and refuses duplicates", async () => {
    expect((await apply("add_index", { columns: ["kind", "qty"], name: "idx_kind_qty" })).status).toBe(201);
    expect((await apply("add_index", { columns: ["kind", "qty"], name: "idx_other" })).json.code).toBe("INDEX_EXISTS");
    expect((await apply("add_index", { columns: ["email"], name: "idx_kind_qty" })).json.code).toBe("INDEX_EXISTS");
    expect((await apply("add_index", { columns: ["email", "kind", "qty", "title"] })).status).toBe(400);
    expect((await apply("add_index", { columns: ["qty", "qty"] })).status).toBe(400);
    expect((await apply("add_index", { columns: [] })).status).toBe(400);
  });

  it("refuses unique indexes, unknown properties and unsafe names", async () => {
    expect((await apply("add_index", { columns: ["qty"], unique: true })).json.code).toBe("UNIQUE_INDEX_UNAVAILABLE");
    expect((await apply("add_index", { columns: ["nope"] })).status).toBe(404);
    for (const name of ['idx_x"; DROP TABLE t; --', "Idx_x", "qty", "idx_" + "a".repeat(61), "idx_"]) expect((await apply("add_index", { columns: ["qty"], name })).status, name).toBe(400);
    expect((await apply("add_index", { columns: ["qty"], where: "1=1" })).status).toBe(400);
    expect(await indexNames()).toEqual([`sqlite_autoindex_${TABLE}_1`]);
  });

  it("warns about write cost and about large tables", async () => {
    await setup(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1100) INSERT INTO ${TABLE} (title) SELECT 't' || i FROM n`);
    const r = await preview("add_index", { columns: ["qty"] });
    expect(r.json.affectedRows).toEqual({ existing: 1000, capped: true, rewritten: 0 });
    expect(r.json.warnings.join(" ")).toMatch(/more than 1000 rows/);
  });
});

describe("drop_index", () => {
  it("drops an index that was created, and keeps the data", async () => {
    await apply("add_index", { columns: ["qty"] });
    await env.DB.prepare(`INSERT INTO ${TABLE} (title, qty) VALUES ('a', 1)`).run();
    const r = await apply("drop_index", { index: `idx_${TABLE}_qty` });
    expect(r.status).toBe(201);
    expect(await indexNames()).toEqual([`sqlite_autoindex_${TABLE}_1`]);
    expect(await count(TABLE)).toBe(1);
  });

  it("refuses indexes of the table definition, unique indexes, missing indexes and indexes a searchable property needs", async () => {
    const auto = `sqlite_autoindex_${TABLE}_1`;
    expect((await apply("drop_index", { index: "nope" })).status).toBe(404);
    // Autoindex names contain a digit and underscores only, so they pass the name check and are refused as protected.
    expect((await apply("drop_index", { index: auto })).json.code).toBe("INDEX_PROTECTED");
    await env.DB.exec(`CREATE UNIQUE INDEX idx_unique_title ON ${TABLE} (title)`);
    expect((await apply("drop_index", { index: "idx_unique_title" })).json.code).toBe("INDEX_ENFORCES_CONSTRAINT");
    await apply("add_index", { columns: ["email"] });
    await env.DB.exec(`UPDATE cfg_property SET searchable = 1 WHERE id = '${pid(3)}'`);
    const r = await apply("drop_index", { index: `idx_${TABLE}_email` });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("INDEX_IN_USE");
    expect(r.json.details.properties).toEqual(["email"]);
    expect(await indexNames()).toContain(`idx_${TABLE}_email`);
    expect((await apply("drop_index", { index: 'x"; DROP TABLE t' })).status).toBe(400);
  });
});

describe("hide_property", () => {
  it("hides and shows a property, publishing a release each time and keeping the column", async () => {
    const v = await activeVersion();
    const r = await apply("hide_property", { property: "email", hidden: true });
    expect(r.status).toBe(201);
    expect(r.json.releaseVersion).toBe(v + 1);
    expect((await prop("email")).hidden).toBe(true);
    expect(await columnNames()).toContain("email");
    expect((await apply("hide_property", { property: "email", hidden: true })).json.code).toBe("NO_CHANGE");
    expect((await apply("hide_property", { property: "email", hidden: false })).status).toBe(201);
    expect((await prop("email")).hidden).toBe(false);
    expect(await activeVersion()).toBe(v + 2);
    expect(Number(r.headers.get("x-rows-written"))).toBeLessThanOrEqual(14); // measured: 13 written
  });

  it("is part of the release snapshot only while the property is hidden", async () => {
    const snapshotOf = async () => JSON.parse((await env.DB.prepare("SELECT r.snapshot_json AS s FROM cfg_release r JOIN cfg_active_release a ON a.release_id = r.id").first<{ s: string }>())!.s);
    await apply("hide_property", { property: "email", hidden: true });
    const email = (await snapshotOf()).dataSources.find((d: any) => d.key === "synthetic").properties.find((p: any) => p.key === "email");
    expect(email.hidden).toBe(true);
    await apply("hide_property", { property: "email", hidden: false });
    const after = (await snapshotOf()).dataSources.find((d: any) => d.key === "synthetic").properties.find((p: any) => p.key === "email");
    expect("hidden" in after).toBe(false);
  });

  it("refuses to hide a required property without a default and an unknown property", async () => {
    await env.DB.exec(`UPDATE cfg_property SET required = 1 WHERE id = '${pid(3)}'`);
    expect((await apply("hide_property", { property: "email", hidden: true })).json.code).toBe("PROPERTY_REQUIRED");
    expect((await apply("hide_property", { property: "nope", hidden: true })).status).toBe(404);
    expect((await apply("hide_property", { property: "email" })).status).toBe(400);
    expect((await prop("email")).hidden).toBe(false);
  });

  it("cannot be done through the property update route", async () => {
    const r = await call("PATCH", "/api/platform/properties", { propertyId: pid(3), hidden: true });
    expect(r.status).toBe(400);
  });
});

describe("convert_presentation", () => {
  it("converts text to email when every stored value fits, and changes no stored value", async () => {
    await env.DB.exec(`INSERT INTO ${TABLE} (title, email) VALUES ('a', 'x@example.com'), ('b', NULL), ('c', '')`);
    const v = await activeVersion();
    const p = await preview("convert_presentation", { property: "email", to: "email" });
    expect(p.json).toMatchObject({ sql: null, blocked: null, conversion: { from: "text", to: "email", checked: 2, capped: false, nonConforming: { count: 0, examples: [] } }, publishesRelease: true, releaseVersion: v + 1 });
    const r = await apply("convert_presentation", { property: "email", to: "email" }, { planHash: p.json.planHash });
    expect(r.status).toBe(201);
    expect((await prop("email")).type).toBe("email");
    expect((await env.DB.prepare(`SELECT email FROM ${TABLE} ORDER BY id`).all()).results).toEqual([{ email: "x@example.com" }, { email: null }, { email: "" }]);
    expect(await activeVersion()).toBe(v + 1);
    expect((await apply("convert_presentation", { property: "email", to: "email" })).json.code).toBe("NO_CHANGE");
    // And back to text.
    expect((await apply("convert_presentation", { property: "email", to: "text" })).status).toBe(201);
  });

  it("reports rows that do not fit, without showing their values, and refuses to apply", async () => {
    await env.DB.exec(`INSERT INTO ${TABLE} (title, email) VALUES ('a', 'x@example.com'), ('b', 'not-an-email'), ('c', 'UPPER@EXAMPLE.COM'), ('d', 'secret value')`);
    const p = await preview("convert_presentation", { property: "email", to: "email" });
    expect(p.status).toBe(200);
    expect(p.json.blocked).toMatch(/3 stored values do not fit email/);
    expect(p.json.conversion.nonConforming.count).toBe(3);
    expect(p.json.conversion.nonConforming.examples.map((e: any) => e.id)).toEqual([2, 3, 4]);
    expect(p.json.conversion.nonConforming.examples.map((e: any) => e.reason)).toContain("The stored value is not in the normalized form.");
    expect(JSON.stringify(p.json)).not.toContain("not-an-email");
    expect(JSON.stringify(p.json)).not.toContain("secret value");
    const v = await activeVersion();
    const r = await apply("convert_presentation", { property: "email", to: "email" });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("CHANGE_BLOCKED");
    expect(await activeVersion()).toBe(v);
    expect((await prop("email")).type).toBe("text");
  });

  it("refuses to check more than 1,000 values and says so", async () => {
    await setup(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1100) INSERT INTO ${TABLE} (title, email) SELECT 't' || i, 'u' || i || '@example.com' FROM n`);
    const p = await preview("convert_presentation", { property: "email", to: "email" });
    expect(p.json.conversion).toMatchObject({ checked: 1000, capped: true });
    expect(p.json.blocked).toMatch(/cannot all be checked/);
    // Measured: about 2,100 rows read. A bounded count (up to 1,001) and a bounded value check (up to 1,001).
    expect(Number(p.headers.get("x-rows-read"))).toBeLessThan(2300);
  });

  it("converts select to status when the keys are kept and every stored value is an option", async () => {
    await env.DB.exec(`INSERT INTO ${TABLE} (title, kind) VALUES ('a', 'a'), ('b', 'b'), ('c', 'a')`);
    const config = { options: [{ key: "a", label: "A", color: "blue", active: true, group: "to_do" }, { key: "b", label: "B", color: "red", active: true, group: "complete" }] };
    const p = await preview("convert_presentation", { property: "kind", to: "status", config, defaultValue: "a" });
    expect(p.json.conversion).toMatchObject({ checked: 2, nonConforming: { count: 0 } });
    expect((await apply("convert_presentation", { property: "kind", to: "status", config, defaultValue: "a" })).status).toBe(201);
    const k = await prop("kind");
    expect(k).toMatchObject({ type: "status", defaultValue: "a" });
    expect(k.config.options.map((o: any) => o.key)).toEqual(["a", "b"]);
  });

  it("refuses to convert select to status when a key is dropped, the options are missing, or a stored value is not an option", async () => {
    await env.DB.exec(`INSERT INTO ${TABLE} (title, kind) VALUES ('a', 'a'), ('b', 'legacy')`);
    const only = { options: [{ key: "a", label: "A", color: "blue", active: true, group: "to_do" }] };
    expect((await apply("convert_presentation", { property: "kind", to: "status", config: only, defaultValue: "a" })).json.code).toBe("OPTION_REMOVED");
    expect((await apply("convert_presentation", { property: "kind", to: "status" })).status).toBe(400);
    const all = { options: [...only.options, { key: "b", label: "B", color: "red", active: true, group: "complete" }] };
    const r = await apply("convert_presentation", { property: "kind", to: "status", config: all, defaultValue: "a" });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("CHANGE_BLOCKED");
    expect(r.json.details.conversion.nonConforming.examples).toEqual([{ id: null, reason: "The stored value is not one of the options.", value: "legacy" }]);
    expect((await prop("kind")).type).toBe("select");
  });

  it("refuses conversions that rewrite data or change what values mean", async () => {
    for (const [property, to] of [["email", "number"], ["qty", "currency"], ["qty", "text"], ["kind", "text"], ["title", "select"], ["email", "date"]] as const) {
      const r = await apply("convert_presentation", { property, to });
      expect(r.status, `${property} to ${to}`).toBe(409);
      expect(r.json.code).toBe("CONVERSION_REWRITES_DATA");
    }
    expect((await apply("convert_presentation", { property: "email", to: "bogus" })).status).toBe(400);
    expect((await apply("convert_presentation", { property: "nope", to: "url" })).status).toBe(404);
  });

  it("refuses to convert a searchable property to a type that cannot be searched", async () => {
    await env.DB.exec(`UPDATE cfg_property SET searchable = 1 WHERE id = '${pid(4)}'`);
    const config = { options: [{ key: "a", label: "A", color: "blue", active: true, group: "to_do" }, { key: "b", label: "B", color: "red", active: true, group: "to_do" }] };
    const r = await apply("convert_presentation", { property: "kind", to: "status", config, defaultValue: "a" });
    expect(r.status).toBe(400);
    expect((await prop("kind")).type).toBe("select");
  });
});

describe("the index rule for searchable properties", () => {
  const BIG = `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1100) INSERT INTO ${TABLE} (title) SELECT 't' || i FROM n`;

  it("refuses search on a column of a table over 1,000 rows without an index or a recorded reason", async () => {
    await setup(BIG);
    const r = await call("PATCH", "/api/platform/properties", { propertyId: pid(3), searchable: true });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("INDEX_REQUIRED");
    expect((await prop("email")).searchable).toBe(false);
  });

  it("allows it with an index, or with a recorded reason, and clears the reason when search is turned off", async () => {
    await setup(BIG);
    await apply("add_index", { columns: ["email"] });
    expect((await call("PATCH", "/api/platform/properties", { propertyId: pid(3), searchable: true })).status).toBe(200);
    expect((await call("GET", "/api/platform/schema?dataSource=synthetic")).json.searchWithoutIndex).toEqual([]);
    const withReason = await call("PATCH", "/api/platform/properties", { propertyId: pid(6), searchable: true, indexExceptionReason: "Small lookup, searched rarely." });
    expect(withReason.status).toBe(200);
    expect((await prop("sku")).indexExceptionReason).toBe("Small lookup, searched rarely.");
    expect((await call("PATCH", "/api/platform/properties", { propertyId: pid(6), searchable: false })).status).toBe(200);
    expect((await prop("sku")).indexExceptionReason).toBeNull();
  });

  it("accepts a reason only for a searchable property", async () => {
    const r = await call("PATCH", "/api/platform/properties", { propertyId: pid(3), indexExceptionReason: "x" });
    expect(r.status).toBe(400);
  });

  it("allows search on a small table without an index and lists it in the schema report", async () => {
    expect((await call("PATCH", "/api/platform/properties", { propertyId: pid(3), searchable: true })).status).toBe(200);
    expect((await call("GET", "/api/platform/schema?dataSource=synthetic")).json.searchWithoutIndex).toEqual([{ property: "email", column: "email" }]);
  });

  it("applies the same rule when a searchable property is added to a large table", async () => {
    await setup(BIG);
    const r = await apply("add_property", { key: "tag", type: "text", searchable: true });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("INDEX_REQUIRED");
    expect(await columnNames()).not.toContain("tag");
    expect((await apply("add_property", { key: "tag", type: "text", searchable: true, indexExceptionReason: "Notes field." })).status).toBe(201);
  });
});

describe("migration_controlled mode", () => {
  const controlled = { mode: "migration_controlled" };

  it("returns the migration, records the change as awaiting, and publishes only after the database shows it", async () => {
    const v = await activeVersion();
    const params = { key: "warranty", type: "text" };
    const p = await preview("add_property", params, controlled);
    expect(p.json.migration.fileName).toBe(`${await nextMigrationNumber()}_add_property_synthetic_items_warranty.sql`);
    expect(p.json.migration.sql).toContain(`ALTER TABLE "${TABLE}" ADD COLUMN "warranty" TEXT;`);
    expect(p.json.migration.sql).toMatch(/^-- Generated by the schema change service/);

    const id = opId();
    const body = req("add_property", params, { operationId: id, confirm: true, ...controlled });
    const first = await call("POST", "/api/platform/schema-changes", body);
    expect(first.status).toBe(202);
    expect(first.json).toMatchObject({ status: "awaiting_migration", releaseVersion: 0 });
    expect(first.json.plan.migration.fileName).toBe(p.json.migration.fileName);
    expect(await columnNames()).not.toContain("warranty");
    expect(await prop("warranty")).toBeUndefined();
    expect(await activeVersion()).toBe(v);
    expect((await call("GET", "/api/platform/schema-changes?dataSource=synthetic")).json.changes[0]).toMatchObject({ status: "awaiting_migration", mode: "migration_controlled", migrationFile: p.json.migration.fileName });

    // Sending it again before the migration exists changes nothing.
    const early = await call("POST", "/api/platform/schema-changes", body);
    expect(early.status).toBe(200);
    expect(early.json).toMatchObject({ status: "awaiting_migration", repeated: true });
    expect(early.json.message).toMatch(/does not show the change yet/);
    expect(early.json.plan.migration.fileName).toBe(p.json.migration.fileName);
    expect(await activeVersion()).toBe(v);

    // A column with the right name but another type is not the migration.
    await env.DB.exec(`ALTER TABLE ${TABLE} ADD COLUMN "warranty" INTEGER`);
    expect((await call("POST", "/api/platform/schema-changes", body)).json.status).toBe("awaiting_migration");
    await env.DB.exec(`ALTER TABLE ${TABLE} DROP COLUMN "warranty"`);

    // The deployment applies the migration. The same request now publishes.
    await env.DB.exec(`ALTER TABLE ${TABLE} ADD COLUMN "warranty" TEXT`);
    const done = await call("POST", "/api/platform/schema-changes", body);
    expect(done.status).toBe(201);
    expect(done.json).toMatchObject({ status: "applied", releaseVersion: v + 1 });
    expect(await prop("warranty")).toMatchObject({ type: "text", columnName: "warranty", nullable: true });
    expect(await activeVersion()).toBe(v + 1);
    expect((await call("GET", "/api/platform/schema-changes?dataSource=synthetic")).json.changes).toHaveLength(1);
    expect((await call("GET", "/api/platform/schema-changes?dataSource=synthetic")).json.changes[0].status).toBe("applied");
    expect((await call("POST", "/api/platform/schema-changes", body)).json).toMatchObject({ status: "applied", repeated: true });
    expect(await activeVersion()).toBe(v + 1);
  });

  it("works for add_index and drop_index", async () => {
    const add = req("add_index", { columns: ["qty"] }, { operationId: opId(), confirm: true, ...controlled });
    const a1 = await call("POST", "/api/platform/schema-changes", add);
    expect(a1.status).toBe(202);
    expect(a1.json.plan.migration.sql).toContain(`CREATE INDEX "idx_${TABLE}_qty"`);
    expect(await indexNames()).not.toContain(`idx_${TABLE}_qty`);
    await env.DB.exec(`CREATE INDEX "idx_${TABLE}_qty" ON "${TABLE}" ("qty")`);
    expect((await call("POST", "/api/platform/schema-changes", add)).json.status).toBe("applied");

    const drop = req("drop_index", { index: `idx_${TABLE}_qty` }, { operationId: opId(), confirm: true, ...controlled });
    expect((await call("POST", "/api/platform/schema-changes", drop)).status).toBe(202);
    expect(await indexNames()).toContain(`idx_${TABLE}_qty`);
    expect((await call("POST", "/api/platform/schema-changes", drop)).json.status).toBe("awaiting_migration");
    await env.DB.exec(`DROP INDEX "idx_${TABLE}_qty"`);
    expect((await call("POST", "/api/platform/schema-changes", drop)).json.status).toBe("applied");
  });

  it("applies changes without a physical part at once", async () => {
    const r = await apply("hide_property", { property: "email", hidden: true }, controlled);
    expect(r.status).toBe(201);
    expect(r.json.status).toBe("applied");
    expect(r.json.plan.migration).toBeNull();
    expect((await prop("email")).hidden).toBe(true);
  });

  it("refuses the same operation ID for a different change or mode", async () => {
    const id = opId();
    expect((await call("POST", "/api/platform/schema-changes", req("add_property", { key: "w1", type: "text" }, { operationId: id, confirm: true, ...controlled }))).status).toBe(202);
    expect((await call("POST", "/api/platform/schema-changes", req("add_property", { key: "w2", type: "text" }, { operationId: id, confirm: true, ...controlled }))).json.code).toBe("OPERATION_ID_REUSED");
    expect((await call("POST", "/api/platform/schema-changes", req("add_property", { key: "w1", type: "text" }, { operationId: id, confirm: true }))).json.code).toBe("OPERATION_ID_REUSED");
  });

  it("numbers the migration after the last one in the database", async () => {
    const p = await preview("add_index", { columns: ["qty"] }, controlled);
    expect(p.json.migration.fileName).toBe(`${await nextMigrationNumber()}_add_index_synthetic_items_synthetic_items_qty.sql`);
  });

  it("does not change the table or the configuration at any step before the migration exists", async () => {
    const before = { columns: await columnNames(), indexes: await indexNames(), props: (await props()).length, v: await activeVersion() };
    await apply("add_property", { key: "w3", type: "text" }, controlled);
    await apply("add_index", { columns: ["email"] }, controlled);
    expect({ columns: await columnNames(), indexes: await indexNames(), props: (await props()).length, v: await activeVersion() }).toEqual(before);
  });
});

describe("permissions and the operation list", () => {
  it("accepts only the listed operations and requires the schema change permission", async () => {
    for (const operation of ["drop_column", "rename_column", "alter_type", "raw_sql", "drop_table"]) expect((await preview(operation, {})).status, operation).toBe(400);
    for (const operation of ["add_index", "drop_index", "hide_property", "convert_presentation"]) {
      expect((await callWithEnv({ AUTH_MODE: undefined }, "POST", "/api/platform/schema-changes", req(operation, {}, { operationId: opId(), confirm: true }))).status, operation).toBe(403);
    }
  });
});
