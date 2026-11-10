import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { call } from "./helpers";
import { deriveSeedId } from "../src/platform/config/ids";
import { installSeed } from "../src/platform/config/seed";
import { previewUpgrade, applyUpgrade } from "../src/platform/config/seed-upgrade";
import { getBootstrap } from "../src/platform/config/bootstrap";
import { PlatformError } from "../src/platform/errors";
import { imamMobileSeedV1 as imamMobileSeed } from "./fixtures/seed-v1";
import type { SeedPackage } from "../src/platform/config/seed-types";

const actor = { id: "dev-placeholder", kind: "placeholder" as const, permissions: ["*"] };
const clone = (): SeedPackage => JSON.parse(JSON.stringify(imamMobileSeed));
const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
const rejection = async (promise: Promise<unknown>) => { try { await promise; } catch (e) { return e as PlatformError; } throw new Error("expected a rejection"); };
const upgrade = async (pkg: SeedPackage, extra: { resolutions?: any; reset?: string[] } = {}) => {
  const plan = await previewUpgrade(env.DB, pkg);
  return { plan, result: await applyUpgrade(env.DB, pkg, { planHash: plan.planHash, ...extra }, actor) };
};
const moduleKey = imamMobileSeed.menus[0].modules[0].seedKey;
const moduleId = () => deriveSeedId("imam-mobile", "module", moduleKey);
const label = async () => (await env.DB.prepare("SELECT label FROM cfg_module WHERE id=?").bind(await moduleId()).first<{ label: string }>())!.label;
const seedRow = async () => env.DB.prepare("SELECT * FROM cfg_seed_item WHERE item_id=?").bind(await moduleId()).first<any>();
const version2 = (change: (p: SeedPackage) => void) => { const p = clone(); p.version = 2; change(p); return p; };

beforeEach(async () => { await installSeed(env.DB, imamMobileSeed, actor); });

describe("seed upgrade preview", () => {
  it("reports nothing to do for the installed version and writes nothing", async () => {
    const before = await count("cfg_release");
    const plan = await previewUpgrade(env.DB, imamMobileSeed);
    expect(plan.counts).toMatchObject({ add: 0, update: 0, conflict: 0, deprecate: 0, unchanged: 61 });
    expect(plan.items).toEqual([]);
    expect(plan.incompatible).toEqual([]);
    expect(await count("cfg_release")).toBe(before);
  });
  it("lists additions, updates and removals with old and new values", async () => {
    const pkg = version2((p) => {
      p.menus[0].modules[0].label = "Home";
      p.pages.push({ seedKey: "extra", title: "Extra", components: [] });
      p.menus[1].modules.push({ seedKey: "extra", pageSeedKey: "extra", label: "Extra", slug: "extra" });
      p.menus[0].modules.pop(); // upstream removes Sales
    });
    const plan = await previewUpgrade(env.DB, pkg);
    expect(plan.counts).toMatchObject({ add: 2, update: 1, deprecate: 1, conflict: 0 });
    const update = plan.items.find((i) => i.status === "update")!;
    expect(update.current).toMatchObject({ label: "Dashboard" });
    expect(update.proposed).toMatchObject({ label: "Home" });
    expect(plan.items.filter((i) => i.status === "add").map((i) => i.itemType).sort()).toEqual(["module", "page"]);
  });
  it("refuses an older version, an uninstalled package and a newer platform requirement", async () => {
    const old = clone(); old.version = 0;
    expect((await rejection(previewUpgrade(env.DB, old))).code).toBe("SEED_DOWNGRADE");
    const newer = version2((p) => { p.minPlatformVersion = "9.0.0"; });
    expect((await rejection(previewUpgrade(env.DB, newer))).code).toBe("PLATFORM_TOO_OLD");
    const other = version2((p) => { p.packageId = "other"; });
    expect((await rejection(previewUpgrade(env.DB, other))).code).toBe("NOT_INSTALLED");
  });
});

