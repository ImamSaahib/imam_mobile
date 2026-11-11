import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { call, callWithEnv } from "./helpers";
import { meterDb, newUsage } from "../src/platform/usage";
import { Governor, RateLimiter, BUDGET, stateForShare, isLimitError, SYNC_INTERVAL_MS, PROBE_INTERVAL_MS } from "../src/platform/governor";
import { installSeed } from "../src/platform/config/seed";
import { invalidateBootstrapCache } from "../src/platform/config/bootstrap";
import { bumpVersionStatement, getVersion, dataSourceEtag } from "../src/platform/versions";
import { imamMobileSeed } from "../../applications/imam-mobile/seed/package";
import serviceWorker from "../../frontend/public/sw.js?raw";

const actor = { id: "dev-placeholder", kind: "placeholder" as const, permissions: ["*"] };
const today = () => new Date().toISOString().slice(0, 10);
const setUsage = (read: number, written = 0) => env.DB.prepare("INSERT INTO usage_daily (day,rows_read,rows_written,updated_at) VALUES (?,?,?,'x') ON CONFLICT(day) DO UPDATE SET rows_read=excluded.rows_read, rows_written=excluded.rows_written").bind(today(), read, written).run();
const LIMIT_MESSAGE = "D1_ERROR: Your account has exceeded D1's free tier daily row read limit. Upgrade to a paid plan or wait until midnight UTC.";
/** A database that behaves like an account that has used up its day, except for the usage table. */
const exhaustedDb = (calls: string[] = []) => ({ prepare: (sql: string) => { calls.push(sql); if (sql.includes("usage_daily")) return env.DB.prepare(sql); throw new Error(LIMIT_MESSAGE); } }) as unknown as D1Database;

describe("measurement", () => {
  it("counts rows read and written for first, all, run and batch", async () => {
    const usage = newUsage();
    const db = meterDb(env.DB, usage);
    await db.prepare("INSERT INTO customers (name) VALUES ('a')").run();
    expect(usage.rowsWritten).toBeGreaterThanOrEqual(1);
    const written = usage.rowsWritten;
    const row = await db.prepare("SELECT name FROM customers WHERE name=?").bind("a").first<{ name: string }>();
    expect(row).toEqual({ name: "a" });
    expect(await db.prepare("SELECT name FROM customers WHERE name=?").bind("a").first("name")).toBe("a");
    expect(await db.prepare("SELECT name FROM customers WHERE name='zzz'").first()).toBeNull();
    await db.batch([db.prepare("INSERT INTO customers (name) VALUES ('b')"), db.prepare("SELECT * FROM customers")]);
    expect(usage.rowsRead).toBeGreaterThan(0);
    expect(usage.rowsWritten).toBeGreaterThan(written);
    expect(usage.queries).toBe(6);
  });
  it("reports rows read and written for each request in development", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const r = await call("GET", "/api/bootstrap");
    expect(Number(r.headers.get("X-Rows-Read"))).toBeGreaterThan(0);
    expect(r.headers.get("X-Rows-Written")).toBe("0");
  });
  it("bootstrap stays within budget: at most 5 rows read, none written, and 1 row on a matching version", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const cold = await call("GET", "/api/bootstrap");
    expect(Number(cold.headers.get("X-Rows-Read"))).toBeLessThanOrEqual(5);
    expect(cold.headers.get("X-Rows-Written")).toBe("0");
    const hot = await call("GET", "/api/bootstrap", undefined, { "If-None-Match": cold.headers.get("ETag")! });
    expect(hot.status).toBe(304);
    expect(hot.headers.get("X-Rows-Read")).toBe("0"); // answered from the instance's memory
    invalidateBootstrapCache();
    const revalidate = await call("GET", "/api/bootstrap", undefined, { "If-None-Match": cold.headers.get("ETag")! });
    expect(revalidate.status).toBe(304);
    expect(Number(revalidate.headers.get("X-Rows-Read"))).toBeLessThanOrEqual(1);
  });
  it("a bootstrap after a seed upgrade shows the new release, not the cached one", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    const before = await call("GET", "/api/bootstrap");
    const next = JSON.parse(JSON.stringify(imamMobileSeed)); next.version = imamMobileSeed.version + 1; next.menus[0].modules[0].label = "Home";
    const { previewUpgrade, applyUpgrade } = await import("../src/platform/config/seed-upgrade");
    const plan = await previewUpgrade(env.DB, next);
    await applyUpgrade(env.DB, next, { planHash: plan.planHash }, actor);
    const after = await call("GET", "/api/bootstrap", undefined, { "If-None-Match": before.headers.get("ETag")! });
    expect(after.status).toBe(200);
    expect(after.json.shell.menus[0].modules[0].label).toBe("Home");
  });
});

