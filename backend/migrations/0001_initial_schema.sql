-- Imam Mobile initial schema
-- Amounts are stored as whole Pakistani rupees (PKR).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mobile_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  company TEXT NOT NULL,
  color TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('Pack', 'Used')),
  status TEXT NOT NULL DEFAULT 'Available'
    CHECK (status IN ('Available', 'Booked', 'Sold Out')),
  imei TEXT NOT NULL UNIQUE,
  purchase_price INTEGER NOT NULL CHECK (purchase_price >= 0),
  sale_price INTEGER CHECK (sale_price IS NULL OR sale_price >= 0),
  purchase_date TEXT NOT NULL,
  sale_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile_number TEXT,
  type TEXT NOT NULL DEFAULT 'Regular'
    CHECK (type IN ('Regular', 'Account')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
  sale_date TEXT NOT NULL,
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Cash', 'Credit')),
  status TEXT NOT NULL DEFAULT 'Completed'
    CHECK (status IN ('Completed', 'Cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  device_id INTEGER NOT NULL REFERENCES mobile_devices(id) ON DELETE RESTRICT,
  sale_price INTEGER NOT NULL CHECK (sale_price >= 0),
  UNIQUE (sale_id, device_id)
);

-- Preserve the existing app's ledger convention:
-- Out (-) increases the customer's outstanding balance.
-- In (+) reduces the customer's outstanding balance.
-- Balance = SUM(Out (-)) - SUM(In (+)).
CREATE TABLE IF NOT EXISTS customer_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
  device_id INTEGER REFERENCES mobile_devices(id) ON DELETE RESTRICT,
  entry_date TEXT NOT NULL,
  due_date TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('In (+)', 'Out (-)')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_status ON mobile_devices(status);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_company_model ON mobile_devices(company, model);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer_date ON sales(customer_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_customer_entries_customer_date ON customer_entries(customer_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_customer_entries_due_date ON customer_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_device ON sale_items(device_id);
