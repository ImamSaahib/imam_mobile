# Story 04 — Data Model, Properties and Schema Compatibility

**Priority:** P0 · **Depends on:** Story 01; authorization from Story 02  
**Goal:** Make approved relational data sources and typed properties reusable while keeping physical schema changes under migration control.

## User story

As an application developer, I want a data-source/property contract that drives lists and forms consistently, while physical D1 schema changes remain reviewable and safe.

## Three change classes

1. Configuration-only: labels, visibility, ordering, help text, supported formatting, choices where storage remains compatible.
2. Physical schema: tables, columns, affinity/type, indexes, constraints and foreign keys. These require a new migration and coordinated metadata update.
3. Code: new validation semantics, domain behavior, integrations or unsupported property renderers. These require a reviewed code release.

Administrators may configure supported metadata for approved existing schema. They cannot freely create/alter physical columns in the first release.

## Scope

1. Map approved data sources to physical D1 tables.
2. Map properties to physical columns or explicitly declared virtual properties.
3. Define type contracts for text/title, number, currency, select, multi-select, date, checkbox, email, phone, URL, relation and system fields as supported.
4. Define each type's storage representation, editor/display behavior, validation, filter/sort support, import/export behavior and migration implications.
5. Add a schema compatibility service that compares metadata with actual D1 schema.
6. Add migration templates/process for a developer adding a table/column and its metadata.
7. Reject type changes that lack an explicit conversion migration and recovery plan.
8. Ensure restricted properties are marked for server-side authorization.

## Source-of-truth rules

- Physical schema is authoritative for actual columns, constraints and storage.
- Metadata defines supported UI semantics only when compatible with the physical schema.
- A mapped column missing from D1 or with incompatible storage is a blocking error for publish/deploy.
- Drift must identify expected versus observed schema; do not silently drop or coerce fields.
- Existing migrations are immutable.

## Acceptance criteria

- [ ] Every data source maps to an approved physical table.
- [ ] Every non-virtual property maps to a real column.
- [ ] Type/storage contracts are explicit and tested.
- [ ] Schema drift is detected before publish and deployment.
- [ ] Metadata cannot expose a column absent from the physical schema.
- [ ] Admin metadata edits cannot execute arbitrary DDL.
- [ ] Type conversion requires a migration, validation and recovery plan.
- [ ] Values are bound parameters; identifiers are allowlisted and safely quoted.
- [ ] Existing Imam Mobile inventory/customer/sales schema remains compatible.

## Tests

SQLite affinity/column inspection; missing table/column; incompatible type; metadata drift; injection; property type validation; migration from empty and existing dev database.

## Out of scope

Live admin DDL, arbitrary SQL editor, formula language, rollups and unrestricted user-created relational schemas.
