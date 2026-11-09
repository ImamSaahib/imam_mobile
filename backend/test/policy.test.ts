import { describe, it, expect } from "vitest";
import indexSource0 from "../src/index.js?raw";
import routesSource from "../src/platform/routes.ts?raw";

const indexSource = indexSource0 + "\n" + routesSource;
import { ROUTE_POLICY, PERMISSIONS, matchRoute, authorize, getActor, policyHealth, devOpenActive } from "../src/platform/policy";
import { call, callWithEnv } from "./helpers";

const publicPermission = PERMISSIONS.public;
const knownPermissions = new Set<string>(Object.values(PERMISSIONS));

describe("route policy inventory", () => {
  it("lists every API route that the Worker handles", () => {
    const literal = new Set<string>();
    for (const m of indexSource.matchAll(/path ?=== ?"(\/api\/[^"]+)"/g)) literal.add(m[1]);
    for (const m of indexSource.matchAll(/parts\[1\] ?=== ?"([a-z-]+)" ?&& ?parts\.length ?=== ?3/g)) literal.add(`/api/${m[1]}/:id`);
    expect(literal.size, "route scan found too few routes; update the regex").toBeGreaterThanOrEqual(18);
    const declared = new Set(ROUTE_POLICY.map((r) => r.pattern));
    const missing = [...literal].filter((p) => !declared.has(p));
    expect(missing, "Worker routes without a policy entry").toEqual([]);
  });
  it("has no stale entries for routes the Worker no longer handles", () => {
    const stale = ROUTE_POLICY.filter((r) => {
      const needle = r.pattern.includes(":id") ? `parts[1]==="${r.pattern.split("/")[2]}"` : `"${r.pattern}"`;
      return !indexSource.replace(/ /g, "").includes(needle.replace(/ /g, ""));
    });
    expect(stale).toEqual([]);
  });
  it("gives every entry a known permission and no duplicate method and path", () => {
    for (const r of ROUTE_POLICY) expect(knownPermissions.has(r.permission), r.pattern).toBe(true);
    const keys = ROUTE_POLICY.map((r) => `${r.method} ${r.pattern}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("matches ids only as positive integers", () => {
    expect(matchRoute("PATCH", "/api/devices/12")?.permission).toBe("devices.update");
    expect(matchRoute("PATCH", "/api/devices/0")).toBeNull();
    expect(matchRoute("PATCH", "/api/devices/abc")).toBeNull();
    expect(matchRoute("DELETE", "/api/devices")).toBeNull();
    expect(matchRoute("GET", "/api/unknown")).toBeNull();
  });
});

describe("authorize and getActor", () => {
  it("allows public permissions for anyone and denies other permissions without an actor", () => {
    expect(authorize(null, publicPermission)).toBe(true);
    expect(authorize(null, "devices.read")).toBe(false);
  });
  it("honours specific permissions and the placeholder wildcard", () => {
    const user = { id: "u1", kind: "user" as const, permissions: ["devices.read"] };
    expect(authorize(user, "devices.read")).toBe(true);
    expect(authorize(user, "devices.delete")).toBe(false);
    expect(authorize({ id: "dev-placeholder", kind: "placeholder", permissions: ["*"] }, "anything")).toBe(true);
  });
  it("gives a placeholder actor only for dev-open in development", () => {
    const req = new Request("https://api.test/");
    expect(getActor(req, { ENVIRONMENT: "development", AUTH_MODE: "dev-open" })?.id).toBe("dev-placeholder");
    expect(getActor(req, { ENVIRONMENT: "production", AUTH_MODE: "dev-open" })).toBeNull();
    expect(getActor(req, { ENVIRONMENT: "development" })).toBeNull();
    expect(getActor(req, {})).toBeNull();
    expect(devOpenActive({ ENVIRONMENT: "staging", AUTH_MODE: "dev-open" })).toBe(false);
  });
});

describe("policy enforcement in the Worker", () => {
  const protectedRoutes = ROUTE_POLICY.filter((r) => r.permission !== publicPermission);
  const sample = (pattern: string) => pattern.replace(":id", "1");
  const body = (method: string) => (method === "GET" || method === "DELETE" ? undefined : {});

  it("denies every protected route with 403 when dev-open is off", async () => {
    for (const r of protectedRoutes) {
      const res = await callWithEnv({ AUTH_MODE: undefined }, r.method, sample(r.pattern), body(r.method));
      expect(res.status, `${r.method} ${r.pattern}`).toBe(403);
    }
  });
  it("denies every protected route with 403 when dev-open is set outside development", async () => {
    for (const r of protectedRoutes) {
      const res = await callWithEnv({ ENVIRONMENT: "production", AUTH_MODE: "dev-open" }, r.method, sample(r.pattern), body(r.method));
      expect(res.status, `${r.method} ${r.pattern}`).toBe(403);
    }
  });
  it("does not deny any route in development with dev-open", async () => {
    for (const r of protectedRoutes) {
      const res = await call(r.method, sample(r.pattern), body(r.method));
      expect(res.status, `${r.method} ${r.pattern}`).not.toBe(403);
    }
  });
  it("keeps the health route public", async () => {
    const res = await callWithEnv({ AUTH_MODE: undefined }, "GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ ok: true, auth: "enforced" });
  });
  it("makes the health check fail when dev-open is active outside development", async () => {
    for (const environment of ["production", "staging", undefined]) {
      const res = await callWithEnv({ ENVIRONMENT: environment, AUTH_MODE: "dev-open" }, "GET", "/api/health");
      expect(res.status, String(environment)).toBe(503);
      expect(res.json).toMatchObject({ ok: false, auth: "dev-open" });
    }
  });
  it("reports policy health directly", () => {
    expect(policyHealth({ ENVIRONMENT: "development", AUTH_MODE: "dev-open" })).toEqual({ ok: true, mode: "dev-open" });
    expect(policyHealth({ ENVIRONMENT: "production" })).toEqual({ ok: true, mode: "enforced" });
    expect(policyHealth({ ENVIRONMENT: "production", AUTH_MODE: "dev-open" }).ok).toBe(false);
  });
  it("still answers 404 for unknown routes", async () => {
    expect((await call("GET", "/api/unknown")).status).toBe(404);
  });
});
