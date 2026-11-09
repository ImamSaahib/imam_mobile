// Seed upgrade: preview, apply, conflict resolution and reset to the upstream default
// (Contracts section 2 and 12.7, slice 01c-2).
//
// Three values are compared for every seed item: the baseline (what upstream said when it was last
// applied, stored as a hash), the proposed value (what the new package says) and the current value
// (what the database holds now). The plan is computed from those hashes only, so previewing or applying
// twice gives the same answer and a half-finished upgrade can be retried safely.

import type { Actor } from "../policy";
import { auditStatement } from "../audit";
import { PlatformError } from "../errors";
import { PLATFORM_VERSION, CONFIG_SCHEMA_VERSION, compareVersions } from "../version";
import { newId, sha256Hex } from "./ids";
import { canonicalJson, hashOf } from "./canonical";
import { buildSnapshot, loadRows } from "./snapshot";
import { inspectCompatibility } from "./compat";
import { expandSeed, itemValue } from "./seed";
import { invalidateBootstrapCache } from "./bootstrap";
import { INSERT_ORDER, insertStatement, updateStatement } from "./rows-sql";
import type { ConfigRows, SeedItemType } from "./types";
import type { SeedPackage } from "./seed-types";

export type ItemStatus = "add" | "update" | "unchanged" | "client_owned" | "conflict" | "deprecate" | "missing";
type Value = Record<string, unknown>;

export type PlanItem = {
  itemId: string; itemType: SeedItemType; seedKey: string; status: ItemStatus;
  /** True when the installed value differs from the last applied upstream value. Such items can be reset. */
  locallyModified: boolean;
  current?: Value; proposed?: Value;
};
export type Problem = { itemType: SeedItemType; itemId: string; problem: string };
export type UpgradePlan = {
  packageId: string; fromVersion: number; toVersion: number;
  /** Must be sent back to apply, so an apply only runs against the plan that was previewed. */
  planHash: string;
  counts: Record<ItemStatus, number>;
  items: PlanItem[];
  incompatible: Problem[];
  schemaOk: boolean;
};

export type Resolution = "upstream" | "keep" | "own" | { value: Value };
export type UpgradeInput = { planHash: string; resolutions?: Record<string, Resolution>; reset?: string[] };
export type UpgradeResult = {
  status: "applied" | "unchanged"; packageId: string; version: number; releaseVersion: number;
  applied: { added: number; updated: number; deprecated: number; resolved: number; reset: number };
  conflictsRemaining: number;
};

type Entry = PlanItem & { baselineHash: string | null; currentHash: string | null; proposedHash: string | null; ownership: string; deprecatedFlag: boolean };
type Ctx = { applicationId: string; rows: ConfigRows; installedVersion: number; entries: Entry[]; expandedRows: ConfigRows; plan: UpgradePlan };

const TYPES: SeedItemType[] = ["application", "menu", "module", "page", "component", "dataSource", "property"];
const ARRAY_KEY: Record<Exclude<SeedItemType, "application">, keyof ConfigRows> = { menu: "menus", module: "modules", page: "pages", component: "components", dataSource: "dataSources", property: "properties" };

type State = Record<SeedItemType, Map<string, { id: string } & Record<string, any>>>;
function toState(rows: ConfigRows): State {
  const state = {} as State;
  for (const t of TYPES) state[t] = new Map();
  state.application.set(rows.application.id, rows.application);
  for (const t of TYPES) if (t !== "application") for (const r of rows[ARRAY_KEY[t]] as any[]) state[t].set(r.id, r);
  return state;
}
function toRows(state: State): ConfigRows {
  const app = [...state.application.values()][0] as ConfigRows["application"];
  const out: any = { application: app };
  for (const t of TYPES) if (t !== "application") out[ARRAY_KEY[t]] = [...state[t].values()];
  return out as ConfigRows;
}