describe("resource governor", () => {
  it("changes state at 70% and 90% of the larger of the read and write shares", () => {
    expect(stateForShare(0.699)).toBe("normal");
    expect(stateForShare(0.7)).toBe("conserve");
    expect(stateForShare(0.899)).toBe("conserve");
    expect(stateForShare(0.9)).toBe("essential");
    const g = new Governor();
    g.record({ rowsRead: 100, rowsWritten: BUDGET.rowsWritten * 0.75, queries: 1 });
    expect(g.state()).toBe("conserve"); // writes alone can move the state
  });
  it("loads the day's total from the usage table and adds this instance's pending usage", async () => {
    await setUsage(650_000);
    const g = new Governor();
    await g.sync(env.DB);
    expect(g.state()).toBe("normal");
    g.record({ rowsRead: 60_000, rowsWritten: 0, queries: 1 });
    expect(g.state()).toBe("conserve");
  });
  it("flushes at most every 5 minutes and adds to the stored total", async () => {
    const g = new Governor();
    const t0 = Date.parse(`${today()}T12:00:00Z`);
    const calls: string[] = [];
    const spy = { prepare: (sql: string) => { calls.push(sql); return env.DB.prepare(sql); } } as unknown as D1Database;
    g.record({ rowsRead: 1000, rowsWritten: 10, queries: 1 });
    await g.sync(spy, t0);
    g.record({ rowsRead: 500, rowsWritten: 5, queries: 1 });
    await g.sync(spy, t0 + 60_000);
    expect(calls).toHaveLength(1);
    await g.sync(spy, t0 + SYNC_INTERVAL_MS);
    expect(calls).toHaveLength(2);
    expect(await env.DB.prepare("SELECT rows_read, rows_written FROM usage_daily WHERE day=?").bind(today()).first()).toEqual({ rows_read: 1500, rows_written: 15 });
  });
  it("starts a new day at 00:00 UTC and clears the Limit state", async () => {
    const g = new Governor();
    const d1 = Date.parse("2026-11-10T23:59:00Z"), d2 = Date.parse("2026-11-11T00:00:01Z");
    g.record({ rowsRead: BUDGET.rowsRead, rowsWritten: 0, queries: 1 });
    g.markLimit(d1);
    expect(g.state(d1)).toBe("limit");
    expect(g.state(d2)).toBe("normal");
  });
  it("lets one probe through per minute while in the Limit state", () => {
    const g = new Governor();
    expect(g.shouldProbe(1_000_000)).toBe(true);
    expect(g.shouldProbe(1_000_000 + PROBE_INTERVAL_MS - 1)).toBe(false);
    expect(g.shouldProbe(1_000_000 + PROBE_INTERVAL_MS)).toBe(true);
  });
  it("recognizes the documented daily-limit message and nothing else", () => {
    expect(isLimitError(new Error(LIMIT_MESSAGE))).toBe(true);
    expect(isLimitError(new Error("Your account has exceeded D1's free tier daily row write limit."))).toBe(true);
    expect(isLimitError(new Error("UNIQUE constraint failed: mobile_devices.imei"))).toBe(false);
    expect(isLimitError(undefined)).toBe(false);
  });
  it("shows the state in the bootstrap response, a header on 304 too, and the health check", async () => {
    await installSeed(env.DB, imamMobileSeed, actor);
    await setUsage(800_000);
    const b = await call("GET", "/api/bootstrap");
    expect(b.headers.get("X-Resource-State")).toBe("conserve");
    expect(b.json.resources.state).toBe("conserve");
    const again = await call("GET", "/api/bootstrap", undefined, { "If-None-Match": b.headers.get("ETag")! });
    expect(again.status).toBe(304);
    expect(again.headers.get("X-Resource-State")).toBe("conserve");
    expect((await call("GET", "/api/health")).json.resources.state).toBe("conserve");
  });
  it("in the Essential state pauses other writes but keeps reads and core actions", async () => {
    await setUsage(950_000);
    const read = await call("GET", "/api/devices");
    expect(read.status).toBe(200);
    const paused = await call("POST", "/api/devices", { model: "x" });
    expect(paused.status).toBe(503);
    expect(paused.json.code).toBe("RESOURCE_CONSERVING");
    const sale = await call("POST", "/api/sales", {});
    expect(sale.json?.code).not.toBe("RESOURCE_CONSERVING"); // reaches its own validation instead
  });
});

