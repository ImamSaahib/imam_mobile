// Characterization of the legacy Admin Studio backend (see docs/platform/legacy-inventory.md).
// These tests pin today's behavior so Stories 04, 07 and 11 change or remove it deliberately.
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { callWithEnv, createDevice } from "./helpers";

const TOKEN = "test-admin-token";
const auth = { Authorization: `Bearer ${TOKEN}` };
const admin = (method: string, path: string, body?: unknown, headers: Record<string, string> = auth) => callWithEnv({ ADMIN_CONFIG_TOKEN: TOKEN }, method, path, body, headers);

const validConfig = (title = "Dashboard") => ({ schemaVersion: 1, pages: [{ id: "dashboard", title, enabled: true }], components: [], fields: [], reports: [] });

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("UPDATE app_configuration SET draft_json=published_json, published_version=1 WHERE id=1"),
    env.DB.prepare("DELETE FROM configuration_versions WHERE version>1"),
    env.DB.prepare("DELETE FROM schema_changes")
  ]);
});

describe("legacy configuration routes", () => {
  it("serves the seeded published configuration publicly with an edge cache", async () => {
    const r = await callWithEnv({}, "GET", "/api/configuration");
    expect(r.json.version).toBe(1);
    expect(r.json.configuration.pages.map((p: any) => p.id)).toContain("inventory");
    expect(r.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");
  });
  it("saves a draft without changing what is published", async () => {
    expect((await admin("PUT", "/api/admin/configuration", { configuration: validConfig("Draft title") })).status).toBe(200);
    const admins = await admin("GET", "/api/admin/configuration");
    expect(admins.json.draft.pages[0].title).toBe("Draft title");
    expect(admins.json.published.pages.length).toBeGreaterThan(1);
    expect(admins.json.version).toBe(1);
  });
  it("rejects an invalid or oversized configuration", async () => {
    expect((await admin("PUT", "/api/admin/configuration", { configuration: { schemaVersion: 2 } })).status).toBe(400);
    const big = validConfig(); (big as any).fields = [{ key: "x".repeat(100001) }];
    expect((await admin("PUT", "/api/admin/configuration", { configuration: big })).status).toBe(413);
  });
  it("publishes the draft as the next version, lists versions and restores one into the draft", async () => {
    await admin("PUT", "/api/admin/configuration", { configuration: validConfig("Version two") });
    const published = await admin("POST", "/api/admin/configuration/publish", { summary: "Second" });
    expect(published.json).toEqual({ published: true, version: 2 });
    expect((await callWithEnv({}, "GET", "/api/configuration")).json.configuration.pages[0].title).toBe("Version two");
    const versions = await admin("GET", "/api/admin/configuration/versions");
    expect(versions.json.versions.map((v: any) => v.version)).toEqual([2, 1]);
    const restored = await admin("POST", "/api/admin/configuration/restore", { version: 1 });
    expect(restored.json.restored).toBe(true);
    expect((await admin("GET", "/api/admin/configuration")).json.draft.pages.length).toBeGreaterThan(1);
    expect((await admin("POST", "/api/admin/configuration/restore", { version: 99 })).status).toBe(404);
    expect((await admin("POST", "/api/admin/configuration/restore", { version: 0 })).status).toBe(400);
  });
  it("is unavailable when no admin token is configured", async () => {
    const r = await callWithEnv({ ADMIN_CONFIG_TOKEN: undefined }, "GET", "/api/admin/configuration", undefined, { Authorization: "Bearer undefined" });
    expect(r.status).toBe(401);
  });
});

describe("legacy schema routes (live DDL, shared token)", () => {
  it("requires the token on every schema route", async () => {
    for (const [m, p] of [["GET", "/api/admin/schema"], ["POST", "/api/admin/schema/columns"], ["POST", "/api/admin/schema/indexes"], ["POST", "/api/admin/schema/add-column"]]) {
      expect((await admin(m, p, m === "POST" ? {} : undefined, {})).status, `${m} ${p}`).toBe(401);
    }
  });
  it("inspects application tables and hides platform tables", async () => {
    const r = await admin("GET", "/api/admin/schema");
    const names = r.json.tables.map((t: any) => t.name);
    expect(names).toEqual(expect.arrayContaining(["mobile_devices", "customers", "sales", "customer_entries"]));
    for (const hidden of ["app_configuration", "configuration_versions", "schema_changes", "custom_field_values"]) expect(names).not.toContain(hidden);
  });
  it("adds a nullable column with a log row, and refuses a duplicate", async () => {
    const r = await admin("POST", "/api/admin/schema/columns", { table: "customers", column: "legacy_note_a", type: "text" });
    expect(r.json).toEqual({ applied: true, table: "customers", column: "legacy_note_a", type: "TEXT" });
    expect((await admin("POST", "/api/admin/schema/columns", { table: "customers", column: "legacy_note_a", type: "TEXT" })).status).toBe(409);
    const log = await env.DB.prepare("SELECT column_name, status FROM schema_changes").all();
    expect(log.results).toEqual([{ column_name: "legacy_note_a", status: "applied" }]);
  });
  it("rejects an unknown table, a bad column name or an unsupported type", async () => {
    for (const bad of [{ table: "app_configuration" }, { table: "nope" }, { column: "Bad Name" }, { column: "1abc" }, { type: "JSON" }]) {
      const r = await admin("POST", "/api/admin/schema/columns", { table: "customers", column: "legacy_ok", type: "TEXT", ...bad });
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
  });
  it("creates and drops a custom index, and refuses dropping other indexes", async () => {
    const created = await admin("POST", "/api/admin/schema/indexes", { table: "customers", columns: ["type"] });
    expect(created.json).toMatchObject({ applied: true, name: "idx_customers_type" });
    expect((await admin("POST", "/api/admin/schema/indexes", { table: "customers", columns: ["type"] })).status).toBe(409);
    expect((await admin("POST", "/api/admin/schema/indexes", { table: "customers", columns: ["missing_col"] })).status).toBe(400);
    expect((await admin("POST", "/api/admin/schema/indexes", { table: "customers", action: "drop", name: "sqlite_autoindex_customers_1" })).status).toBe(400);
    expect((await admin("POST", "/api/admin/schema/indexes", { table: "customers", action: "drop", name: "idx_customers_type" })).status).toBe(200);
  });
  it("adds a column through the older add-column route", async () => {
    const r = await admin("POST", "/api/admin/schema/add-column", { table: "sales", column: "legacy_note_b", type: "TEXT" });
    expect(r.status).toBe(200);
  });
});

describe("custom field values (metadata and physical storage)", () => {
  const publishFields = async (fields: unknown[]) => {
    await admin("PUT", "/api/admin/configuration", { configuration: { ...validConfig(), fields } });
    await admin("POST", "/api/admin/configuration/publish", { summary: "fields" });
  };
  it("stores a metadata field in custom_field_values and reads it back", async () => {
    const id = await createDevice();
    await publishFields([{ key: "warranty", label: "Warranty", table: "mobile_devices", type: "text", storage: "metadata" }]);
    const saved = await callWithEnv({}, "POST", "/api/custom-field-values", { table: "mobile_devices", recordId: id, values: { warranty: "12 months" } });
    expect(saved.json).toEqual({ saved: 1 });
    const r = await callWithEnv({}, "GET", `/api/custom-field-values?table=mobile_devices&recordId=${id}`);
    expect(r.json.values).toEqual({ warranty: "12 months" });
  });
  it("stores a physical field in the table column and leaves updated_by untouched", async () => {
    const id = await createDevice();
    await admin("POST", "/api/admin/schema/columns", { table: "mobile_devices", column: "legacy_grade", type: "TEXT" });
    await publishFields([{ key: "legacy_grade", label: "Grade", table: "mobile_devices", type: "text", storage: "physical" }]);
    await callWithEnv({}, "POST", "/api/custom-field-values", { table: "mobile_devices", recordId: id, values: { legacy_grade: "A" } });
    const row = await env.DB.prepare("SELECT legacy_grade FROM mobile_devices WHERE id=?").bind(id).first();
    expect(row).toEqual({ legacy_grade: "A" });
  });
  it("validates table, record, field, type and size", async () => {
    const id = await createDevice();
    await publishFields([{ key: "qty", label: "Qty", table: "mobile_devices", type: "number", storage: "metadata" }]);
    const post = (body: unknown) => callWithEnv({}, "POST", "/api/custom-field-values", body);
    expect((await post({ table: "app_configuration", recordId: id, values: {} })).status).toBe(400);
    expect((await post({ table: "mobile_devices", recordId: 999999, values: { qty: "1" } })).status).toBe(404);
    expect((await post({ table: "mobile_devices", recordId: id, values: { unknown: "1" } })).status).toBe(400);
    expect((await post({ table: "mobile_devices", recordId: id, values: { qty: "abc" } })).status).toBe(400);
    expect((await callWithEnv({}, "GET", "/api/custom-field-values?table=mobile_devices&recordId=abc")).status).toBe(400);
  });
});