function referenceProblems(state: State): Problem[] {
  const problems: Problem[] = [];
  const miss = (itemType: SeedItemType, itemId: string, what: string) => problems.push({ itemType, itemId, problem: `${what} does not exist.` });
  for (const m of state.module.values()) {
    if (!state.page.has(m.pageId)) miss("module", m.id, `Page ${m.pageId}`);
    if (!state.menu.has(m.menuId)) miss("module", m.id, `Menu ${m.menuId}`);
  }
  for (const c of state.component.values()) {
    if (!state.page.has(c.pageId)) miss("component", c.id, `Page ${c.pageId}`);
    const ds = (c.config as Value | undefined)?.dataSourceId;
    if (typeof ds === "string" && !state.dataSource.has(ds)) miss("component", c.id, `Data source ${ds}`);
  }
  for (const p of state.property.values()) if (!state.dataSource.has(p.dataSourceId)) miss("property", p.id, `Data source ${p.dataSourceId}`);
  return problems;
}

async function checkSchema(db: D1Database, rows: ConfigRows) {
  return inspectCompatibility(db, rows.dataSources.map((ds) => ({ key: ds.key, tableName: ds.tableName, properties: rows.properties.filter((p) => p.dataSourceId === ds.id) })));
}

/** Applies the safe changes (adds and updates) to a copy of the current rows, to test the result. */
function withChanges(current: State, entries: Entry[], pick: (e: Entry) => Value | null): State {
  const next = {} as State;
  for (const t of TYPES) next[t] = new Map(current[t]);
  for (const e of entries) {
    const value = pick(e);
    if (value) next[e.itemType].set(e.itemId, { id: e.itemId, ...value });
  }
  return next;
}