describe("daily limit", () => {
  it("maps a D1 daily limit to DAILY_LIMIT_REACHED with the reset time and no technical text", async () => {
    const r = await callWithEnv({ DB: exhaustedDb() }, "GET", "/api/devices");
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("DAILY_LIMIT_REACHED");
    expect(r.json.resetAt).toMatch(/T00:00:00\.000Z$/);
    expect(Number(r.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(r.json.error).not.toMatch(/D1|SQL|account|exceeded/i);
  });
  it("maps a limit that appears while saving the same way", async () => {
    const r = await callWithEnv({ DB: exhaustedDb() }, "POST", "/api/customers", { name: "A", type: "Retail" });
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("DAILY_LIMIT_REACHED");
  });
  it("stops sending queries while in the Limit state, probes once, and recovers when D1 works again", async () => {
    const calls: string[] = [];
    await callWithEnv({ DB: exhaustedDb(calls) }, "GET", "/api/devices"); // first failure marks the limit
    const before = calls.length;
    const probe = await call("GET", "/api/devices"); // the one probe goes through, works, and clears the state
    expect(probe.status).toBe(200);
    expect((await call("GET", "/api/health")).json.resources.state).toBe("normal");
    await callWithEnv({ DB: exhaustedDb(calls) }, "GET", "/api/devices"); // limit again
    const afterSecond = calls.length;
    const blocked = await callWithEnv({ DB: exhaustedDb(calls) }, "GET", "/api/devices"); // within a minute of the probe: no query is sent
    expect(blocked.json.code).toBe("DAILY_LIMIT_REACHED");
    expect(calls.length).toBe(afterSecond);
    expect(before).toBeGreaterThan(0);
  });
});

describe("rate limit", () => {
  it("limits one looping client without affecting another", async () => {
    const limiter = new RateLimiter(3, 60_000);
    expect([1, 2, 3, 4].map(() => limiter.check("a", 0))).toEqual([0, 0, 0, 60]);
    expect(limiter.check("b", 0)).toBe(0);
    expect(limiter.check("a", 60_000)).toBe(0); // new window
  });
  it("applies to the API, answers 429 with a plain message, and spares other clients and health", async () => {
    const a = { "CF-Connecting-IP": "10.0.0.1" };
    let last;
    for (let i = 0; i < 121; i++) last = await call("GET", "/api/configuration", undefined, a);
    expect(last!.status).toBe(429);
    expect(last!.json.code).toBe("RATE_LIMITED");
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await call("GET", "/api/configuration", undefined, { "CF-Connecting-IP": "10.0.0.2" })).status).toBe(200);
    expect((await call("GET", "/api/health", undefined, a)).status).toBe(200);
  });
});

describe("data source versions", () => {
  it("starts at 1 for the four existing data sources", async () => {
    for (const key of ["devices", "customers", "ledger", "sales"]) expect(await getVersion(env.DB, key)).toBe(1);
  });
  it("increments in the same batch as the write", async () => {
    await env.DB.batch([env.DB.prepare("INSERT INTO customers (name) VALUES ('A')"), bumpVersionStatement(env.DB, "customers")]);
    expect(await getVersion(env.DB, "customers")).toBe(2);
    expect(dataSourceEtag(3, 2)).toBe('"r3-d2"');
  });
  it("changes neither the data nor the counter when the batch fails", async () => {
    await env.DB.prepare("INSERT INTO mobile_devices (model,company,condition,status,imei,purchase_price,purchase_date) VALUES ('m','c','Used','Available','111',1,'2026-01-01')").run();
    const duplicate = env.DB.prepare("INSERT INTO mobile_devices (model,company,condition,status,imei,purchase_price,purchase_date) VALUES ('m','c','Used','Available','111',1,'2026-01-01')");
    await expect(env.DB.batch([bumpVersionStatement(env.DB, "devices"), duplicate])).rejects.toThrow();
    expect(await getVersion(env.DB, "devices")).toBe(1);
  });
  it("creates a counter for a data source that has none yet", async () => {
    await bumpVersionStatement(env.DB, "newsource").run();
    expect(await getVersion(env.DB, "newsource")).toBe(1);
    await bumpVersionStatement(env.DB, "newsource").run();
    expect(await getVersion(env.DB, "newsource")).toBe(2);
  });
});

describe("service worker", () => {
  it("caches static files only: it never touches API requests, non-GET requests or other origins", () => {
    expect(serviceWorker).toContain('request.method !== "GET" || url.origin !== self.location.origin');
    expect(serviceWorker).toContain('url.pathname.startsWith("/api/")) return;');
    expect(serviceWorker).toContain('["style", "script", "image", "font"].includes(request.destination)');
    // every cache write is either the page shell or a static asset request
    const puts = serviceWorker.match(/cache\.put\(.*?\);/g) ?? [];
    expect(puts.sort()).toEqual(['cache.put("/index.html", response.clone());', "cache.put(request, response.clone());"].sort());
  });
});
