// Audit event shape (Story 01b). Story 09 decides which events are recorded, their retention and
// who may read them. This helper only builds the statement so a write and its audit event can go
// into the same D1 batch and succeed or fail together.

import type { Actor } from "./policy";

export type AuditOutcome = "success" | "denied" | "failed";

export type AuditEvent = {
  /** Dotted action name, for example "device.create". */
  action: string;
  entityType?: string;
  entityId?: string | number;
  outcome?: AuditOutcome;
  /** One short human-readable line. Never put secrets or personal data here. */
  summary?: string;
  /** Small structured detail, for example changed property names. Truncated at 2,000 characters. */
  details?: unknown;
  requestId?: string;
};

const MAX_DETAILS = 2000;

/** Prepares an INSERT for one audit event. The caller adds it to a batch. */
export function auditStatement(db: D1Database, actor: Actor | null, event: AuditEvent): D1PreparedStatement {
  const actorId = actor ? actor.id : "anonymous";
  const actorKind = actor ? actor.kind : "system";
  let details: string | null = null;
  if (event.details !== undefined) {
    const text = JSON.stringify(event.details);
    details = text.length > MAX_DETAILS ? text.slice(0, MAX_DETAILS) : text;
  }
  return db
    .prepare(
      "INSERT INTO audit_events (id,actor_id,actor_kind,action,entity_type,entity_id,outcome,summary,details_json,request_id) VALUES (?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(
      crypto.randomUUID(),
      actorId,
      actorKind,
      event.action,
      event.entityType ?? null,
      event.entityId === undefined ? null : String(event.entityId),
      event.outcome ?? "success",
      event.summary ?? null,
      details,
      event.requestId ?? null
    );
}