async function computeContext(db: D1Database, pkg: SeedPackage): Promise<Ctx> {
  if (compareVersions(PLATFORM_VERSION, pkg.minPlatformVersion) < 0) {
    throw new PlatformError("PLATFORM_TOO_OLD", `This package needs platform ${pkg.minPlatformVersion} or newer. This installation runs ${PLATFORM_VERSION}.`, 409);
  }
  const installed = await db.prepare("SELECT version FROM cfg_seed_package WHERE package_id=?").bind(pkg.packageId).first<{ version: number }>();
  if (!installed) throw new PlatformError("NOT_INSTALLED", `Package ${pkg.packageId} is not installed. Install it before upgrading.`, 404);
  if (pkg.version < installed.version) throw new PlatformError("SEED_DOWNGRADE", `Version ${installed.version} is installed. Version ${pkg.version} is older and cannot be applied.`, 409);

  const app = await db.prepare("SELECT id FROM cfg_application WHERE key=?").bind(pkg.applicationKey).first<{ id: string }>();
  if (!app) throw new PlatformError("NOT_INSTALLED", "The application of this package is not installed.", 404);
  const rows = (await loadRows(db, app.id))!;
  const seedRows = (await db.prepare("SELECT item_id, item_type, seed_key, ownership, baseline_hash, deprecated FROM cfg_seed_item WHERE package_id=?").bind(pkg.packageId).all()).results as
    { item_id: string; item_type: SeedItemType; seed_key: string; ownership: string; baseline_hash: string; deprecated: number }[];
  const known = new Map(seedRows.map((r) => [r.item_id, r]));

  const expanded = await expandSeed(pkg);
  if (expanded.rows.application.id !== app.id) throw new PlatformError("SEED_INVALID", "The package does not belong to the installed application.", 409);

  const current = toState(rows);
  const entries: Entry[] = [];
  const seen = new Set<string>();
  for (const item of expanded.items) {
    seen.add(item.itemId);
    const proposedHash = await hashOf(item.value);
    const rec = known.get(item.itemId);
    const row = current[item.itemType].get(item.itemId);
    const currentValue = row ? itemValue(row) : undefined;
    const currentHash = currentValue ? await hashOf(currentValue) : null;
    const base = { itemId: item.itemId, itemType: item.itemType, seedKey: item.seedKey, proposedHash, currentHash };
    if (!rec) {
      entries.push({ ...base, status: "add", locallyModified: false, proposed: item.value, baselineHash: null, ownership: "seed_managed", deprecatedFlag: false });
      continue;
    }
    const locallyModified = currentHash !== null && currentHash !== rec.baseline_hash;
    const e: Entry = { ...base, status: "unchanged", locallyModified, baselineHash: rec.baseline_hash, ownership: rec.ownership, deprecatedFlag: rec.deprecated === 1 };
    if (currentValue === undefined) { e.status = "missing"; e.proposed = item.value; }
    else if (rec.ownership === "client_owned") { e.status = "client_owned"; e.current = currentValue; e.proposed = item.value; }
    else if (proposedHash === rec.baseline_hash) e.status = "unchanged";
    else if (currentHash === rec.baseline_hash) { e.status = "update"; e.current = currentValue; e.proposed = item.value; }
    else if (currentHash === proposedHash) e.status = "unchanged"; // client already made the same change; only the baseline moves
    else { e.status = "conflict"; e.current = currentValue; e.proposed = item.value; }
    if (e.status === "unchanged" && locallyModified) { e.current = currentValue; e.proposed = item.value; }
    entries.push(e);
  }
  for (const rec of seedRows) {
    if (seen.has(rec.item_id) || rec.deprecated === 1) continue;
    const row = current[rec.item_type].get(rec.item_id);
    entries.push({
      itemId: rec.item_id, itemType: rec.item_type, seedKey: rec.seed_key, status: "deprecate", locallyModified: false,
      current: row ? itemValue(row) : undefined, baselineHash: rec.baseline_hash, currentHash: null, proposedHash: null, ownership: rec.ownership, deprecatedFlag: false
    });
  }

  // Would the safe changes leave the configuration consistent and mapped to real tables?
  const result = withChanges(current, entries, (e) => (e.status === "add" || e.status === "update" ? e.proposed! : null));
  const resultRows = toRows(result);
  const incompatible = referenceProblems(result);
  const schema = await checkSchema(db, resultRows);
  if (!schema.ok) incompatible.push({ itemType: "dataSource", itemId: "schema", problem: "A mapped table or column is missing or has an incompatible type. See the schema compatibility report." });

  const counts: Record<ItemStatus, number> = { add: 0, update: 0, unchanged: 0, client_owned: 0, conflict: 0, deprecate: 0, missing: 0 };
  for (const e of entries) counts[e.status]++;
  const planHash = await sha256Hex(canonicalJson({ p: pkg.packageId, v: pkg.version, items: entries.map((e) => [e.itemId, e.status, e.currentHash, e.proposedHash, e.baselineHash, e.ownership]).sort() }));
  const items: PlanItem[] = entries
    .filter((e) => !(e.status === "unchanged" && !e.locallyModified))
    .map(({ itemId, itemType, seedKey, status, locallyModified, current, proposed }) => ({ itemId, itemType, seedKey, status, locallyModified, ...(current ? { current } : {}), ...(proposed ? { proposed } : {}) }));
  const plan: UpgradePlan = { packageId: pkg.packageId, fromVersion: installed.version, toVersion: pkg.version, planHash, counts, items, incompatible, schemaOk: schema.ok };
  return { applicationId: app.id, rows, installedVersion: installed.version, entries, expandedRows: expanded.rows, plan };
}

/** Reports what an upgrade would do. Writes nothing. */
export async function previewUpgrade(db: D1Database, pkg: SeedPackage): Promise<UpgradePlan> {
  return (await computeContext(db, pkg)).plan;
}

