// Platform routes (bootstrap, seed installation, schema compatibility). Kept out of index.js so the legacy
// file does not grow. Returns a plain response description, or null when the route is not a platform route.
// The Worker applies CORS headers and policy before calling this.

import type { Actor } from "./policy";
import { PlatformError } from "./errors";
import { getBootstrap } from "./config/bootstrap";
import { installSeed } from "./config/seed";
import { SEED_PACKAGES } from "./config/registry";
import { inspectCompatibility } from "./config/compat";
import { loadRows } from "./config/snapshot";

export type PlatformEnv = { DB: D1Database; DEPLOYMENT_KEY?: string; ENVIRONMENT?: string };
export type PlatformResponse = { status: number; body?: unknown; headers?: Record<string, string> };

export async function handlePlatformRoute(request: Request, env: PlatformEnv, path: string, actor: Actor | null): Promise<PlatformResponse | null> {
  try {
    if (path === "/api/bootstrap" && request.method === "GET") {
      const result = await getBootstrap(env.DB, env, request.headers.get("If-None-Match"));
      const headers = { ETag: result.etag, "Cache-Control": "no-cache" };
      return result.status === 304 ? { status: 304, headers } : { status: 200, body: result.body, headers };
    }
    if (path === "/api/platform/seed" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as { packageId?: string } | null;
      const pkg = body?.packageId ? SEED_PACKAGES.find((p) => p.packageId === body.packageId) : SEED_PACKAGES.length === 1 ? SEED_PACKAGES[0] : undefined;
      if (!pkg) throw new PlatformError("SEED_UNKNOWN", "Choose one of the seed packages built into this installation.", 400, { available: SEED_PACKAGES.map((p) => p.packageId) });
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
    return null;
  } catch (err) {
    if (err instanceof PlatformError) return { status: err.status, body: { error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) } };
    throw err;
  }
}
