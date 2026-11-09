-- Story 01c-1: normalized configuration catalog, releases and seed ownership (Contracts section 12).
-- Configuration rows are the editable working copy. A release snapshot is derived from them and is immutable.
-- IDs are opaque text (type prefix + 16 hex characters). Business tables are not touched.

CREATE TABLE IF NOT EXISTS cfg_application (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT, updated_by TEXT
);

CREATE TABLE IF NOT EXISTS cfg_page (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES cfg_application(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT, updated_by TEXT
);

CREATE TABLE IF NOT EXISTS cfg_menu (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES cfg_application(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  icon TEXT,
  display TEXT NOT NULL DEFAULT 'section' CHECK (display IN ('group', 'section')),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT, updated_by TEXT
);

CREATE TABLE IF NOT EXISTS cfg_module (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES cfg_application(id) ON DELETE RESTRICT,
  menu_id TEXT NOT NULL REFERENCES cfg_menu(id) ON DELETE RESTRICT,
  page_id TEXT NOT NULL REFERENCES cfg_page(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  badge TEXT,
  position INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT, updated_by TEXT,
  UNIQUE (application_id, slug)
);

CREATE TABLE IF NOT EXISTS cfg_component (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES cfg_page(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  type_version INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT, updated_by TEXT
);

CREATE TABLE IF NOT EXISTS cfg_data_source (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES cfg_application(id) ON DELETE RESTRICT,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  table_name TEXT NOT NULL,
  primary_key TEXT NOT NULL DEFAULT 'id',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT, updated_by TEXT,
  UNIQUE (application_id, key)
);

CREATE TABLE IF NOT EXISTS cfg_property (
  id TEXT PRIMARY KEY,
  data_source_id TEXT NOT NULL REFERENCES cfg_data_source(id) ON DELETE RESTRICT,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  column_name TEXT NOT NULL,
  type TEXT NOT NULL,
  nullable INTEGER NOT NULL DEFAULT 1 CHECK (nullable IN (0, 1)),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT, updated_by TEXT,
  UNIQUE (data_source_id, key)
);

CREATE TABLE IF NOT EXISTS cfg_release (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES cfg_application(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  snapshot_json TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  config_schema_version INTEGER NOT NULL,
  min_platform_version TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  UNIQUE (application_id, version)
);

-- One row per application. Bootstrap reads this row first, so a matching ETag costs one row read.
CREATE TABLE IF NOT EXISTS cfg_active_release (
  application_id TEXT PRIMARY KEY REFERENCES cfg_application(id) ON DELETE RESTRICT,
  release_id TEXT NOT NULL REFERENCES cfg_release(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  etag TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cfg_seed_package (
  package_id TEXT PRIMARY KEY,
  application_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  min_platform_version TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cfg_seed_item (
  item_id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  package_id TEXT NOT NULL REFERENCES cfg_seed_package(package_id) ON DELETE RESTRICT,
  seed_key TEXT NOT NULL,
  ownership TEXT NOT NULL DEFAULT 'seed_managed' CHECK (ownership IN ('seed_managed', 'client_owned')),
  applied_version INTEGER NOT NULL,
  baseline_hash TEXT NOT NULL,
  deprecated INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0, 1)),
  UNIQUE (package_id, item_type, seed_key)
);

CREATE INDEX IF NOT EXISTS idx_cfg_module_menu ON cfg_module (menu_id);
CREATE INDEX IF NOT EXISTS idx_cfg_component_page ON cfg_component (page_id);
CREATE INDEX IF NOT EXISTS idx_cfg_property_source ON cfg_property (data_source_id);
