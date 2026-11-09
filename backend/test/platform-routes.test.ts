import { describe, it, expect } from "vitest";
import { call } from "./helpers";

describe("health, CORS and routing", () => {
  it("reports health with a connected database", async () => {
    const r = await call("GET", "/api/health");
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true, service: "imam-mobile-api", database: "connected", auth: "dev-open" });
  });
  it("answers preflight requests", async () => {
    const r = await call("OPTIONS", "/api/devices");
    expect(r.status).toBe(204);
  });
  it("rejects a browser origin that is not allowed", async () => {
    const r = await call("GET", "/api/devices", undefined, { Origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
  it("returns 404 for unknown routes", async () => {
    const r = await call("GET", "/api/unknown");
    expect(r.status).toBe(404);
  });
  it("sends no-store on data routes", async () => {
    const r = await call("GET", "/api/devices");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("published configuration", () => {
  it("is readable without authentication and is edge-cacheable", async () => {
    const r = await call("GET", "/api/configuration");
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toContain("max-age=60");
  });
});

// Characterization of the legacy admin surface. Story 01 inventories it, Story 07 replaces it,
// Story 11 removes the shared token. These tests pin today's behavior so removal is deliberate.
describe("legacy admin routes (shared bearer token)", () => {
  const adminRoutes: Array<[string, string]> = [
    ["GET", "/api/admin/configuration"],
    ["PUT", "/api/admin/configuration"],
    ["POST", "/api/admin/configuration/publish"],
    ["GET", "/api/admin/configuration/versions"]
  ];
  for (const [method, path] of adminRoutes) {
    it(`${method} ${path} is rejected without the admin token`, async () => {
      const r = await call(method, path, method === "GET" ? undefined : {});
      expect(r.status).toBe(401);
    });
  }
  it("rejects a wrong admin token", async () => {
    const r = await call("GET", "/api/admin/configuration", undefined, { Authorization: "Bearer wrong" });
    expect(r.status).toBe(401);
  });
});