/** Applies a previewed plan. Conflicts stay unchanged unless a resolution is given for them. */
export async function applyUpgrade(db: D1Database, pkg: SeedPackage, input: UpgradeInput, actor: Actor | null): Promise<UpgradeResult> {
  const ctx = await computeContext(db, pkg);
  if (input.planHash !== ctx.plan.planHash) {
    throw new PlatformError("STALE_PLAN", "The configuration changed since the preview. Preview the upgrade again.", 409);
  }
  const resolutions = input.resolutions ?? {};
  const reset = new Set(input.reset ?? []);
  const byId = new Map(ctx.entries.map((e) => [e.itemId, e]));
  for (const id of reset) if (!byId.get(id) || byId.get(id)!.proposed === undefined) throw new PlatformError("SEED_RESOLUTION_INVALID", `Item ${id} has no upstream value to reset to.`, 400);
  for (const [id, res] of Object.entries(resolutions)) {
    const e = byId.get(id);
    if (!e || (e.status !== "conflict" && !reset.has(id))) throw new PlatformError("SEED_RESOLUTION_INVALID", `Item ${id} is not a conflict.`, 400);
    if (typeof res === "object") {
      const want = Object.keys(e.proposed ?? {}).sort().join(",");
      if (!res.value || Object.keys(res.value).sort().join(",") !== want) throw new PlatformError("SEED_RESOLUTION_INVALID", `The merged value for ${id} must have exactly these fields: ${want}.`, 400);
    } else if (res !== "upstream" && res !== "keep" && res !== "own") throw new PlatformError("SEED_RESOLUTION_INVALID", `Unknown resolution for ${id}.`, 400);
  }

  type Action = { write?: Value; insert?: boolean; baseline?: string; ownership?: string; deprecated?: 0 | 1 };
  const actions = new Map<string, Action>();
  const tally = { added: 0, updated: 0, deprecated: 0, resolved: 0, reset: 0 };
  for (const e of ctx.entries) {
    if (reset.has(e.itemId)) {
      actions.set(e.itemId, { write: e.proposed, insert: e.status === "missing" || e.status === "add", baseline: e.proposedHash!, ownership: "seed_managed", deprecated: 0 });
      tally.reset++;
      continue;
    }
    if (e.status === "add") { actions.set(e.itemId, { write: e.proposed, insert: true, baseline: e.proposedHash! }); tally.added++; }
    else if (e.status === "update") { actions.set(e.itemId, { write: e.proposed, baseline: e.proposedHash!, deprecated: 0 }); tally.updated++; }
    else if (e.status === "unchanged" && e.baselineHash !== e.proposedHash && e.currentHash === e.proposedHash) actions.set(e.itemId, { baseline: e.proposedHash! });
    else if (e.status === "unchanged" && e.deprecatedFlag) actions.set(e.itemId, { deprecated: 0 });
    else if (e.status === "deprecate") { actions.set(e.itemId, { deprecated: 1 }); tally.deprecated++; }
    else if (e.status === "conflict" && resolutions[e.itemId] !== undefined) {
      const res = resolutions[e.itemId];
      if (res === "upstream") actions.set(e.itemId, { write: e.proposed, baseline: e.proposedHash! });
      else if (res === "keep") actions.set(e.itemId, { baseline: e.proposedHash! });
      else if (res === "own") actions.set(e.itemId, { baseline: e.proposedHash!, ownership: "client_owned" });
      else actions.set(e.itemId, { write: res.value, baseline: e.proposedHash! });
      tally.resolved++;
    }
  }
  if (actions.size === 0 && pkg.version === ctx.installedVersion) {
    const active = await db.prepare("SELECT version FROM cfg_active_release WHERE application_id=?").bind(ctx.applicationId).first<{ version: number }>();
    return { status: "unchanged", packageId: pkg.packageId, version: pkg.version, releaseVersion: active?.version ?? 0, applied: tally, conflictsRemaining: ctx.plan.counts.conflict };
  }

  // Check the result before writing anything.
  const current = toState(ctx.rows);
  const next = withChanges(current, ctx.entries, (e) => { const a = actions.get(e.itemId); return a?.write ?? null; });
  const app = next.application.get(ctx.applicationId);
  if (app && app.key !== ctx.rows.application.key) throw new PlatformError("SEED_INVALID", "An upgrade cannot change the application key.", 400);
  const problems = referenceProblems(next);
  if (problems.length) throw new PlatformError("SEED_INVALID", "The upgrade would leave broken references. Nothing was changed.", 409, { problems });
  const schema = await checkSchema(db, toRows(next));
  if (!schema.ok) throw new PlatformError("SCHEMA_INCOMPATIBLE", "The configuration does not match the database tables. Nothing was changed.", 409, schema);

  const now = new Date().toISOString();
  const by = actor ? actor.id : null;
  const stamp = { now, by };
  const statements: D1PreparedStatement[] = [];
  const writes = ctx.entries.filter((e) => actions.get(e.itemId)?.write);
  for (const t of INSERT_ORDER) {
    for (const e of writes.filter((x) => x.itemType === t)) {
      const a = actions.get(e.itemId)!;
      const row = { id: e.itemId, ...a.write! };
      statements.push(a.insert ? insertStatement(db, t, row, ctx.applicationId, stamp) : updateStatement(db, t, row, stamp));
    }
  }
  for (const e of ctx.entries) {
    const a = actions.get(e.itemId);
    if (!a) continue;
    if (e.status === "add") {
      statements.push(db.prepare("INSERT INTO cfg_seed_item (item_id,item_type,package_id,seed_key,ownership,applied_version,baseline_hash) VALUES (?,?,?,?,?,?,?)").bind(e.itemId, e.itemType, pkg.packageId, e.seedKey, "seed_managed", pkg.version, a.baseline));
    } else {
      statements.push(db.prepare("UPDATE cfg_seed_item SET baseline_hash=COALESCE(?,baseline_hash), applied_version=CASE WHEN ? IS NULL THEN applied_version ELSE ? END, ownership=COALESCE(?,ownership), deprecated=COALESCE(?,deprecated) WHERE item_id=?")
        .bind(a.baseline ?? null, a.baseline ?? null, pkg.version, a.ownership ?? null, a.deprecated ?? null, e.itemId));
    }
  }
  statements.push(db.prepare("UPDATE cfg_seed_package SET version=?, min_platform_version=?, applied_at=? WHERE package_id=?").bind(pkg.version, pkg.minPlatformVersion, now, pkg.packageId));

  const snapshotJson = canonicalJson(buildSnapshot(toRows(next), pkg.minPlatformVersion));
  const snapshotHash = await sha256Hex(snapshotJson);
  const active = await db.prepare("SELECT version FROM cfg_active_release WHERE application_id=?").bind(ctx.applicationId).first<{ version: number }>();
  const releaseVersion = (active?.version ?? 0) + 1;
  const releaseId = newId("release");
  const summary = `Upgrade of ${pkg.packageId} from ${ctx.installedVersion} to ${pkg.version}`;
  statements.push(db.prepare("INSERT INTO cfg_release (id,application_id,version,snapshot_json,snapshot_hash,config_schema_version,min_platform_version,summary,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(releaseId, ctx.applicationId, releaseVersion, snapshotJson, snapshotHash, CONFIG_SCHEMA_VERSION, pkg.minPlatformVersion, summary, now, by));
  statements.push(db.prepare("UPDATE cfg_active_release SET release_id=?, version=?, etag=? WHERE application_id=?").bind(releaseId, releaseVersion, `${releaseVersion}-${snapshotHash.slice(0, 12)}`, ctx.applicationId));
  const unresolved = ctx.entries.filter((e) => e.status === "conflict" && !actions.has(e.itemId)).length;
  statements.push(auditStatement(db, actor, {
    action: "seed.upgrade", entityType: "seed_package", entityId: pkg.packageId, outcome: "success", summary,
    details: { ...tally, conflictsRemaining: unresolved, resolutions: Object.fromEntries(Object.entries(resolutions).map(([id, r]) => [id, typeof r === "string" ? r : "merged"])), reset: [...reset] }
  }));

  try {
    await db.batch(statements); // one batch: every change, the new release and the audit event, or nothing
  } catch {
    throw new PlatformError("UPGRADE_FAILED", "The upgrade could not be written and nothing was changed. It is safe to preview and try again.", 409);
  }
  invalidateBootstrapCache();
  return { status: "applied", packageId: pkg.packageId, version: pkg.version, releaseVersion, applied: tally, conflictsRemaining: unresolved };
}
