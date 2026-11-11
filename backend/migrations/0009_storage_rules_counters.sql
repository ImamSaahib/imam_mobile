-- Story 04, slice 04e: storage rules for approved data tables, and counters.
--
-- 1. Every approved data table gets an indexed updated_at column, so a later copy can ask for changes since a time.
--    sales and customer_entries had none. SQLite cannot add a column with a non-constant default, so it is added
--    as nullable, filled from created_at once here, and set by every write after this migration.
-- 2. devices and customers get archived_at, the column Story 06 uses to archive instead of delete.
-- 3. data_source_counters holds maintained counts (WITHOUT ROWID, so a new counter key is one written row, not two) (Contracts section 10.4). They change in the same batch as the
--    write. The starting values below are the actual counts at migration time. Counter definitions are in code.
-- Existing migrations are not changed.

ALTER TABLE sales ADD COLUMN updated_at TEXT;
ALTER TABLE customer_entries ADD COLUMN updated_at TEXT;
ALTER TABLE mobile_devices ADD COLUMN archived_at TEXT;
ALTER TABLE customers ADD COLUMN archived_at TEXT;

UPDATE sales SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE customer_entries SET updated_at = created_at WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mobile_devices_updated_at ON mobile_devices (updated_at);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers (updated_at);
CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON sales (updated_at);
CREATE INDEX IF NOT EXISTS idx_customer_entries_updated_at ON customer_entries (updated_at);

CREATE TABLE IF NOT EXISTS data_source_counters (
  data_source_key TEXT NOT NULL,
  counter_key TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (data_source_key, counter_key)
) WITHOUT ROWID;

INSERT OR REPLACE INTO data_source_counters (data_source_key, counter_key, value, updated_at)
  SELECT 'devices', 'total', COUNT(*), datetime('now') FROM mobile_devices;
INSERT OR REPLACE INTO data_source_counters (data_source_key, counter_key, value, updated_at)
  SELECT 'devices', 'status=' || status, COUNT(*), datetime('now') FROM mobile_devices GROUP BY status;
INSERT OR REPLACE INTO data_source_counters (data_source_key, counter_key, value, updated_at)
  SELECT 'customers', 'total', COUNT(*), datetime('now') FROM customers;
INSERT OR REPLACE INTO data_source_counters (data_source_key, counter_key, value, updated_at)
  SELECT 'ledger', 'total', COUNT(*), datetime('now') FROM customer_entries;
INSERT OR REPLACE INTO data_source_counters (data_source_key, counter_key, value, updated_at)
  SELECT 'sales', 'total', COUNT(*), datetime('now') FROM sales;
