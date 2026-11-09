import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { call, createCustomer, createDevice, deviceBody } from "./helpers";
import { auditStatement } from "../src/platform/audit";

const PLACEHOLDER = "dev-placeholder";
const row = (table: string, id: number) => env.DB.prepare(`SELECT created_by, updated_by FROM ${table} WHERE id=?`).bind(id).first<{ created_by: string | null; updated_by: string | null }>();

describe("actor columns", () => {
  it("records the placeholder actor when a device is created and updated", async () => {
    const id = await createDevice();
    expect(await row("mobile_devices", id)).toEqual({ created_by: PLACEHOLDER, updated_by: PLACEHOLDER });
    await env.DB.prepare("UPDATE mobile_devices SET updated_by=NULL WHERE id=?").bind(id).run();
    await call("PATCH", `/api/devices/${id}`, deviceBody());
    expect(await row("mobile_devices", id)).toEqual({ created_by: PLACEHOLDER, updated_by: PLACEHOLDER });
  });
  it("records the actor for customers and ledger entries", async () => {
    const c = await createCustomer();
    expect(await row("customers", c)).toEqual({ created_by: PLACEHOLDER, updated_by: PLACEHOLDER });
    const e = (await call("POST", "/api/customer-entries", { customerId: c, date: "2026-11-02", direction: "Out (-)", amount: 10 })).json.id;
    expect(await row("customer_entries", e)).toEqual({ created_by: PLACEHOLDER, updated_by: PLACEHOLDER });
    await env.DB.prepare("UPDATE customer_entries SET updated_by=NULL WHERE id=?").bind(e).run();
    await call("PATCH", `/api/customer-entries/${e}`, { customerId: c, date: "2026-11-02", direction: "Out (-)", amount: 20 });
    expect((await row("customer_entries", e))?.updated_by).toBe(PLACEHOLDER);
  });
  it("records the actor on a credit sale, its sold devices and its ledger entry", async () => {
    const c = await createCustomer();
    const d = await createDevice();
    await env.DB.prepare("UPDATE mobile_devices SET updated_by=NULL WHERE id=?").bind(d).run();
    const sale = await call("POST", "/api/sales", { deviceIds: [d], prices: { [d]: 100 }, credit: true, customerId: c });
    expect(await row("sales", sale.json.id)).toEqual({ created_by: PLACEHOLDER, updated_by: PLACEHOLDER });
    expect((await row("mobile_devices", d))?.updated_by).toBe(PLACEHOLDER);
    const entry = await env.DB.prepare("SELECT created_by FROM customer_entries WHERE sale_id=?").bind(sale.json.id).first<{ created_by: string }>();
    expect(entry?.created_by).toBe(PLACEHOLDER);
  });
  it("leaves actor columns empty for rows that existed before actors were recorded", async () => {
    await env.DB.prepare("INSERT INTO customers (name) VALUES ('Old row')").run();
    const old = await env.DB.prepare("SELECT created_by, updated_by FROM customers WHERE name='Old row'").first();
    expect(old).toEqual({ created_by: null, updated_by: null });
  });
});

describe("audit event shape", () => {
  const actor = { id: PLACEHOLDER, kind: "placeholder" as const, permissions: ["*"] };
  it("stores one event with the actor, entity and outcome", async () => {
    await env.DB.batch([auditStatement(env.DB, actor, { action: "device.create", entityType: "mobile_devices", entityId: 7, summary: "Created device", details: { fields: ["model"] }, requestId: "r1" })]);
    const e = await env.DB.prepare("SELECT * FROM audit_events").first<Record<string, unknown>>();
    expect(e).toMatchObject({ actor_id: PLACEHOLDER, actor_kind: "placeholder", action: "device.create", entity_type: "mobile_devices", entity_id: "7", outcome: "success", summary: "Created device", request_id: "r1" });
    expect(JSON.parse(String(e!.details_json))).toEqual({ fields: ["model"] });
    expect(String(e!.occurred_at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(String(e!.id)).toHaveLength(36);
  });
  it("records denied access with an anonymous system actor and truncates large details", async () => {
    await env.DB.batch([auditStatement(env.DB, null, { action: "access.denied", outcome: "denied", details: { text: "x".repeat(5000) } })]);
    const e = await env.DB.prepare("SELECT * FROM audit_events").first<Record<string, unknown>>();
    expect(e).toMatchObject({ actor_id: "anonymous", actor_kind: "system", outcome: "denied" });
    expect(String(e!.details_json).length).toBe(2000);
  });
  it("rejects an invalid outcome", async () => {
    await expect(env.DB.prepare("INSERT INTO audit_events (id,actor_id,actor_kind,action,outcome) VALUES ('x','a','user','t','maybe')").run()).rejects.toThrow();
  });
  it("commits an audit event and a business write in one batch", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO customers (name,created_by,updated_by) VALUES ('Batch',?,?)").bind(PLACEHOLDER, PLACEHOLDER),
      auditStatement(env.DB, actor, { action: "customer.create", entityType: "customers" })
    ]);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM customers WHERE name='Batch'").first<{ n: number }>())?.n).toBe(1);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_events").first<{ n: number }>())?.n).toBe(1);
  });
});
