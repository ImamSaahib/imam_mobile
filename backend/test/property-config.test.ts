import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { call, callWithEnv } from "./helpers";
import { deriveSeedId } from "../src/platform/config/ids";
import { expandSeed, installSeed } from "../src/platform/config/seed";
import { previewUpgrade, applyUpgrade } from "../src/platform/config/seed-upgrade";
import { imamMobileSeed } from "../../applications/imam-mobile/seed/package";
import { imamMobileSeedV1 } from "./fixtures/seed-v1";

const actor = { id: "dev-placeholder", kind: "placeholder" as const, permissions: ["*"] };
const propertyId = (ds: string, key: string) => deriveSeedId("imam-mobile", "property", `${ds}.${key}`);
const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
const activeVersion = async () => (await env.DB.prepare("SELECT version FROM cfg_active_release").first<{ version: number }>())!.version;

/** Installs the frozen version 1 (what the dev database holds) and upgrades it to version 2 through the real upgrade path. */
async function installAndUpgrade() {
  await installSeed(env.DB, imamMobileSeedV1, actor);
  const plan = await previewUpgrade(env.DB, imamMobileSeed);
  const result = await applyUpgrade(env.DB, imamMobileSeed, { planHash: plan.planHash }, actor);
  return { plan, result };
}

describe("seed version 2", () => {
  it("keeps every seed ID from version 1 and adds no items", async () => {
    const v1 = await expandSeed(imamMobileSeedV1);
    const v2 = await expandSeed(imamMobileSeed);
    const ids = (r: typeof v1) => r.items.map((i) => `${i.itemType}:${i.seedKey}:${i.itemId}`).sort();
    expect(ids(v2)).toEqual(ids(v1));
    expect(v2.items.length).toBe(61);
  });

  it("previews the upgrade from version 1 as property updates only", async () => {
    await installSeed(env.DB, imamMobileSeedV1, actor);
    const plan = await previewUpgrade(env.DB, imamMobileSeed);
    expect(plan.fromVersion).toBe(1);
    expect(plan.toVersion).toBe(2);
    expect(plan.counts).toMatchObject({ add: 0, update: 14, conflict: 0, deprecate: 0, unchanged: 47 });
    expect(plan.items.every((i) => i.itemType === "property" && i.status === "update")).toBe(true);
    expect(plan.incompatible).toEqual([]);
    expect(plan.schemaOk).toBe(true);
    // Exactly these properties change: the five option columns of the old schema, the four amounts, the three ledger relations, and the sales relation.
    const changed = new Set(plan.items.map((i) => i.seedKey));
    expect(changed).toEqual(new Set([
      "devices.condition", "devices.status", "devices.purchase_price", "devices.sale_price",
      "customers.type",
      "ledger.customer_id", "ledger.sale_id", "ledger.device_id", "ledger.direction", "ledger.amount",
      "sales.customer_id", "sales.total_amount", "sales.payment_type", "sales.status"
    ]));
  });

  it("applies the upgrade, publishes release 2 and leaves unchanged properties in their old snapshot shape", async () => {
    await installSeed(env.DB, imamMobileSeedV1, actor);
    const before = await call("GET", "/api/bootstrap");
    const { result } = await installAndUpgradeFrom();
    expect(result).toMatchObject({ status: "applied", version: 2, releaseVersion: 2 });
    const after = await call("GET", "/api/bootstrap");
    const devices = after.json.shell.dataSources.find((d: any) => d.key === "devices");
    const model = devices.properties.find((p: any) => p.key === "model");
    const beforeModel = before.json.shell.dataSources.find((d: any) => d.key === "devices").properties.find((p: any) => p.key === "model");
    expect(model).toEqual(beforeModel);                                   // no settings keys appear on an unchanged property
    expect(Object.keys(model).sort()).toEqual(["columnName", "id", "key", "label", "nullable", "type"]);
    const status = devices.properties.find((p: any) => p.key === "status");
    expect(status.defaultValue).toBe("Available");
    expect(status.config.options.map((o: any) => o.key)).toEqual(["Available", "Booked", "Sold Out"]);
    const price = devices.properties.find((p: any) => p.key === "purchase_price");
    expect(price.type).toBe("currency");
    expect(price.config).toEqual({ currency: "PKR", scale: 0, min: 0, max: 100_000_000 });
    // A second preview has nothing left to do.
    const again = await previewUpgrade(env.DB, imamMobileSeed);
    expect(again.counts).toMatchObject({ update: 0, conflict: 0, unchanged: 61 });
  });

  it("uses option keys that the database tables already accept, so no stored value changes", async () => {
    const expanded = await expandSeed(imamMobileSeed);
    const checked: string[] = [];
    for (const ds of imamMobileSeed.dataSources) {
      const table = (await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(ds.tableName).first<{ sql: string }>())!.sql;
      for (const prop of ds.properties) {
        const options = (prop.config as { options?: { key: string }[] } | undefined)?.options;
        if (!options) continue;
        // The column's CHECK list must contain every option key as a quoted literal, and no other quoted literal in that column's CHECK.
        const columnCheck = new RegExp(`${prop.columnName}\\s+TEXT[^,]*?CHECK\\s*\\(\\s*${prop.columnName}\\s+IN\\s*\\((.*?)\\)\\s*\\)`, "s").exec(table)?.[1] ?? "";
        const literals = [...columnCheck.matchAll(/'([^']*)'/g)].map((m) => m[1]).sort();
        expect(literals, `${ds.key}.${prop.key}`).toEqual(options.map((o) => o.key).sort());
        checked.push(`${ds.key}.${prop.key}`);
      }
    }
    expect(checked.sort()).toEqual(["customers.type", "devices.condition", "devices.status", "ledger.direction", "sales.payment_type", "sales.status"]);
    expect(expanded.items.length).toBe(61);
  });

  it("gives every amount the owner's range, 0 to 100,000,000 PKR in whole rupees (the ledger amount must be above 0)", async () => {
    const amounts = imamMobileSeed.dataSources.flatMap((ds) => ds.properties.filter((p) => p.type === "currency").map((p) => ({ name: `${ds.key}.${p.key}`, config: p.config })));
    expect(amounts.map((a) => a.name).sort()).toEqual(["devices.purchase_price", "devices.sale_price", "ledger.amount", "sales.total_amount"]);
    for (const a of amounts) expect(a.config).toMatchObject({ currency: "PKR", scale: 0, max: 100_000_000, min: a.name === "ledger.amount" ? 1 : 0 });
  });

  it("does not change business records or the number of tables", async () => {
    await env.DB.prepare("INSERT INTO customers (name, type) VALUES ('Ali','Regular')").run();
    await installAndUpgrade();
    expect(await count("customers")).toBe(1);
    const row = await env.DB.prepare("SELECT name, type FROM customers").first<any>();
    expect(row).toEqual({ name: "Ali", type: "Regular" });
  });
});

