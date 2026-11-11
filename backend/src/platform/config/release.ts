// Publishing a new release from the working configuration rows. Used by every change that edits configuration
// after installation (property updates, column adoption, schema changes). Seed install and seed upgrade keep
// their own code because they also write seed items.
//
// The caller adds its own configuration statements first and its audit statement last, then runs them in one
// db.batch(). UNIQUE (application_id, version) on cfg_release makes two changes made from the same release
// conflict, so the second batch fails as a whole.

import { CONFIG_SCHEMA_VERSION } from "../version";
import { canonicalJson } from "./canonical";
import { newId, sha256Hex } from "./ids";
import { buildSnapshot } from "./snapshot";
import type { ConfigRows } from "./types";

export type ActiveRelease = { release_id: string; version: number };

export async function readActiveRelease(db: D1Database, applicationId: string): Promise<ActiveRelease | null> {
  return db.prepare("SELECT release_id, version FROM cfg_active_release WHERE application_id = ?").bind(applicationId).first<ActiveRelease>();
}

export async function releaseStatements(db: D1Database, input: { applicationId: string; active: ActiveRelease; rows: ConfigRows; summary: string; now: string; by: string | null }) {
  const meta = await db.prepare("SELECT min_platform_version FROM cfg_release WHERE id = ?").bind(input.active.release_id).first<{ min_platform_version: string }>();
  const minPlatformVersion = meta?.min_platform_version ?? "0.1.0";
  const snapshotJson = canonicalJson(buildSnapshot(input.rows, minPlatformVersion));
  const snapshotHash = await sha256Hex(snapshotJson);
  const releaseVersion = input.active.version + 1;
  const releaseId = newId("release");
  const statements = [
    db.prepare("INSERT INTO cfg_release (id,application_id,version,snapshot_json,snapshot_hash,config_schema_version,min_platform_version,summary,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(releaseId, input.applicationId, releaseVersion, snapshotJson, snapshotHash, CONFIG_SCHEMA_VERSION, minPlatformVersion, input.summary, input.now, input.by),
    db.prepare("UPDATE cfg_active_release SET release_id=?, version=?, etag=? WHERE application_id=?")
      .bind(releaseId, releaseVersion, `${releaseVersion}-${snapshotHash.slice(0, 12)}`, input.applicationId)
  ];
  return { statements, releaseVersion };
}
