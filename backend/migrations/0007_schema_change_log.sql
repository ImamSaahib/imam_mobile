-- Story 04, slice 04c: log of physical schema changes made through the schema change service.
-- One row per applied operation. The row is written in the same batch as the change itself, so a change
-- and its log entry exist together or not at all. The operation ID is chosen by the caller and is the
-- primary key, so repeating an operation returns the stored result instead of repeating the change.
-- Failed attempts are written to audit_events (outcome "failed"), not here, because this row is part of
-- the transaction that failed. This is separate from the legacy schema_changes table.
CREATE TABLE IF NOT EXISTS schema_change_log (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES cfg_application(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL,
  data_source_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('guided_live', 'migration_controlled')),
  request_hash TEXT NOT NULL,
  params_json TEXT NOT NULL,
  sql_text TEXT NOT NULL,
  result_json TEXT NOT NULL,
  release_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_schema_change_log_created ON schema_change_log (created_at);
