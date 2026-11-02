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

-- Seed a safe default configuration; future saves modify draft_json only.
INSERT OR IGNORE INTO app_configuration (id,draft_json,published_json,published_version)
VALUES (1,'{"schemaVersion":1,"pages":[{"id":"dashboard","title":"Dashboard","enabled":true},{"id":"inventory","title":"Inventory","enabled":true},{"id":"customers","title":"Customers","enabled":true},{"id":"customer-entries","title":"Customer Entries","enabled":true},{"id":"sales","title":"Sales","enabled":true},{"id":"reports","title":"Reports","enabled":true}],"components":[{"id":"dashboard-summary","page":"dashboard","type":"summary","title":"Shop summary","enabled":true},{"id":"inventory-list","page":"inventory","type":"list","title":"Device list","enabled":true},{"id":"customer-list","page":"customers","type":"list","title":"Customer directory","enabled":true},{"id":"ledger-list","page":"customer-entries","type":"list","title":"Customer ledger","enabled":true},{"id":"sales-list","page":"sales","type":"list","title":"Sales register","enabled":true}],"fields":[],"reports":[]}','{"schemaVersion":1,"pages":[{"id":"dashboard","title":"Dashboard","enabled":true},{"id":"inventory","title":"Inventory","enabled":true},{"id":"customers","title":"Customers","enabled":true},{"id":"customer-entries","title":"Customer Entries","enabled":true},{"id":"sales","title":"Sales","enabled":true},{"id":"reports","title":"Reports","enabled":true}],"components":[{"id":"dashboard-summary","page":"dashboard","type":"summary","title":"Shop summary","enabled":true},{"id":"inventory-list","page":"inventory","type":"list","title":"Device list","enabled":true},{"id":"customer-list","page":"customers","type":"list","title":"Customer directory","enabled":true},{"id":"ledger-list","page":"customer-entries","type":"list","title":"Customer ledger","enabled":true},{"id":"sales-list","page":"sales","type":"list","title":"Sales register","enabled":true}],"fields":[],"reports":[]}',1);
INSERT OR IGNORE INTO configuration_versions (version,configuration_json,summary)
VALUES (1,'{"schemaVersion":1,"pages":[{"id":"dashboard","title":"Dashboard","enabled":true},{"id":"inventory","title":"Inventory","enabled":true},{"id":"customers","title":"Customers","enabled":true},{"id":"customer-entries","title":"Customer Entries","enabled":true},{"id":"sales","title":"Sales","enabled":true},{"id":"reports","title":"Reports","enabled":true}],"components":[{"id":"dashboard-summary","page":"dashboard","type":"summary","title":"Shop summary","enabled":true},{"id":"inventory-list","page":"inventory","type":"list","title":"Device list","enabled":true},{"id":"customer-list","page":"customers","type":"list","title":"Customer directory","enabled":true},{"id":"ledger-list","page":"customer-entries","type":"list","title":"Customer ledger","enabled":true},{"id":"sales-list","page":"sales","type":"list","title":"Sales register","enabled":true}],"fields":[],"reports":[]}','Initial default configuration');
