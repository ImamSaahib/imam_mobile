-- Story 01b: actor columns on business tables and the audit event shape.
-- Actor values are opaque identifiers. Until Story 11 the only actor is "dev-placeholder".
-- Existing rows keep NULL, meaning "before actors were recorded".

ALTER TABLE mobile_devices ADD COLUMN created_by TEXT;
ALTER TABLE mobile_devices ADD COLUMN updated_by TEXT;
ALTER TABLE customers ADD COLUMN created_by TEXT;
ALTER TABLE customers ADD COLUMN updated_by TEXT;
ALTER TABLE sales ADD COLUMN created_by TEXT;
ALTER TABLE sales ADD COLUMN updated_by TEXT;
ALTER TABLE customer_entries ADD COLUMN created_by TEXT;
ALTER TABLE customer_entries ADD COLUMN updated_by TEXT;

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('placeholder', 'user', 'system')),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'failed')),
  summary TEXT,
  details_json TEXT,
  request_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON audit_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events (actor_id);
