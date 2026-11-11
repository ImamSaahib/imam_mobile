import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env } from "cloudflare:workers";
import { call, callWithEnv } from "./helpers";
import { installSeed } from "../src/platform/config/seed";
import { imamMobileSeed } from "../../applications/imam-mobile/seed/package";

const actor = { id: "dev-placeholder", kind: "placeholder" as const, permissions: ["*"] };
const now = "2026-11-11T00:00:00.000Z";
const TABLE = "synthetic_items";
const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
const activeVersion = async () => (await env.DB.prepare("SELECT version FROM cfg_active_release").first<{ version: number }>())!.version;
const columnsOf = async (table = TABLE) => (await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string; type: string }>()).results;
const propertyCount = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM cfg_property p JOIN cfg_data_source d ON d.id = p.data_source_id WHERE d.key = 'synthetic'").first<{ n: number }>())!.n;

async function addSyntheticSource(ddl = `CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, title TEXT NOT NULL, created_by TEXT, updated_by TEXT)`, table = TABLE) {
  await env.DB.exec(`DROP TABLE IF EXISTS ${table}`);
  await env.DB.prepare(ddl).run();
  const app = (await env.DB.prepare("SELECT id FROM cfg_application").first<{ id: string }>())!;
  await env.DB.prepare("INSERT INTO cfg_data_source (id,application_id,key,label,table_name,primary_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind("dsr_" + "a".repeat(16), app.id, "synthetic", "Synthetic", table, "id", now, now).run();
  for (const [i, p] of [["id", "uniqueId"], ["title", "title"]].entries()) {
    await env.DB.prepare("INSERT INTO cfg_property (id,data_source_id,key,label,column_name,type,nullable,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind("prp_" + String(i + 1).padStart(16, "0"), "dsr_" + "a".repeat(16), p[0], p[0], p[0], p[1], 1, i + 1, now, now).run();
  }
}

let n = 0;
const opId = () => `op_test_${String(++n).padStart(6, "0")}`;
const add = (params: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ operation: "add_property", params: { dataSource: "synthetic", key: "qty", type: "number", ...params }, ...extra });
const apply = (params: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => call("POST", "/api/platform/schema-changes", add(params, { operationId: opId(), confirm: true, ...extra }));
const preview = (params: Record<string, unknown> = {}) => call("POST", "/api/platform/schema-changes/preview", add(params));

beforeEach(async () => { await installSeed(env.DB, imamMobileSeed, actor); await addSyntheticSource(); });
afterEach(async () => { await env.DB.exec("DROP TABLE IF EXISTS synthetic_items; DROP TABLE IF EXISTS synthetic_wide; DROP TABLE IF EXISTS rb_t; DROP TABLE IF EXISTS rb_u;"); });

describe("D1 batch behavior the service relies on", () => {
  it("undoes an ALTER TABLE when a later statement in the same batch fails", async () => {
    await env.DB.exec("CREATE TABLE rb_t (id INTEGER PRIMARY KEY, a TEXT); CREATE TABLE rb_u (id INTEGER PRIMARY KEY)");
    await env.DB.prepare("INSERT INTO rb_u (id) VALUES (1)").run();
    await expect(env.DB.batch([
      env.DB.prepare('ALTER TABLE "rb_t" ADD COLUMN "b" TEXT'),
      env.DB.prepare("INSERT INTO rb_u (id) VALUES (2)"),
      env.DB.prepare("INSERT INTO rb_u (id) VALUES (1)")
    ])).rejects.toThrow();
    expect((await columnsOf("rb_t")).map((c) => c.name)).toEqual(["id", "a"]);
    expect(await count("rb_u")).toBe(1);
  });
});

describe("preview", () => {
  it("shows the SQL, affected rows, capacity and plan, and changes nothing", async () => {
    await env.DB.prepare(`INSERT INTO ${TABLE} (title) VALUES ('a'), ('b')`).run();
    const v = await activeVersion();
    const r = await preview({ label: "Quantity" });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({
      operation: "add_property", mode: "guided_live", dataSource: "synthetic", table: TABLE,
      sql: `ALTER TABLE "${TABLE}" ADD COLUMN "qty" INTEGER`,
      property: { key: "qty", label: "Quantity", columnName: "qty", type: "number", nullable: true, position: 3 },
      affectedRows: { existing: 2, capped: false, rewritten: 0 },
      capacity: { before: 4, after: 5, limit: 100, warnAt: 80, remainingAfter: 95, warning: false },
      backupRequired: false, releaseVersion: v + 1
    });
    expect(r.json.planHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(r.headers.get("x-rows-written"))).toBe(0);
    expect((await columnsOf()).map((c) => c.name)).toEqual(["id", "title", "created_by", "updated_by"]);
    expect(await activeVersion()).toBe(v);
    expect(await count("schema_change_log")).toBe(0);
  });

  it("generates the column type from the property type", async () => {
    const sql = async (params: Record<string, unknown>) => (await preview({ key: "c1", ...params })).json.sql as string;
    expect(await sql({ type: "text" })).toMatch(/ TEXT$/);
    expect(await sql({ type: "date" })).toMatch(/ TEXT$/);
    expect(await sql({ type: "number" })).toMatch(/ INTEGER$/);
    expect(await sql({ type: "number", config: { integer: false, decimals: 2 } })).toMatch(/ REAL$/);
    expect(await sql({ type: "currency", config: { currency: "PKR" } })).toMatch(/ INTEGER$/);
    expect(await sql({ type: "checkbox" })).toMatch(/ INTEGER$/);
    expect(await sql({ type: "select", config: { options: [{ key: "a", label: "A", color: "blue", active: true }] } })).toMatch(/ TEXT$/);
  });

  it("warns when the new column brings the table to 80 columns", async () => {
    await addWide(79);
    const r = await preview();
    expect(r.json.capacity).toMatchObject({ before: 79, after: 80, remainingAfter: 20, warning: true });
  });
});

async function addWide(columns: number) {
  await env.DB.exec(`DELETE FROM cfg_property WHERE data_source_id = 'dsr_aaaaaaaaaaaaaaaa'; DELETE FROM cfg_data_source WHERE id = 'dsr_aaaaaaaaaaaaaaaa'; DROP TABLE IF EXISTS ${TABLE}`);
  await addSyntheticSource(`CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, title TEXT NOT NULL, ${Array.from({ length: columns - 2 }, (_, i) => `c${i} TEXT`).join(", ")})`);
}

describe("apply", () => {
  it("adds the column, the property, a release, a log entry and an audit event together", async () => {
    const v = await activeVersion();
    const r = await apply({ label: "Quantity" });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ status: "applied", repeated: false, releaseVersion: v + 1 });
    expect((await columnsOf()).find((c) => c.name === "qty")?.type).toBe("INTEGER");
    expect(await activeVersion()).toBe(v + 1);
    const props = (await call("GET", "/api/platform/properties?dataSource=synthetic")).json.properties;
    expect(props.map((p: any) => p.key)).toEqual(["id", "title", "qty"]);
    expect(props[2]).toMatchObject({ label: "Quantity", columnName: "qty", type: "number", nullable: true });
    const log = (await call("GET", "/api/platform/schema-changes?dataSource=synthetic")).json.changes;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ operation: "add_property", dataSource: "synthetic", mode: "guided_live", releaseVersion: v + 1, sql: `ALTER TABLE "${TABLE}" ADD COLUMN "qty" INTEGER` });
    expect((await env.DB.prepare("SELECT action, outcome FROM audit_events WHERE action = 'schema.add_property'").all()).results).toEqual([{ action: "schema.add_property", outcome: "success" }]);
    const schema = (await call("GET", "/api/platform/schema?dataSource=synthetic")).json;
    expect(schema.mapped.map((m: any) => m.column)).toContain("qty");
    expect(schema.adoptable).toEqual([]);
    // Measured cost, recorded in the Story 04 notes.
    expect(Number(r.headers.get("x-rows-written"))).toBeLessThanOrEqual(17); // measured: 17 written
    expect(Number(r.headers.get("x-rows-read"))).toBeLessThanOrEqual(165); // measured: 162 read;
  });

  it("leaves existing rows unchanged: the new column is NULL", async () => {
    await env.DB.prepare(`INSERT INTO ${TABLE} (title) VALUES ('a'), ('b')`).run();
    await apply();
    const rows = (await env.DB.prepare(`SELECT title, qty FROM ${TABLE} ORDER BY id`).all()).results;
    expect(rows).toEqual([{ title: "a", qty: null }, { title: "b", qty: null }]);
  });

  it("stores select options in the property configuration", async () => {
    const options = [{ key: "red", label: "Red", color: "red", active: true }];
    const r = await apply({ key: "color", type: "select", config: { options } });
    expect(r.status).toBe(201);
    const p = (await call("GET", "/api/platform/properties?dataSource=synthetic")).json.properties.find((x: any) => x.key === "color");
    expect(p.config.options).toEqual([{ active: true, color: "red", key: "red", label: "Red" }]);
  });

  it("repeating an operation ID returns the first result and changes nothing", async () => {
    const id = opId();
    const body = add({}, { operationId: id, confirm: true });
    const first = await call("POST", "/api/platform/schema-changes", body);
    const v = await activeVersion();
    const second = await call("POST", "/api/platform/schema-changes", body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ repeated: true, releaseVersion: first.json.releaseVersion, operationId: id });
    expect(await activeVersion()).toBe(v);
    expect(await count("schema_change_log")).toBe(1);
    expect(await propertyCount()).toBe(3);
    expect(Number(second.headers.get("x-rows-written"))).toBeLessThanOrEqual(2);
    // The same ID with a different change is refused.
    const other = await call("POST", "/api/platform/schema-changes", add({ key: "other" }, { operationId: id, confirm: true }));
    expect(other.status).toBe(409);
    expect(other.json.code).toBe("OPERATION_ID_REUSED");
  });

  it("needs a valid operation ID and an explicit confirmation", async () => {
    const noConfirm = await call("POST", "/api/platform/schema-changes", add({}, { operationId: opId() }));
    expect(noConfirm.status).toBe(400);
    expect(noConfirm.json.code).toBe("CONFIRMATION_REQUIRED");
    expect((await call("POST", "/api/platform/schema-changes", add({}, { operationId: opId(), confirm: "yes" }))).status).toBe(400);
    for (const operationId of [undefined, "", "short", "has space in id", "x".repeat(65), "op;DROP TABLE x"]) {
      expect((await call("POST", "/api/platform/schema-changes", add({}, { operationId, confirm: true }))).status, String(operationId)).toBe(400);
    }
    expect((await columnsOf()).length).toBe(4);
  });

  it("checks the plan hash from the preview", async () => {
    const p = await preview();
    const stale = await apply({}, { planHash: "0".repeat(64) });
    expect(stale.status).toBe(409);
    expect(stale.json.code).toBe("PLAN_CHANGED");
    expect((await columnsOf()).length).toBe(4);
    const ok = await apply({}, { planHash: p.json.planHash });
    expect(ok.status).toBe(201);
    // A change made after the preview invalidates its hash.
    const p2 = await preview({ key: "second" });
    await apply({ key: "third" });
    expect((await apply({ key: "second" }, { planHash: p2.json.planHash })).json.code).toBe("PLAN_CHANGED");
  });

  it("is permitted only with the schema change permission", async () => {
    const r = await callWithEnv({ AUTH_MODE: undefined }, "POST", "/api/platform/schema-changes", add({}, { operationId: opId(), confirm: true }));
    expect(r.status).toBe(403);
    expect((await callWithEnv({ AUTH_MODE: undefined }, "POST", "/api/platform/schema-changes/preview", add({}))).status).toBe(403);
    expect((await callWithEnv({ AUTH_MODE: undefined }, "GET", "/api/platform/schema-changes")).status).toBe(403);
  });
});

