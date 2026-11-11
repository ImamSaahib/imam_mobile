import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env } from "cloudflare:workers";
import { call, callWithEnv } from "./helpers";
import { installSeed } from "../src/platform/config/seed";
import { deriveSeedId } from "../src/platform/config/ids";
import { imamMobileSeed } from "../../applications/imam-mobile/seed/package";

const actor = { id: "dev-placeholder", kind: "placeholder" as const, permissions: ["*"] };
const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
const activeVersion = async () => (await env.DB.prepare("SELECT version FROM cfg_active_release").first<{ version: number }>())!.version;
const now = "2026-11-11T00:00:00.000Z";

/** A data source over a table the test creates. The table is dropped after each test. */
async function addSyntheticSource(table: string, ddl: string, mapped: { key: string; column: string; type: string }[]) {
  await env.DB.exec(`DROP TABLE IF EXISTS ${table}`);
  await env.DB.prepare(ddl).run();
  const app = (await env.DB.prepare("SELECT id FROM cfg_application").first<{ id: string }>())!;
  const dsId = "dsr_" + "a".repeat(16);
  await env.DB.prepare("INSERT INTO cfg_data_source (id,application_id,key,label,table_name,primary_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(dsId, app.id, "synthetic", "Synthetic", table, "id", now, now).run();
  let position = 0;
  for (const p of mapped) {
    await env.DB.prepare("INSERT INTO cfg_property (id,data_source_id,key,label,column_name,type,nullable,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind("prp_" + String(++position).padStart(16, "0"), dsId, p.key, p.key, p.column, p.type, 1, position, now, now).run();
  }
}

const TABLE = "synthetic_items";
const DDL = `CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, title TEXT NOT NULL, qty INTEGER, weight REAL, due TEXT, note TEXT NOT NULL DEFAULT '', blob_data BLOB, created_by TEXT, updated_by TEXT)`;
const MAPPED = [{ key: "id", column: "id", type: "uniqueId" }, { key: "title", column: "title", type: "title" }];

beforeEach(async () => { await installSeed(env.DB, imamMobileSeed, actor); });
afterEach(async () => { await env.DB.exec("DROP TABLE IF EXISTS synthetic_items; DROP TABLE IF EXISTS synthetic_wide;"); });

describe("schema inspection", () => {
  it("reports columns, system columns, indexes, capacity and a bounded row count for devices", async () => {
    const r = await call("GET", "/api/platform/schema?dataSource=devices");
    expect(r.status).toBe(200);
    const j = r.json;
    expect(j.tableName).toBe("mobile_devices");
    expect(j.columns).toHaveLength(15);
    expect(j.columns.filter((c: any) => c.system).map((c: any) => c.name).sort()).toEqual(["created_by", "updated_by"]);
    expect(j.columns.find((c: any) => c.name === "imei").property).toBe("imei");
    expect(j.unmapped).toEqual([]);
    expect(j.adoptable).toEqual([]);
    expect(j.capacity).toEqual({ columns: 15, limit: 100, warnAt: 80, remaining: 85, state: "ok" });
    expect(j.rowCount).toEqual({ value: 0, capped: false });
    const imei = j.indexes.find((i: any) => i.columns.join() === "imei");
    expect(imei?.unique).toBe(true);
    // Measured cost, recorded in the Story 04 notes.
    const read = Number(r.headers.get("x-rows-read")), written = Number(r.headers.get("x-rows-written"));
    expect(written).toBe(0);
    expect(read).toBeLessThanOrEqual(90);
  });

  it("returns 404 for an unknown data source and 400 without one", async () => {
    expect((await call("GET", "/api/platform/schema?dataSource=nope")).status).toBe(404);
    expect((await call("GET", "/api/platform/schema")).status).toBe(400);
  });

  it("caps the row count at 1,000 and says so", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    for (let i = 0; i < 1100; i += 100) {
      await env.DB.batch(Array.from({ length: 100 }, (_, k) => env.DB.prepare(`INSERT INTO ${TABLE} (title) VALUES (?)`).bind(`t${i + k}`)));
    }
    const r = await call("GET", "/api/platform/schema?dataSource=synthetic");
    expect(r.json.rowCount).toEqual({ value: 1000, capped: true });
    expect(Number(r.headers.get("x-rows-read"))).toBeLessThan(1100);
  });

  it("reports capacity at 79, 80 and 100 columns", async () => {
    const make = (n: number) => `CREATE TABLE synthetic_wide (id INTEGER PRIMARY KEY, ${Array.from({ length: n - 1 }, (_, i) => `c${i} TEXT`).join(", ")})`;
    const state = async (n: number) => {
      await env.DB.exec("DROP TABLE IF EXISTS synthetic_wide");
      await env.DB.exec("DELETE FROM cfg_property WHERE data_source_id = 'dsr_aaaaaaaaaaaaaaaa'");
      await env.DB.exec("DELETE FROM cfg_data_source WHERE id = 'dsr_aaaaaaaaaaaaaaaa'");
      await addSyntheticSource("synthetic_wide", make(n), [{ key: "id", column: "id", type: "uniqueId" }]);
      return (await call("GET", "/api/platform/schema?dataSource=synthetic")).json.capacity;
    };
    expect(await state(79)).toMatchObject({ columns: 79, remaining: 21, state: "ok" });
    expect(await state(80)).toMatchObject({ columns: 80, remaining: 20, state: "warning" });
    expect(await state(100)).toMatchObject({ columns: 100, remaining: 0, state: "full" });
  });

  it("requires the inspect permission", async () => {
    expect((await callWithEnv({ AUTH_MODE: undefined }, "GET", "/api/platform/schema?dataSource=devices")).status).toBe(403);
  });
});

describe("adopting an unmapped column", () => {
  it("lists adoptable columns with the types each can become, and leaves system and binary columns out", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    const j = (await call("GET", "/api/platform/schema?dataSource=synthetic")).json;
    expect(j.system.map((c: any) => c.column).sort()).toEqual(["created_by", "updated_by"]);
    const by = Object.fromEntries(j.adoptable.map((a: any) => [a.column, a]));
    expect(Object.keys(by).sort()).toEqual(["due", "note", "qty", "weight"]);
    expect(by.qty.types).toEqual(expect.arrayContaining(["number", "currency", "checkbox"]));
    expect(by.qty.nullable).toBe(true);
    expect(by.note.nullable).toBe(false);
    expect(by.weight.types).toEqual(["number"]);
    expect(by.due.types).toEqual(expect.arrayContaining(["text", "date", "timestamp", "email"]));
  });

  it("adopts a column: property, new release, audit event, no change to the table", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    const before = await activeVersion();
    const columnsBefore = (await env.DB.prepare(`PRAGMA table_info(${TABLE})`).all()).results.length;
    const r = await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "qty", type: "number", releaseVersion: before });
    expect(r.status).toBe(201);
    expect(r.json.releaseVersion).toBe(before + 1);
    expect(r.json.property).toMatchObject({ key: "qty", label: "Qty", columnName: "qty", type: "number", nullable: true, position: 3, dataSource: "synthetic" });
    expect(await activeVersion()).toBe(before + 1);
    expect((await env.DB.prepare(`PRAGMA table_info(${TABLE})`).all()).results.length).toBe(columnsBefore);
    const audit = await env.DB.prepare("SELECT action FROM audit_events WHERE action = 'property.adopt'").all();
    expect(audit.results).toHaveLength(1);
    const listed = (await call("GET", "/api/platform/properties?dataSource=synthetic")).json.properties.map((p: any) => p.key);
    expect(listed).toEqual(["id", "title", "qty"]);
    const schema = (await call("GET", "/api/platform/schema?dataSource=synthetic")).json;
    expect(schema.adoptable.map((a: any) => a.column)).not.toContain("qty");
    // A configuration change, not a record write, so the 10-row record budget does not apply. Measured: 13.
    expect(Number(r.headers.get("x-rows-written"))).toBeLessThanOrEqual(15);
    expect(Number(r.headers.get("x-rows-read"))).toBeLessThanOrEqual(100);
  });

  it("accepts a label, a currency configuration and a not-null column", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    const r = await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "qty", type: "currency", label: "Amount", config: { currency: "PKR", scale: 0, min: 0, max: 100000000 } });
    expect(r.status).toBe(201);
    expect(r.json.property.config).toMatchObject({ currency: "PKR", scale: 0 });
    const n = await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "note", type: "text" });
    expect(n.json.property.nullable).toBe(false);
  });

  it("refuses a column that does not exist, is a system column, is the primary key or is already mapped", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    const adopt = (column: string, type = "text") => call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column, type });
    expect((await adopt("ghost")).json.code).toBe("COLUMN_NOT_FOUND");
    expect((await adopt("created_by")).json.code).toBe("COLUMN_RESERVED");
    expect((await adopt("id", "number")).json.code).toBe("ALREADY_MAPPED");
    expect((await adopt("title")).json.code).toBe("ALREADY_MAPPED");
    expect((await adopt("blob_data")).json.code).toBe("TYPE_INCOMPATIBLE");
    await adopt("due");
    expect((await adopt("due")).status).toBe(409);
  });

  it("refuses an incompatible type and names the allowed ones", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    const r = await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "weight", type: "currency" });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("TYPE_INCOMPATIBLE");
    expect(r.json.details.allowed).toEqual(["number"]);
    expect((await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "qty", type: "uniqueId" })).json.code).toBe("TYPE_INCOMPATIBLE");
    expect((await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "qty", type: "bogus" })).status).toBe(400);
  });

  it("does not accept SQL, odd identifiers or unknown fields", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    const before = await activeVersion();
    for (const column of ['qty"; DROP TABLE synthetic_items; --', "Qty", "qty ", "", "a".repeat(80)]) {
      expect((await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column, type: "number" })).status, column).toBe(400);
    }
    expect((await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "qty", type: "number", sql: "ALTER TABLE x" })).status).toBe(400);
    expect((await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic; DROP", column: "qty", type: "number" })).status).toBe(404);
    expect(await activeVersion()).toBe(before);
    expect((await env.DB.prepare(`PRAGMA table_info(${TABLE})`).all()).results.length).toBe(9);
  });

  it("refuses a stale release version and a competing change without writing anything", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    const v = await activeVersion();
    const stale = await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "qty", type: "number", releaseVersion: v - 1 });
    expect(stale.status).toBe(409);
    expect(stale.json.code).toBe("STALE_RELEASE");
    expect(await activeVersion()).toBe(v);
    expect((await call("GET", "/api/platform/properties?dataSource=synthetic")).json.properties).toHaveLength(2);
  });

  it("requires the configure permission", async () => {
    await addSyntheticSource(TABLE, DDL, MAPPED);
    const r = await callWithEnv({ AUTH_MODE: undefined }, "POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "qty", type: "number" });
    expect(r.status).toBe(403);
  });
});

