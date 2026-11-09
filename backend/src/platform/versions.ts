// Data source version counters (Contracts section 10.2). A write to a data source adds `bumpVersion` to the
// same batch, so the counter and the data change together or not at all. Read routes build their ETag from the
// release version and this counter, and answer 304 when it matches.

export function bumpVersionStatement(db: D1Database, dataSourceKey: string): D1PreparedStatement {
  return db.prepare(
    "INSERT INTO data_source_versions (data_source_key, version, updated_at) VALUES (?,1,datetime('now')) " +
    "ON CONFLICT(data_source_key) DO UPDATE SET version=version+1, updated_at=datetime('now')"
  ).bind(dataSourceKey);
}

export async function getVersion(db: D1Database, dataSourceKey: string): Promise<number> {
  const row = await db.prepare("SELECT version FROM data_source_versions WHERE data_source_key=?").bind(dataSourceKey).first<{ version: number }>();
  return row?.version ?? 0;
}

export const dataSourceEtag = (releaseVersion: number, dataSourceVersion: number) => `"r${releaseVersion}-d${dataSourceVersion}"`;