describe("what is not accepted", () => {
  it("accepts no SQL, no free text and no unknown fields", async () => {
    expect((await apply({ sql: "ALTER TABLE x" })).status).toBe(400);
    expect((await apply({ default: "x" })).status).toBe(400);
    expect((await call("POST", "/api/platform/schema-changes", { ...add({}, { operationId: opId(), confirm: true }), sql: "DROP TABLE x" })).status).toBe(400);
    for (const key of ['qty"; DROP TABLE synthetic_items; --', "Qty", "1qty", "qty name", "", "a".repeat(65), "qty'"]) {
      expect((await apply({ key })).status, key).toBe(400);
    }
    expect((await apply({ columnName: 'x" TEXT; DROP TABLE y; --' })).status).toBe(400);
    expect((await apply({ dataSource: "synthetic; DROP" })).status).toBe(404);
    expect((await columnsOf()).length).toBe(4);
    expect(await count("schema_change_log")).toBe(0);
  });

  it("refuses reserved column names, unknown operations, unavailable types and migration_controlled", async () => {
    for (const columnName of ["id", "rowid", "created_at", "updated_at", "created_by", "updated_by"]) expect((await apply({ columnName })).status, columnName).toBe(400);
    expect((await call("POST", "/api/platform/schema-changes/preview", { operation: "drop_table", params: {} })).status).toBe(400);
    for (const type of ["relation", "multiSelect", "uniqueId", "createdTime", "bogus"]) expect((await apply({ type })).status, type).toBe(400);
    expect((await apply({ type: "relation" })).json.code).toBe("TYPE_UNAVAILABLE");
    const m = await call("POST", "/api/platform/schema-changes", add({}, { operationId: opId(), confirm: true, mode: "migration_controlled" }));
    expect(m.status).toBe(400);
    expect(m.json.code).toBe("MODE_UNAVAILABLE");
  });

  it("validates settings with the same rules as property updates", async () => {
    expect((await apply({ type: "currency" })).status).toBe(400);
    expect((await apply({ type: "select", config: { options: [] }, defaultValue: "x" })).status).toBe(400);
    expect((await apply({ label: "" })).status).toBe(400);
    expect((await columnsOf()).length).toBe(4);
  });

  it("refuses an existing column or property and points to Add as property", async () => {
    const r = await apply({ key: "created_by_note", columnName: "title" });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("COLUMN_EXISTS");
    await apply({ key: "qty" });
    const dup = await apply({ key: "qty", columnName: "qty_two" });
    expect(dup.json.code).toBe("PROPERTY_EXISTS");
  });

  it("refuses when the table has 100 columns and allows the 100th", async () => {
    await addWide(99);
    const ok = await apply();
    expect(ok.status).toBe(201);
    expect(ok.json.plan.capacity).toMatchObject({ after: 100, remainingAfter: 0, warning: true });
    const full = await apply({ key: "one_more" });
    expect(full.status).toBe(409);
    expect(full.json).toMatchObject({ code: "COLUMN_LIMIT", details: { columns: 100, limit: 100, remaining: 0 } });
    expect((await columnsOf()).length).toBe(100);
  });
});