describe("seed upgrade apply", () => {
  it("applies upstream changes to untouched items and publishes a new release", async () => {
    const before = await getBootstrap(env.DB, env as any, null);
    const { result } = await upgrade(version2((p) => { p.menus[0].modules[0].label = "Home"; }));
    expect(result).toMatchObject({ status: "applied", version: 2, releaseVersion: 2, conflictsRemaining: 0, applied: { updated: 1 } });
    expect(await label()).toBe("Home");
    const after = await getBootstrap(env.DB, env as any, null);
    expect(after.etag).not.toBe(before.etag);
    expect((after as any).body.shell.menus[0].modules[0].label).toBe("Home");
    expect((await seedRow()).applied_version).toBe(2);
    expect(await count("cfg_release")).toBe(2);
    const audit = await env.DB.prepare("SELECT actor_id, action FROM audit_events WHERE action='seed.upgrade'").all();
    expect(audit.results).toEqual([{ actor_id: "dev-placeholder", action: "seed.upgrade" }]);
  });
  it("adds new items and marks removed ones deprecated without deleting them", async () => {
    const pkg = version2((p) => {
      p.pages.push({ seedKey: "extra", title: "Extra", components: [] });
      p.menus[1].modules.push({ seedKey: "extra", pageSeedKey: "extra", label: "Extra", slug: "extra" });
      p.menus[0].modules.pop();
    });
    const { result } = await upgrade(pkg);
    expect(result.applied).toMatchObject({ added: 2, deprecated: 1 });
    expect(await count("cfg_module")).toBe(7); // 6 + 1 added, none deleted
    const removedId = await deriveSeedId("imam-mobile", "module", imamMobileSeed.menus[0].modules.at(-1)!.seedKey);
    expect((await env.DB.prepare("SELECT deprecated FROM cfg_seed_item WHERE item_id=?").bind(removedId).first<any>()).deprecated).toBe(1);
    expect(await env.DB.prepare("SELECT id FROM cfg_module WHERE id=?").bind(removedId).first()).not.toBeNull();
  });
  it("preserves a local change when upstream did not change the item", async () => {
    await env.DB.prepare("UPDATE cfg_module SET label='Mine' WHERE id=?").bind(await moduleId()).run();
    const pkg = version2((p) => { p.menus[0].modules[1].label = "Stock"; });
    const plan = await previewUpgrade(env.DB, pkg);
    expect(plan.items.find((i) => i.itemId.length && i.locallyModified)?.status).toBe("unchanged");
    await applyUpgrade(env.DB, pkg, { planHash: plan.planHash }, actor);
    expect(await label()).toBe("Mine");
  });
  it("leaves a conflict unchanged until it is resolved", async () => {
    await env.DB.prepare("UPDATE cfg_module SET label='Mine' WHERE id=?").bind(await moduleId()).run();
    const pkg = version2((p) => { p.menus[0].modules[0].label = "Home"; p.menus[0].modules[1].label = "Stock"; });
    const { plan, result } = await upgrade(pkg);
    expect(plan.counts.conflict).toBe(1);
    expect(plan.items.find((i) => i.status === "conflict")).toMatchObject({ current: { label: "Mine" }, proposed: { label: "Home" } });
    expect(result.conflictsRemaining).toBe(1);
    expect(await label()).toBe("Mine");
    expect((await previewUpgrade(env.DB, pkg)).counts.conflict).toBe(1); // still reported after the apply
  });
  it("resolves a conflict with upstream, keep, own or a merged value", async () => {
    const id = await moduleId();
    for (const [choice, expected, ownership] of [["upstream", "Home", "seed_managed"], ["keep", "Mine", "seed_managed"], ["own", "Mine", "client_owned"], [{ value: null }, "Merged", "seed_managed"]] as const) {
      await env.DB.prepare("DELETE FROM cfg_active_release").run(); await env.DB.prepare("DELETE FROM cfg_release").run(); await env.DB.prepare("DELETE FROM cfg_seed_item").run();
      for (const t of ["cfg_component", "cfg_property", "cfg_module", "cfg_menu", "cfg_page", "cfg_data_source", "cfg_seed_package", "cfg_application"]) await env.DB.prepare(`DELETE FROM ${t}`).run();
      await installSeed(env.DB, imamMobileSeed, actor);
      await env.DB.prepare("UPDATE cfg_module SET label='Mine' WHERE id=?").bind(id).run();
      const pkg = version2((p) => { p.menus[0].modules[0].label = "Home"; });
      const plan = await previewUpgrade(env.DB, pkg);
      const resolution = typeof choice === "string" ? choice : { value: { ...plan.items[0].proposed, label: "Merged" } };
      const result = await applyUpgrade(env.DB, pkg, { planHash: plan.planHash, resolutions: { [id]: resolution } }, actor);
      expect(result.conflictsRemaining).toBe(0);
      expect(await label()).toBe(expected);
      expect((await seedRow()).ownership).toBe(ownership);
      expect((await previewUpgrade(env.DB, pkg)).counts.conflict).toBe(0);
    }
  });
  it("never overwrites a client-owned item", async () => {
    await env.DB.prepare("UPDATE cfg_seed_item SET ownership='client_owned' WHERE item_id=?").bind(await moduleId()).run();
    const pkg = version2((p) => { p.menus[0].modules[0].label = "Home"; });
    const { plan } = await upgrade(pkg);
    expect(plan.counts.client_owned).toBe(1);
    expect(await label()).toBe("Dashboard");
  });
  it("resets an item to the upstream default only when asked", async () => {
    await env.DB.prepare("UPDATE cfg_module SET label='Mine' WHERE id=?").bind(await moduleId()).run();
    const plan = await previewUpgrade(env.DB, imamMobileSeed);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ status: "unchanged", locallyModified: true, current: { label: "Mine" }, proposed: { label: "Dashboard" } });
    await applyUpgrade(env.DB, imamMobileSeed, { planHash: plan.planHash }, actor);
    expect(await label()).toBe("Mine"); // no reset without the explicit request
    const { result } = await upgrade(imamMobileSeed, { reset: [await moduleId()] });
    expect(result.applied.reset).toBe(1);
    expect(await label()).toBe("Dashboard");
    expect((await previewUpgrade(env.DB, imamMobileSeed)).items).toEqual([]);
  });
  it("is idempotent: applying the same upgrade again changes nothing", async () => {
    const pkg = version2((p) => { p.menus[0].modules[0].label = "Home"; });
    await upgrade(pkg);
    const releases = await count("cfg_release");
    const again = await upgrade(pkg);
    expect(again.result.status).toBe("unchanged");
    expect(await count("cfg_release")).toBe(releases);
  });
  it("rejects a stale plan", async () => {
    const pkg = version2((p) => { p.menus[0].modules[0].label = "Home"; });
    const plan = await previewUpgrade(env.DB, pkg);
    await env.DB.prepare("UPDATE cfg_module SET label='Changed meanwhile' WHERE id=?").bind(await moduleId()).run();
    expect((await rejection(applyUpgrade(env.DB, pkg, { planHash: plan.planHash }, actor))).code).toBe("STALE_PLAN");
    expect(await label()).toBe("Changed meanwhile");
  });
  it("rejects resolutions for items that are not conflicts or have the wrong shape", async () => {
    const pkg = version2((p) => { p.menus[0].modules[0].label = "Home"; });
    const plan = await previewUpgrade(env.DB, pkg);
    const id = await moduleId();
    expect((await rejection(applyUpgrade(env.DB, pkg, { planHash: plan.planHash, resolutions: { [id]: "upstream" } }, actor))).code).toBe("SEED_RESOLUTION_INVALID");
    await env.DB.prepare("UPDATE cfg_module SET label='Mine' WHERE id=?").bind(id).run();
    const conflictPlan = await previewUpgrade(env.DB, pkg);
    expect((await rejection(applyUpgrade(env.DB, pkg, { planHash: conflictPlan.planHash, resolutions: { [id]: { value: { label: "x" } } } }, actor))).code).toBe("SEED_RESOLUTION_INVALID");
  });
  it("refuses an upgrade that maps a column that does not exist and changes nothing", async () => {
    const pkg = version2((p) => { p.dataSources[0].properties[1].columnName = "no_such_column"; });
    const plan = await previewUpgrade(env.DB, pkg);
    expect(plan.schemaOk).toBe(false);
    expect(plan.incompatible.length).toBeGreaterThan(0);
    const releases = await count("cfg_release");
    expect((await rejection(applyUpgrade(env.DB, pkg, { planHash: plan.planHash }, actor))).code).toBe("SCHEMA_INCOMPATIBLE");
    expect(await count("cfg_release")).toBe(releases);
    expect((await env.DB.prepare("SELECT version FROM cfg_seed_package").first<any>()).version).toBe(1);
  });
  it("does not touch business records", async () => {
    await env.DB.prepare("INSERT INTO customers (name) VALUES ('Keep me')").run();
    await upgrade(version2((p) => { p.menus[0].modules[0].label = "Home"; }));
    expect(await count("customers")).toBe(1);
  });
});

