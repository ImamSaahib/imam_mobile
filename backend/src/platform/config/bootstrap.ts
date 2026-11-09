// Bootstrap (Contracts section 12.5): the active release as one stored snapshot.
// Reads one row when the browser's version matches, two rows otherwise. Never reads normalized configuration rows.

import { PlatformError } from "../errors";
import { PLATFORM_VERSION, CONFIG_SCHEMA_VERSION, compareVersions } from "../version";
import type { Snapshot } from "./types";

export type BootstrapEnv = { DEPLOYMENT_KEY?: string; ENVIRONMENT?: string };

export type BootstrapResult =
  | { status: 304; etag: string }
  | { status: 200; etag: string; body: unknown };

/** The HTTP ETag combines the release version with the platform version, so a platform upgrade also revalidates. */
function httpEtag(releaseEtag: string): string {
  return `"${releaseEtag}-p${PLATFORM_VERSION}"`;
}

function matches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").map((t) => t.trim().replace(/^W\//, "")).some((t) => t === etag || t === "*");
}

export const BOOTSTRAP_CACHE_MS = 60_000;
export const BOOTSTRAP_CACHE_RELAXED_MS = 300_000;

// The active release held in this Worker instance's memory (Contracts section 10.1). A publish or upgrade
// in the same instance clears it; other instances serve the old release for at most the cache time.
let cache: { etag: string; body: unknown; expiresAt: number } | null = null;
export function invalidateBootstrapCache() { cache = null; }

/** `cacheMs` is longer when the resource governor is conserving reads. */
export async function getBootstrap(db: D1Database, env: BootstrapEnv, ifNoneMatch: string | null, cacheMs = BOOTSTRAP_CACHE_MS, now = Date.now()): Promise<BootstrapResult> {
  if (cache && cache.expiresAt > now) {
    return matches(ifNoneMatch, cache.etag) ? { status: 304, etag: cache.etag } : { status: 200, etag: cache.etag, body: cache.body };
  }
  const active = await db.prepare("SELECT application_id, release_id, version, etag FROM cfg_active_release ORDER BY application_id LIMIT 1").first<{ application_id: string; release_id: string; version: number; etag: string }>();
  if (!active) throw new PlatformError("NOT_INSTALLED", "The application has not been installed yet. Install its seed package first.", 404);
  const etag = httpEtag(active.etag);
  if (matches(ifNoneMatch, etag)) return { status: 304, etag };

  const release = await db.prepare("SELECT snapshot_json, min_platform_version, created_at FROM cfg_release WHERE id=?").bind(active.release_id).first<{ snapshot_json: string; min_platform_version: string; created_at: string }>();
  if (!release) throw new PlatformError("RELEASE_MISSING", "The active release could not be read.", 500);
  if (compareVersions(PLATFORM_VERSION, release.min_platform_version) < 0) {
    throw new PlatformError("PLATFORM_TOO_OLD", `This configuration needs platform ${release.min_platform_version} or newer. This installation runs ${PLATFORM_VERSION}.`, 409);
  }
  const snapshot = JSON.parse(release.snapshot_json) as Snapshot;
  const body = {
      deployment: { key: env.DEPLOYMENT_KEY ?? null, environment: env.ENVIRONMENT ?? null },
      platform: { version: PLATFORM_VERSION, configSchemaVersion: CONFIG_SCHEMA_VERSION },
      application: snapshot.application,
      release: { id: active.release_id, version: active.version, createdAt: release.created_at },
      shell: { menus: snapshot.menus, pages: snapshot.pages, dataSources: snapshot.dataSources }
  };
  cache = { etag, body, expiresAt: now + cacheMs };
  return { status: 200, etag, body };
}
