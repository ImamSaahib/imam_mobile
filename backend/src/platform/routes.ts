// Platform routes (bootstrap, seed installation, schema compatibility). Kept out of index.js so the legacy
// file does not grow. Returns a plain response description, or null when the route is not a platform route.
// The Worker applies CORS headers and policy before calling this.

import type { Actor } from "./policy";
import { PlatformError } from "./errors";
import { getBootstrap, BOOTSTRAP_CACHE_MS, BOOTSTRAP_CACHE_RELAXED_MS } from "./config/bootstrap";
import { governor } from "./governor";
import { installSeed } from "./config/seed";
import { previewUpgrade, applyUpgrade, type UpgradeInput } from "./config/seed-upgrade";
import { SEED_PACKAGES } from "./config/registry";
import { inspectCompatibility } from "./config/compat";
import { loadRows } from "./config/snapshot";
import { describeTypes } from "./config/property-types";
import { inspectSchema, adoptColumn, type AdoptInput } from "./config/schema-inspect";
import { listProperties, updateProperty, type PropertyUpdate } from "./config/property-config";

export type PlatformEnv = { DB: D1Database; DEPLOYMENT_KEY?: string; ENVIRONMENT?: string };
export type PlatformResponse = { status: number; body?: unknown; headers?: Record<string, string> };

export async function handlePlatformRoute(request: Request, env: PlatformEnv, path: string, actor: Actor | null): Promise<PlatformResponse | null> {
  try {
    if (path === "/api/bootstrap" && request.method === "GET") {
      const state = governor.state();
      const result = await getBootstrap(env.DB, env, request.headers.get("If-None-Match"), state === "normal" ? BOOTSTRAP_CACHE_MS : BOOTSTRAP_CACHE_RELAXED_MS);
      // The state travels in a header as well, because a 304 has no body.
      const headers = { ETag: result.etag, "Cache-Control": "no-cache", "X-Resource-State": state };
      return result.status === 304 ? { status: 304, headers } : { status: 200, body: { ...(result.body as object), resources: governor.snapshot() }, headers };
    }
    if (request.method === "POST" && (path === "/api/platform/seed" || path === "/api/platform/seed/preview" || path === "/api/platform/seed/upgrade")) {
      const body = (await request.json().catch(() => null)) as ({ packageId?: string } & Partial<UpgradeInput>) | null;
      const pkg = body?.packageId ? SEED_PACKAGES.find((p) => p.packageId === body.packageId) : SEED_PACKAGES.length === 1 ? SEED_PACKAGES[0] : undefined;
      if (!pkg) throw new PlatformError("SEED_UNKNOWN", "Choose one of the seed packages built into this installation.", 400, { available: SEED_PACKAGES.map((p) => p.packageId) });
      if (path === "/api/platform/seed/preview") return { status: 200, body: await previewUpgrade(env.DB, pkg), headers: { "Cache-Control": "no-store" } };
      if (path === "/api/platform/seed/upgrade") {
        if (!body?.planHash) throw new PlatformError("SEED_PLAN_REQUIRED", "Send the planHash from the preview.", 400);
        const result = await applyUpgrade(env.DB, pkg, { planHash: body.planHash, resolutions: body.resolutions, reset: body.reset }, actor);
        return { status: 200, body: result, headers: { "Cache-Control": "no-store" } };
      }
      const result = await installSeed(env.DB, pkg, actor);
      return { status: result.status === "installed" ? 201 : 200, body: result, headers: { "Cache-Control": "no-store" } };
    }
    if (path === "/api/platform/schema-compatibility" && request.method === "GET") {
      const app = await env.DB.prepare("SELECT id FROM cfg_application ORDER BY id LIMIT 1").first<{ id: string }>();
      if (!app) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet.", 404);
      const rows = await loadRows(env.DB, app.id);
      const report = await inspectCompatibility(env.DB, rows!.dataSources.map((ds) => ({ key: ds.key, tableName: ds.tableName, properties: rows!.properties.filter((p) => p.dataSourceId === ds.id) })));
      return { status: 200, body: report, headers: { "Cache-Control": "no-store" } };
    }
    if (path === "/api/platform/property-types" && request.method === "GET") {
      return { status: 200, body: { types: describeTypes() }, headers: { "Cache-Control": "no-store" } };
    }
    if (path === "/api/platform/properties" && request.method === "GET") {
      const dataSource = new URL(request.url).searchParams.get("dataSource") ?? undefined;
      return { status: 200, body: { properties: await listProperties(env.DB, dataSource) }, headers: { "Cache-Control": "no-store" } };
    }
    if (path === "/api/platform/properties" && request.method === "PATCH") {
      const body = (await request.json().catch(() => null)) as PropertyUpdate | null;
      if (!body) throw new PlatformError("PROPERTY_INVALID", "Send a JSON body.", 400);
      return { status: 200, body: await updateProperty(env.DB, body, actor), headers: { "Cache-Control": "no-store" } };
    }
    if (path === "/api/platform/schema" && request.method === "GET") {
      const dataSource = new URL(request.url).searchParams.get("dataSource");
      if (!dataSource) throw new PlatformError("SCHEMA_INVALID", "Send ?dataSource=<key>.", 400);
      return { status: 200, body: await inspectSchema(env.DB, dataSource), headers: { "Cache-Control": "no-store" } };
    }
    if (path === "/api/platform/properties/adopt" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as AdoptInput | null;
      if (!body) throw new PlatformError("PROPERTY_INVALID", "Send a JSON body.", 400);
      return { status: 201, body: await adoptColumn(env.DB, body, actor), headers: { "Cache-Control": "no-store" } };
    }
    return null;
  } catch (err) {
    if (err instanceof PlatformError) return { status: err.status, body: { error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) } };
    throw err;
  }
}
