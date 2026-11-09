-- Slice 01d: daily usage estimate for the resource governor and per-data-source version counters
-- (Contracts sections 10.2 and 10.7).

CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT PRIMARY KEY,                       -- UTC day, YYYY-MM-DD
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_source_versions (
  data_source_key TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO data_source_versions (data_source_key, version) VALUES
  ('devices', 1), ('customers', 1), ('ledger', 1), ('sales', 1);
