# Story 06 — Form and Record Engine

**Priority:** P0 · **Depends on:** Stories 03–04  
**Goal:** Make record create/read/update flows reusable and schema-driven.

## User story

As an administrator, I want to build forms from data-source properties so that new tables and modules can create and edit records without custom React form code.

## Scope

1. Generic record detail page/modal renderer.
2. Form renderer using property type editors from Story 04.
3. Form layout configuration: sections, columns, field order, visibility, read-only, required overrides only when stricter than schema.
4. Create, update, read-only and delete/archive modes.
5. Server-side validation and safe mass-assignment protection.
6. Relationship selectors with bounded search and permission checks.
7. System fields and defaults are server-managed.
8. Preserve custom business workflows (sale transaction, ledger updates, device status) as explicit domain services/actions; do not replace transactional business rules with generic CRUD.

## API

- `GET /api/data-sources/:id/records/:recordId`
- `POST /api/data-sources/:id/records`
- `PATCH /api/data-sources/:id/records/:recordId`
- `DELETE /api/data-sources/:id/records/:recordId` or archive endpoint where policy requires.
- `GET /api/data-sources/:id/records/lookup?q=...` for relation pickers.
- `GET /api/forms/:id`, `PUT /api/forms/:id` for form metadata.

Use allowlisted columns, prepared values, optimistic concurrency (updated_at/version) where feasible, and transactions/batches for related record changes. Return structured field errors.

## UI behavior

- Editors are selected from property type registry.
- Required, read-only, default, help text, format, choices, and relation options come from property metadata.
- Show field-level errors beside the field and a summary for multiple errors.
- Confirm destructive actions and show success/failure feedback.
- Preserve unsaved input when server validation fails.
- Accessible labels, keyboard operation, mobile layout, and clear loading states.

## Acceptance criteria

- [ ] A form can be created from a data source without writing a bespoke form component.
- [ ] New and edit forms use the same property metadata as lists.
- [ ] Required, unique, choices, relation, number/date validation are enforced server-side.
- [ ] Hidden/read-only fields cannot be mass-assigned by manipulating requests.
- [ ] Record changes persist after refresh.
- [ ] Related operations that must be atomic use a transaction/batch strategy and do not leave partial sales/ledger state.
- [ ] Existing device/customer/sale forms retain their current business rules.
- [ ] Users receive clear field-specific errors.

## Tests

CRUD integration tests per property type; invalid payload tests; unauthorized field injection; stale update tests; relation lookup permission tests; sales transaction rollback/consistency tests.

## Out of scope

Complex multi-step workflows, approvals, form scripting, public external forms.