describe("failures", () => {
  it("reports a missing log table as a pending migration", async () => {
    await env.DB.exec("ALTER TABLE schema_change_log RENAME TO schema_change_log_hidden");
    try {
      const r = await apply();
      expect(r.status).toBe(503);
      expect(r.json.code).toBe("MIGRATION_PENDING");
      expect((await columnsOf()).length).toBe(4);
    } finally { await env.DB.exec("ALTER TABLE schema_change_log_hidden RENAME TO schema_change_log"); }
  });

  it("leaves the table, the configuration, the log and the release unchanged when the batch fails", async () => {
    const v = await activeVersion();
    const app = (await env.DB.prepare("SELECT id FROM cfg_application").first<{ id: string }>())!;
    // A release with the next version already exists, as if another change had just been published.
    await env.DB.prepare("INSERT INTO cfg_release (id,application_id,version,snapshot_json,snapshot_hash,config_schema_version,min_platform_version,summary,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind("rel_" + "9".repeat(16), app.id, v + 1, "{}", "x", 1, "0.1.0", "competing", now).run();
    const r = await apply();
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("SCHEMA_CHANGE_FAILED");
    expect((await columnsOf()).map((c) => c.name)).toEqual(["id", "title", "created_by", "updated_by"]);
    expect(await propertyCount()).toBe(2);
    expect(await count("schema_change_log")).toBe(0);
    expect(await activeVersion()).toBe(v);
    expect((await env.DB.prepare("SELECT outcome FROM audit_events WHERE action = 'schema.add_property'").all()).results).toEqual([{ outcome: "failed" }]);
  });

  it("recovers a column that exists without a property through Add as property", async () => {
    await env.DB.exec(`ALTER TABLE ${TABLE} ADD COLUMN "orphan" TEXT`);
    expect((await apply({ key: "orphan" })).json.code).toBe("COLUMN_EXISTS");
    const adopt = await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "orphan", type: "text" });
    expect(adopt.status).toBe(201);
  });

  it("refuses to change a data source whose configuration no longer matches its table", async () => {
    await env.DB.prepare("INSERT INTO cfg_property (id,data_source_id,key,label,column_name,type,nullable,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind("prp_" + "7".repeat(16), "dsr_" + "a".repeat(16), "ghost", "Ghost", "ghost", "text", 1, 9, now, now).run();
    const r = await apply();
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("SCHEMA_DRIFT");
    expect((await columnsOf()).length).toBe(4);
  });
});