describe("seed upgrade routes", () => {
  it("previews and applies through the API", async () => {
    // The registered package is version 2 and the installed one is the frozen version 1, so this is the real upgrade.
    const preview = await call("POST", "/api/platform/seed/preview", {});
    expect(preview.status).toBe(200);
    expect(preview.json.fromVersion).toBe(1);
    expect(preview.json.toVersion).toBe(2);
    expect(preview.json.counts).toMatchObject({ add: 0, conflict: 0, deprecate: 0, update: 14, unchanged: 47 });
    const applied = await call("POST", "/api/platform/seed/upgrade", { planHash: preview.json.planHash });
    expect(applied.status).toBe(200);
    expect(applied.json).toMatchObject({ status: "applied", version: 2, releaseVersion: 2 });
    const again = await call("POST", "/api/platform/seed/preview", {});
    expect(again.json.counts).toMatchObject({ update: 0, unchanged: 61 });
  });
  it("requires the plan from the preview", async () => {
    const r = await call("POST", "/api/platform/seed/upgrade", {});
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("SEED_PLAN_REQUIRED");
  });
  it("reports a stale plan as 409 with a plain message", async () => {
    const r = await call("POST", "/api/platform/seed/upgrade", { planHash: "0".repeat(64) });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("STALE_PLAN");
  });
});