async function installAndUpgradeFrom() {
  const plan = await previewUpgrade(env.DB, imamMobileSeed);
  const result = await applyUpgrade(env.DB, imamMobileSeed, { planHash: plan.planHash }, actor);
  return { plan, result };
}

describe("property routes", () => {
  beforeEach(async () => { await installAndUpgrade(); });

  it("describes the property types", async () => {
    const r = await call("GET", "/api/platform/property-types");
    expect(r.status).toBe(200);
    expect(r.json.types).toHaveLength(19);
    const currency = r.json.types.find((t: any) => t.type === "currency");
    expect(currency).toMatchObject({ writable: true, storage: ["INTEGER"], sortable: true });
  });

  it("lists the properties of one data source with their settings, and rejects an unknown data source", async () => {
    const r = await call("GET", "/api/platform/properties?dataSource=devices");
    expect(r.status).toBe(200);
    expect(r.json.properties).toHaveLength(13);
    const status = r.json.properties.find((p: any) => p.key === "status");
    expect(status).toMatchObject({ dataSource: "devices", type: "status", defaultValue: "Available", required: false, searchable: false, sensitivity: "normal" });
    expect(status.config.options[2]).toEqual({ key: "Sold Out", label: "Sold Out", color: "gray", group: "complete", active: true });
    const all = await call("GET", "/api/platform/properties");
    expect(all.json.properties).toHaveLength(13 + 6 + 10 + 8);
    expect((await call("GET", "/api/platform/properties?dataSource=nope")).status).toBe(404);
  });

  it("changes the label and description, publishes a release and records an audit event", async () => {
    const id = await propertyId("devices", "model");
    const releases = await count("cfg_release");
    const r = await call("PATCH", "/api/platform/properties", { propertyId: id, label: "Phone model", description: "The model name printed on the box." });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ status: "applied", releaseVersion: 3, changed: ["label", "description"] });
    expect(await count("cfg_release")).toBe(releases + 1);
    expect(await activeVersion()).toBe(3);
    const boot = await call("GET", "/api/bootstrap");
    const model = boot.json.shell.dataSources.find((d: any) => d.key === "devices").properties.find((p: any) => p.key === "model");
    expect(model).toMatchObject({ label: "Phone model", description: "The model name printed on the box." });
    const audit = await env.DB.prepare("SELECT action, entity_id, outcome FROM audit_events WHERE action='property.update'").all<any>();
    expect(audit.results).toEqual([{ action: "property.update", entity_id: id, outcome: "success" }]);
    // Measured cost of a configuration change, recorded in the story notes.
    const written = Number(r.headers.get("x-rows-written")), read = Number(r.headers.get("x-rows-read"));
    // Measured 2026-11-11: 86 rows read, 10 rows written. These limits catch a regression.
    expect(written).toBeLessThanOrEqual(10);
    expect(read).toBeLessThanOrEqual(100);
  });

  it("does nothing and publishes nothing when the request changes nothing", async () => {
    const id = await propertyId("devices", "model");
    const releases = await count("cfg_release");
    const r = await call("PATCH", "/api/platform/properties", { propertyId: id, label: "Model", required: false });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ status: "unchanged", releaseVersion: 2, changed: [] });
    expect(await count("cfg_release")).toBe(releases);
    expect(Number(r.headers.get("x-rows-written"))).toBe(0);
  });

  it("edits options: add, rename, recolor, reorder and deactivate, with keys kept", async () => {
    const id = await propertyId("devices", "status");
    const list = async () => (await call("GET", "/api/platform/properties?dataSource=devices")).json.properties.find((p: any) => p.key === "status");
    const current = (await list()).config.options as any[];
    const next = [
      { ...current[2], label: "Sold", color: "red" },            // rename and recolor, key stays "Sold Out"
      current[0],
      { ...current[1], active: false },                          // deactivate Booked
      { label: "Reserved", group: "in_progress", color: "purple" } // new option, key is made from the label
    ];
    const r = await call("PATCH", "/api/platform/properties", { propertyId: id, config: { options: next } });
    expect(r.status).toBe(200);
    const after = (await list()).config.options as any[];
    expect(after.map((o) => o.key)).toEqual(["Sold Out", "Available", "Booked", "reserved"]);
    expect(after[0]).toMatchObject({ label: "Sold", color: "red" });
    expect(after[2].active).toBe(false);
    const boot = await call("GET", "/api/bootstrap");
    const snap = boot.json.shell.dataSources.find((d: any) => d.key === "devices").properties.find((p: any) => p.key === "status");
    expect(snap.config.options.map((o: any) => o.key)).toEqual(["Sold Out", "Available", "Booked", "reserved"]);
  });

  it("refuses to remove an option or to deactivate the default", async () => {
    const id = await propertyId("devices", "status");
    const options = ((await call("GET", "/api/platform/properties?dataSource=devices")).json.properties.find((p: any) => p.key === "status").config.options) as any[];
    const removed = await call("PATCH", "/api/platform/properties", { propertyId: id, config: { options: options.filter((o) => o.key !== "Booked") } });
    expect(removed.status).toBe(409);
    expect(removed.json.code).toBe("OPTION_REMOVED");
    expect(removed.json.details.keys).toEqual(["Booked"]);
    const deactivated = await call("PATCH", "/api/platform/properties", { propertyId: id, config: { options: options.map((o) => (o.key === "Available" ? { ...o, active: false } : o)) } });
    expect(deactivated.status).toBe(400);
    expect(deactivated.json.code).toBe("PROPERTY_INVALID");
    expect(await activeVersion()).toBe(2);
  });

  it("locks the currency and scale of an amount, but allows a different limit", async () => {
    const id = await propertyId("devices", "purchase_price");
    const scale = await call("PATCH", "/api/platform/properties", { propertyId: id, config: { currency: "PKR", scale: 2, min: 0, max: 100_000_000 } });
    expect(scale.status).toBe(409);
    expect(scale.json).toMatchObject({ code: "CONFIG_LOCKED", details: { keys: ["scale"] } });
    const code = await call("PATCH", "/api/platform/properties", { propertyId: id, config: { currency: "USD", scale: 0, min: 0, max: 100_000_000 } });
    expect(code.status).toBe(409);
    const limit = await call("PATCH", "/api/platform/properties", { propertyId: id, config: { currency: "PKR", scale: 0, min: 0, max: 50_000_000 } });
    expect(limit.status).toBe(200);
    expect(limit.json.changed).toEqual(["config"]);
  });

  it("sets a relation target that was never set, and locks it afterwards", async () => {
    const id = await propertyId("ledger", "customer_id");
    const same = await call("PATCH", "/api/platform/properties", { propertyId: id, config: { target: "sales", displayProperty: "invoice_number", onDelete: "restrict" } });
    expect(same.status).toBe(409);
    expect(same.json.code).toBe("CONFIG_LOCKED");
  });

  it("changes required, default, searchable and sensitivity", async () => {
    const id = await propertyId("customers", "name");
    const r = await call("PATCH", "/api/platform/properties", { propertyId: id, required: true, searchable: true, sensitivity: "sensitive" });
    expect(r.status).toBe(200);
    expect(r.json.changed).toEqual(["required", "searchable", "sensitivity"]);
    const stored = (await call("GET", "/api/platform/properties?dataSource=customers")).json.properties.find((p: any) => p.key === "name");
    expect(stored).toMatchObject({ required: true, searchable: true, sensitivity: "sensitive" });
    const bad = await call("PATCH", "/api/platform/properties", { propertyId: await propertyId("devices", "purchase_price"), searchable: true });
    expect(bad.status).toBe(400);
    const badDefault = await call("PATCH", "/api/platform/properties", { propertyId: await propertyId("customers", "type"), defaultValue: "Nobody" });
    expect(badDefault.status).toBe(400);
  });

  it("refuses fields that are schema changes, unknown fields and bad input", async () => {
    const id = await propertyId("devices", "model");
    for (const body of [{ propertyId: id, type: "text" }, { propertyId: id, columnName: "other" }, { propertyId: id, nullable: true }, { propertyId: id, key: "x" }, { propertyId: id, surprise: 1 }]) {
      const r = await call("PATCH", "/api/platform/properties", body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.code).toBe("PROPERTY_INVALID");
    }
    expect((await call("PATCH", "/api/platform/properties", { label: "x" })).status).toBe(400);
    expect((await call("PATCH", "/api/platform/properties", { propertyId: id, label: "   " })).status).toBe(400);
    expect((await call("PATCH", "/api/platform/properties", { propertyId: id, label: "x".repeat(81) })).status).toBe(400);
    expect((await call("PATCH", "/api/platform/properties", { propertyId: "prp_0000000000000000" , label: "x" })).status).toBe(404);
    expect((await call("PATCH", "/api/platform/properties", "not an object" as never)).status).toBe(400);
    expect(await activeVersion()).toBe(2);
  });

  it("refuses a change made from an old release", async () => {
    const id = await propertyId("devices", "model");
    expect((await call("PATCH", "/api/platform/properties", { propertyId: id, label: "A", releaseVersion: 2 })).status).toBe(200);
    const stale = await call("PATCH", "/api/platform/properties", { propertyId: id, label: "B", releaseVersion: 2 });
    expect(stale.status).toBe(409);
    expect(stale.json).toMatchObject({ code: "STALE_RELEASE", details: { activeVersion: 3 } });
    const label = (await call("GET", "/api/platform/properties?dataSource=devices")).json.properties.find((p: any) => p.key === "model").label;
    expect(label).toBe("A");
  });

  it("leaves nothing half-written when the release number is already taken", async () => {
    const id = await propertyId("devices", "model");
    // Another change publishes release 3 between this change reading release 2 and writing.
    const auditsBefore = await count("audit_events");
    const real = env.DB.batch.bind(env.DB);
    const dbProxy = new Proxy(env.DB, { get: (t, k) => (k === "batch" ? async (s: D1PreparedStatement[]) => { await env.DB.prepare("INSERT INTO cfg_release (id,application_id,version,snapshot_json,snapshot_hash,config_schema_version,min_platform_version,created_at) SELECT 'rel_competing', application_id, 3, '{}', 'x', 1, '0.1.0', 'x' FROM cfg_active_release").run(); return real(s); } : (t as any)[k] instanceof Function ? (t as any)[k].bind(t) : (t as any)[k]) });
    const { updateProperty } = await import("../src/platform/config/property-config");
    await expect(updateProperty(dbProxy as unknown as D1Database, { propertyId: id, label: "Lost" }, actor)).rejects.toMatchObject({ code: "UPDATE_FAILED", status: 409 });
    const label = (await env.DB.prepare("SELECT label FROM cfg_property WHERE id=?").bind(id).first<{ label: string }>())!.label;
    expect(label).toBe("Model");
    expect(await count("audit_events")).toBe(auditsBefore);
    expect(await activeVersion()).toBe(2);
  });

  it("requires the configure permission for a change and the inspect permission for reads", async () => {
    const id = await propertyId("devices", "model");
    const denied = await callWithEnv({ AUTH_MODE: undefined }, "PATCH", "/api/platform/properties", { propertyId: id, label: "x" });
    expect(denied.status).toBe(403);
    expect((await callWithEnv({ AUTH_MODE: undefined }, "GET", "/api/platform/properties")).status).toBe(403);
    expect((await callWithEnv({ AUTH_MODE: undefined }, "GET", "/api/platform/property-types")).status).toBe(403);
    expect(await activeVersion()).toBe(2);
  });
});
