-- Story 04, slice 04d.
-- cfg_property: a property can be hidden (kept in the table and the configuration, left out of forms and lists)
-- and can record why a searchable property has no index.
-- schema_change_log: in migration_controlled mode a change first waits for its migration ("awaiting_migration"),
-- and is published only after the database shows the physical change.
-- All new columns have constant defaults, so existing rows stay valid.
ALTER TABLE cfg_property ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1));
ALTER TABLE cfg_property ADD COLUMN index_exception_reason TEXT;
ALTER TABLE schema_change_log ADD COLUMN status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'awaiting_migration'));
ALTER TABLE schema_change_log ADD COLUMN migration_file TEXT;
