-- Admin configuration engine foundation. Safe, additive schema only.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_configuration (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  draft_json TEXT NOT NULL,
  published_json TEXT NOT NULL,
  published_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS configuration_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  configuration_json TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schema_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  column_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied','failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_table TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  field_key TEXT NOT NULL,
  value_text TEXT,
  UNIQUE(entity_table, record_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_record
  ON custom_field_values(entity_table, record_id);
