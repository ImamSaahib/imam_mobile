import { describe, it, expect } from "vitest";
import { call, createCustomer, createDevice } from "./helpers";

describe("customers", () => {
  it("creates, lists, updates and deletes", async () => {
    const id = await createCustomer("Bilal");
    expect((await call("GET", "/api/customers")).json[0]).toMatchObject({ id, name: "Bilal", mobileNumber: "03001234567", type: "Regular" });
    expect((await call("PATCH", `/api/customers/${id}`, { name: "Bilal Ahmed", type: "Account" })).status).toBe(200);
    expect((await call("GET", "/api/customers")).json[0]).toMatchObject({ name: "Bilal Ahmed", type: "Account", mobileNumber: "" });
    expect((await call("DELETE", `/api/customers/${id}`)).status).toBe(200);
    expect((await call("DELETE", `/api/customers/${id}`)).status).toBe(404);
  });
  it("requires a name", async () => {
    expect((await call("POST", "/api/customers", { name: "  " })).status).toBe(400);
    expect((await call("PATCH", "/api/customers/1", {})).status).toBe(400);
  });
  it("refuses to delete a customer that has ledger entries", async () => {
    const id = await createCustomer();
    await call("POST", "/api/customer-entries", { customerId: id, date: "2026-11-02", direction: "Out (-)", amount: 1000 });
    const r = await call("DELETE", `/api/customers/${id}`);
    expect(r.status).toBe(409);
  });
});

describe("customer entries (ledger)", () => {
  const entry = (customerId: number, over: Record<string, unknown> = {}) =>
    ({ customerId, date: "2026-11-02", direction: "Out (-)", amount: 2500, note: "Credit", ...over });

  it("creates and lists entries newest first with camelCase fields", async () => {
    const c = await createCustomer();
    const a = (await call("POST", "/api/customer-entries", entry(c))).json.id;
    const b = (await call("POST", "/api/customer-entries", entry(c, { direction: "In (+)", amount: 500 }))).json.id;
    const r = await call("GET", "/api/customer-entries");
    expect(r.json.map((e: any) => e.id)).toEqual([b, a]);
    expect(r.json[1]).toMatchObject({ customerId: c, direction: "Out (-)", amount: 2500, note: "Credit", dueDate: "" });
  });
  it("validates direction, amount and customer", async () => {
    const c = await createCustomer();
    for (const bad of [{ direction: "Sideways" }, { amount: 0 }, { amount: -5 }, { amount: "x" }, { date: "" }, { customerId: 0 }]) {
      const r = await call("POST", "/api/customer-entries", entry(c, bad));
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
  });
  it("updates and deletes an entry", async () => {
    const c = await createCustomer();
    const id = (await call("POST", "/api/customer-entries", entry(c))).json.id;
    expect((await call("PATCH", `/api/customer-entries/${id}`, entry(c, { amount: 3000 }))).status).toBe(200);
    expect((await call("GET", "/api/customer-entries")).json[0].amount).toBe(3000);
    expect((await call("DELETE", `/api/customer-entries/${id}`)).status).toBe(200);
    expect((await call("DELETE", `/api/customer-entries/${id}`)).status).toBe(404);
  });
  it("can reference a device", async () => {
    const c = await createCustomer();
    const d = await createDevice();
    await call("POST", "/api/customer-entries", entry(c, { deviceId: d }));
    expect((await call("GET", "/api/customer-entries")).json[0].deviceId).toBe(d);
  });
});
