# Story 06 — Forms, Records and Domain Service Extensions

**Status:** Planned (waiting on dependencies)  
**Priority:** P0 · **Depends on:** Stories 00, 02 and 04  
**Goal:** Reuse forms and CRUD for ordinary records while keeping business transactions in explicit, versioned domain services.

## User story

As an application developer, I want forms generated from typed properties and a supported extension contract for business operations so new applications reuse generic record behavior without losing domain rules.

## Scope

1. Generic record read/create/update/archive flows.
2. Form renderer using property editors and validation contracts from Story 04.
3. Form layout metadata: sections, columns, field order, visibility, read-only and stricter required overrides.
4. Relationship selectors with bounded search and permission checks.
5. Server-side validation and mass-assignment protection.
6. Optimistic concurrency/version checks where appropriate.
7. Preserve existing domain services for sales, ledger updates and stock status transitions.
8. Define a first-class domain action contract for registered server operations.
9. Open forms in a side panel (default), center dialog or full page, following the row-open setting of the view (Story 05).
10. Support inline cell editing in tables where the property is writable and the view allows it.
11. Row action menu entries (open, edit, duplicate, archive and registered actions) bind to record operations and action keys.
12. Register a configure descriptor for forms (layout, field order, visibility) per Implementation Contracts §7.
13. Every record write and domain action updates the affected counters and the data source version in the same `batch()` as the write ([Contracts §10.2 and §10.4](../IMPLEMENTATION-CONTRACTS.md)).
14. In the Limit state, show a calm message with the reset time and do not queue financial writes for later.

## Domain action contract

Each action defines:
- stable action key and implementation version;
- validated input and output schema;
- required permission;
- transaction boundary and atomicity expectations;
- idempotency key behavior for duplicate submissions;
- audit requirements;
- retryable/non-retryable error codes;
- minimum supported platform/API version.

Configured buttons may invoke an approved action key. They cannot contain JavaScript, SQL or arbitrary endpoint URLs. The Worker dispatches the action and enforces authorization (placeholder policy until Story 11).

### Atomic actions on D1

D1 has no interactive transactions ([Decisions D9](../DECISIONS.md)). An action that checks and then writes uses one `batch()` containing a conditional update (for example `WHERE status = 'Available'`) and the insert, plus a database constraint that rejects a second record for the same subject so the whole batch fails if the update changed no row. An update that changes zero rows is not an error, so the insert must not depend on the update succeeding. Each action also takes an idempotency key. If a server-side sale operation does not exist today (see Story 01), this story creates it.

## Acceptance criteria

- [ ] Generic forms are generated from property metadata.
- [ ] Lists and forms use the same property contract.
- [ ] Required/unique/choice/relation/number/date rules are enforced server-side.
- [ ] Hidden or read-only fields cannot be mass-assigned.
- [ ] Related transactional writes are atomic or have a documented consistency strategy.
- [ ] Duplicate financial/inventory actions are safely rejected or idempotent.
- [ ] Selling the same device twice is rejected by a database constraint, with no duplicate sale rows, and a test proves the second attempt fails.
- [ ] A domain action can be registered without changing generic form/list code.
- [ ] Action permissions and audit behavior are enforced server-side. *(Permission enforcement is deferred to the security phase.)*
- [ ] Forms open in the configured row-open mode, and inline editing respects property writability.
- [ ] The form configure descriptor works by mouse, keyboard and touch.
- [ ] Opening a record reads at most 10 rows. A domain action such as a sale reads at most 30 and writes at most 15, measured on the reference dataset.
- [ ] A sale updates the device status, the sale rows, the counters and the version in one batch, and a failed batch changes none of them.
- [ ] In the Limit state a write attempt shows the reset time and is not queued.
- [ ] Existing device/customer/sale/ledger workflows pass regression tests.

## Tests

CRUD by property type; invalid payloads; unauthorized field injection; stale update; relation lookup authorization; transaction failure; duplicate action submission; action version compatibility.

## Out of scope

Workflow designer, arbitrary form scripting, multi-step approvals, external public forms and arbitrary plugin execution.

## Extension registration and compatibility

Extensions are trusted code compiled with the client Worker, not dynamically downloaded or executed. The Worker statically imports a client registration entry point; generic CRUD, forms and routes call a platform registry and do not import client implementations directly. Keep public extension contracts separate from private platform internals. Each action declares a stable namespaced key, positive implementation version, input/output schema, required permission, minimum platform/API version, transaction/idempotency policy, audit policy and documented error codes/retryability. The dispatcher validates input and permission before execution. Client-supplied actor or permission data is never trusted. Duplicate or missing registrations and incompatible versions fail validation clearly. Configured buttons reference only registered action keys/versions; they cannot contain code, SQL or arbitrary URLs.

A suitable typed contract is an ActionDefinition with key, version, inputSchema, outputSchema, requiredPermission, minimumPlatformVersion and execute(input, trustedContext). Trusted context is constructed by the Worker and contains its D1 binding, authenticated actor, request ID and optional idempotency key. Use actual repository types when implementing; this is an interface requirement, not a requirement to add a particular validation library.

## Additional acceptance criteria

- [ ] A client extension registers through one static entry point and is dispatched through a platform registry.
- [ ] Extension imports are restricted to documented public contracts and client-owned modules.
- [ ] Action schemas, permission, version compatibility, audit and idempotency are enforced server-side.
- [ ] Missing, duplicate and incompatible registrations fail safely.
