# Story 06 — Forms, Records and Domain Service Extensions

**Priority:** P0 · **Depends on:** Stories 02 and 04  
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

Configured buttons may invoke an approved action key. They cannot contain JavaScript, SQL or arbitrary endpoint URLs. The Worker dispatches the action and enforces authorization.

## Acceptance criteria

- [ ] Generic forms are generated from property metadata.
- [ ] Lists and forms use the same property contract.
- [ ] Required/unique/choice/relation/number/date rules are enforced server-side.
- [ ] Hidden or read-only fields cannot be mass-assigned.
- [ ] Related transactional writes are atomic or have a documented consistency strategy.
- [ ] Duplicate financial/inventory actions are safely rejected or idempotent.
- [ ] A domain action can be registered without changing generic form/list code.
- [ ] Action permissions and audit behavior are enforced server-side.
- [ ] Existing device/customer/sale/ledger workflows pass regression tests.

## Tests

CRUD by property type; invalid payloads; unauthorized field injection; stale update; relation lookup authorization; transaction failure; duplicate action submission; action version compatibility.

## Out of scope

Workflow designer, arbitrary form scripting, multi-step approvals, external public forms and arbitrary plugin execution.
