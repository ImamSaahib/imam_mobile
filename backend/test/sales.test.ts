import { describe, it, expect } from "vitest";
import { call, createCustomer, createDevice } from "./helpers";

async function sale(deviceIds: number[], extra: Record<string, unknown> = {}, price = 50000) {
  const prices = Object.fromEntries(deviceIds.map((id) => [id, price]));
  return call("POST", "/api/sales", { deviceIds, prices, date: "2026-11-05", ...extra });
}

describe("sales", () => {
  it("completes a cash sale: records items, marks devices sold and returns the invoice", async () => {
    const d1 = await createDevice();
    const d2 = await createDevice();
    const r = await sale([d1, d2]);
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ total: 100000, customerId: null, message: "Sale completed." });
    expect(r.json.invoiceNumber).toMatch(/^S-/);
    const devices = (await call("GET", "/api/devices")).json;
    for (const d of devices) expect(d).toMatchObject({ status: "Sold Out", salePrice: 50000, saleDate: "2026-11-05" });
    const sales = (await call("GET", "/api/sales")).json;
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ total: 100000, customerName: "" });
    expect(sales[0].deviceIds.sort()).toEqual([d1, d2].sort());
    expect((await call("GET", "/api/customer-entries")).json).toHaveLength(0);
  });
  it("completes a credit sale and posts an 'Out (-)' ledger entry for the full total", async () => {
    const c = await createCustomer();
    const d = await createDevice();
    const r = await sale([d], { credit: true, customerId: c, dueDate: "2026-12-01" });
    expect(r.status).toBe(201);
    const entries = (await call("GET", "/api/customer-entries")).json;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ customerId: c, saleId: r.json.id, direction: "Out (-)", amount: 50000, dueDate: "2026-12-01" });
    expect((await call("GET", "/api/sales")).json[0].customerName).toBe("Ali Khan");
  });
  it("rejects a sale with no devices or invalid prices", async () => {
    const d = await createDevice();
    expect((await call("POST", "/api/sales", { deviceIds: [], prices: {} })).status).toBe(400);
    expect((await call("POST", "/api/sales", { deviceIds: [d], prices: { [d]: 0 } })).status).toBe(400);
    expect((await call("POST", "/api/sales", { deviceIds: [d] })).status).toBe(400);
  });
  it("requires a valid customer for a credit sale", async () => {
    const d = await createDevice();
    expect((await sale([d], { credit: true })).status).toBe(400);
    expect((await sale([d], { credit: true, customerId: 999999 })).status).toBe(404);
  });
  it("refuses a device that is already sold, and leaves state unchanged", async () => {
    const d = await createDevice();
    expect((await sale([d])).status).toBe(201);
    const again = await sale([d]);
    expect(again.status).toBe(409);
    expect((await call("GET", "/api/sales")).json).toHaveLength(1);
  });
  it("refuses an unknown device", async () => {
    expect((await sale([999999])).status).toBe(409);
  });
  it("de-duplicates repeated device ids in one request", async () => {
    const d = await createDevice();
    const r = await sale([d, d]);
    expect(r.status).toBe(201);
    expect(r.json.total).toBe(50000);
  });
  it("keeps a sold device: the foreign key refuses deletion with 409", async () => {
    const d = await createDevice();
    await sale([d]);
    expect((await call("DELETE", `/api/devices/${d}`)).status).toBe(409);
  });
  // Known gaps to fix in Story 06. These assertions document today's behavior, not the target.
  describe("known gaps (current behavior, to change in Story 06)", () => {
    it("has no idempotency key: nothing links a retried request to the first attempt", async () => {
      const d1 = await createDevice();
      const d2 = await createDevice();
      const a = await call("POST", "/api/sales", { deviceIds: [d1], prices: { [d1]: 100 }, requestId: "same" });
      const b = await call("POST", "/api/sales", { deviceIds: [d2], prices: { [d2]: 100 }, requestId: "same" });
      expect(a.status).toBe(201);
      expect(b.status).toBe(201); // a second sale is created; the request id is ignored
      expect((await call("GET", "/api/sales")).json).toHaveLength(2);
    });
  });
});
