import { describe, it, expect } from "vitest";
import { call, callWithEnv, deviceBody, createDevice } from "./helpers";

describe("devices", () => {
  it("creates and lists a device with camelCase fields, newest first", async () => {
    const first = await createDevice({ model: "First" });
    const second = await createDevice({ model: "Second" });
    const r = await call("GET", "/api/devices");
    expect(r.status).toBe(200);
    expect(r.json.map((d: any) => d.id)).toEqual([second, first]);
    expect(r.json[0]).toMatchObject({ model: "Second", company: "Samsung", status: "Available", purchasePrice: 40000, purchaseDate: "2026-11-01" });
  });
  it("summarizes inventory from maintained counters", async () => {
    expect((await call("GET", "/api/devices/summary")).json).toEqual({ total: 0, available: 0, sold: 0 });
    await createDevice();
    await createDevice({ status: "Sold Out" });
    expect((await call("GET", "/api/devices/summary")).json).toEqual({ total: 2, available: 1, sold: 1 });
  });
  it("pages devices with a keyset cursor, returning each row once, newest first", async () => {
    const created: number[] = [];
    for (let i = 0; i < 7; i++) created.push(await createDevice({ model: `Phone ${i}` }));
    const seen: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const r: any = await call("GET", `/api/devices/page?limit=3${cursor ? `&after=${cursor}` : ""}`);
      expect(r.status).toBe(200);
      expect(r.json.total).toBe(7);
      seen.push(...r.json.items.map((d: any) => d.id));
      cursor = r.json.nextCursor;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toEqual([...created].reverse());
  });
  it("returns an empty first page with a zero total", async () => {
    expect((await call("GET", "/api/devices/page")).json).toEqual({ items: [], nextCursor: null, total: 0 });
  });
  it("pages within a status filter and takes the total from its counter", async () => {
    await createDevice({ status: "Available" });
    const sold1 = await createDevice({ status: "Sold Out" });
    const sold2 = await createDevice({ status: "Sold Out" });
    await createDevice({ status: "Available" });
    const first: any = await call("GET", "/api/devices/page?status=Sold%20Out&limit=1");
    expect(first.json.total).toBe(2);
    expect(first.json.items.map((d: any) => d.id)).toEqual([sold2]);
    const second: any = await call("GET", `/api/devices/page?status=Sold%20Out&limit=1&after=${first.json.nextCursor}`);
    expect(second.json.items.map((d: any) => d.id)).toEqual([sold1]);
    expect((await call("GET", "/api/devices/page?status=Reserved")).json).toEqual({ items: [], nextCursor: null, total: 0 });
  });
  it("rejects an invalid limit, cursor or status", async () => {
    for (const query of ["limit=0", "limit=51", "limit=abc", "limit=1.5", "limit=", "after=0", "after=abc", "after=-1", "status=", `status=${"x".repeat(41)}`]) {
      const r = await call("GET", `/api/devices/page?${query}`);
      expect(r.status, query).toBe(400);
    }
  });
  it("reads only the requested page, not the table", async () => {
    for (let i = 0; i < 12; i++) await createDevice();
    const r = await callWithEnv({ ENVIRONMENT: "development" }, "GET", "/api/devices/page?limit=3");
    expect(r.json.items).toHaveLength(3);
    // 3 device rows plus the counter row; the 12-row table is never scanned.
    expect(Number(r.headers.get("X-Rows-Read"))).toBeLessThanOrEqual(5);
  });
  it("filters by status", async () => {
    await createDevice({ status: "Available" });
    await createDevice({ status: "Sold Out" });
    const r = await call("GET", "/api/devices?status=Sold%20Out");
    expect(r.json).toHaveLength(1);
    expect(r.json[0].status).toBe("Sold Out");
  });
  it("rejects missing or invalid required fields", async () => {
    for (const bad of [{ model: "" }, { imei: "" }, { purchasePrice: -1 }, { purchasePrice: "abc" }, { purchaseDate: "" }]) {
      const r = await call("POST", "/api/devices", deviceBody(bad));
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
  });
  it("rejects a duplicate IMEI with 409", async () => {
    const body = deviceBody();
    expect((await call("POST", "/api/devices", body)).status).toBe(201);
    const r = await call("POST", "/api/devices", body);
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("This IMEI already exists.");
  });
  it("updates a device and reports 404 for an unknown id", async () => {
    const id = await createDevice();
    const ok = await call("PATCH", `/api/devices/${id}`, deviceBody({ model: "Renamed", purchasePrice: 45000 }));
    expect(ok.status).toBe(200);
    const list = await call("GET", "/api/devices");
    expect(list.json.find((d: any) => d.id === id)).toMatchObject({ model: "Renamed", purchasePrice: 45000 });
    expect((await call("PATCH", "/api/devices/999999", deviceBody())).status).toBe(404);
  });
  // Known gap: the database CHECK constraint rejects other values, but the route does not validate
  // them, so the person sees a generic 500 instead of a clear message. Story 06 adds validation.
  it("returns a generic 500 for an invalid condition or status (known gap)", async () => {
    expect((await call("POST", "/api/devices", deviceBody({ condition: "New" }))).status).toBe(500);
    expect((await call("POST", "/api/devices", deviceBody({ status: "Lost" }))).status).toBe(500);
  });
  // Current behavior: physical delete. Story 04 replaces this with archive for records that matter.
  it("deletes a device physically and reports 404 for an unknown id", async () => {
    const id = await createDevice();
    expect((await call("DELETE", `/api/devices/${id}`)).status).toBe(200);
    expect((await call("GET", "/api/devices")).json).toHaveLength(0);
    expect((await call("DELETE", `/api/devices/${id}`)).status).toBe(404);
  });
  // Current behavior: list endpoints return every row with no pagination. Story 05 replaces this.
  it("returns all rows without pagination", async () => {
    for (let i = 0; i < 60; i++) await createDevice();
    const r = await call("GET", "/api/devices");
    expect(r.json).toHaveLength(60);
  });
});