describe("metadata cannot expose a column that is absent from the table", () => {
  it("refuses to publish any change for a data source whose mapped column is missing", async () => {
    await addSyntheticSource(TABLE, DDL, [...MAPPED, { key: "ghost", column: "ghost", type: "text" }]);
    const v = await activeVersion();
    const audits = await count("audit_events");
    const adopt = await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "qty", type: "number" });
    expect(adopt.status).toBe(409);
    expect(adopt.json.code).toBe("SCHEMA_DRIFT");
    expect(adopt.json.details.missing).toEqual([{ property: "ghost", column: "ghost" }]);
    const patch = await call("PATCH", "/api/platform/properties", { propertyId: "prp_" + "1".padStart(16, "0"), label: "Renamed" });
    expect(patch.status).toBe(409);
    expect(patch.json.code).toBe("SCHEMA_DRIFT");
    expect(await activeVersion()).toBe(v);
    expect(await count("audit_events")).toBe(audits);
  });

  it("refuses a change when a mapped column has an incompatible type, and reports the table as missing", async () => {
    await addSyntheticSource(TABLE, DDL, [...MAPPED, { key: "qty", column: "qty", type: "text" }]);
    expect((await call("POST", "/api/platform/properties/adopt", { dataSource: "synthetic", column: "due", type: "text" })).json.code).toBe("SCHEMA_DRIFT");
    await env.DB.exec(`DROP TABLE ${TABLE}`);
    const schema = await call("GET", "/api/platform/schema?dataSource=synthetic");
    expect(schema.status).toBe(200);
    expect(schema.json.tableExists).toBe(false);
    expect(schema.json.columns).toEqual([]);
  });

  it("does not block changes to the installed Imam Mobile properties", async () => {
    const id = await deriveSeedId("imam-mobile", "property", "devices.model");
    expect((await call("PATCH", "/api/platform/properties", { propertyId: id, label: "Phone model" })).status).toBe(200);
  });
});
