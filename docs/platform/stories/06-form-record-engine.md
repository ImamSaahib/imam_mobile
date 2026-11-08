# Story 06 — Forms, Records and Domain Service Extensions

**Priority:** P1 · **Depends on:** Stories 03 and 04  
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
8. Define a first-class domain action contract for registered server operations, with permission enforcement wired as a later security phase.

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

Configured buttons may invoke an approved action key. They cannot contain JavaScript, SQL or arbitrary endpoint URLs. The Worker dispatches the action through a centralized policy hook. Full authentication and authorization enforcement are implemented after the UI/UX phase; production use is blocked until then.

## Acceptance criteria

- [ ] Generic forms are generated from property metadata.
- [ ] Lists and forms use the same property contract.
- [ ] Required/unique/choice/relation/number/date rules are enforced server-side.
- [ ] Hidden or read-only fields cannot be mass-assigned.
- [ ] Related transactional writes are atomic or have a documented consistency strategy.
- [ ] Duplicate financial/inventory actions are safely rejected or idempotent.
- [ ] A domain action can be registered without changing generic form/list code.
- [ ] Action definitions declare permission and audit requirements; enforcement is completed in the later security/audit phase.
- [ ] Existing device/customer/sale/ledger workflows pass regression tests.

## Tests

CRUD by property type; invalid payloads; mass-assignment rejection; stale update; relation integrity; transaction failure; duplicate action submission; action version compatibility. Authentication/authorization and sensitive-field tests are added in the later security phase.

## Out of scope

Authentication/authorization implementation (scheduled after UI/UX); workflow designer, arbitrary form scripting, multi-step approvals, external public forms and arbitrary plugin execution.

## Extension registration and compatibility

Extensions are trusted code compiled with the client Worker, not dynamically downloaded or executed. The Worker statically imports a client registration entry point; generic CRUD, forms and routes call a platform registry and do not import client implementations directly. Keep public extension contracts separate from private platform internals. Each action declares a stable namespaced key, positive implementation version, input/output schema, required permission, minimum platform/API version, transaction/idempotency policy, audit policy and documented error codes/retryability. The dispatcher validates input and permission before execution. Client-supplied actor or permission data is never trusted. Duplicate or missing registrations and incompatible versions fail validation clearly. Configured buttons reference only registered action keys/versions; they cannot contain code, SQL or arbitrary URLs.

A suitable typed contract is an ActionDefinition with key, version, inputSchema, outputSchema, requiredPermission, minimumPlatformVersion and execute(input, trustedContext). Trusted context is constructed by the Worker and contains its D1 binding, authenticated actor, request ID and optional idempotency key. Use actual repository types when implementing; this is an interface requirement, not a requirement to add a particular validation library.

## Additional acceptance criteria

- [ ] A client extension registers through one static entry point and is dispatched through a platform registry.
- [ ] Extension imports are restricted to documented public contracts and client-owned modules.
- [ ] Action schemas, permission, version compatibility, audit and idempotency are enforced server-side.
- [ ] Missing, duplicate and incompatible registrations fail safely.
