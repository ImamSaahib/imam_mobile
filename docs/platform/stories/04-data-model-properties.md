# Story 04 — Data Model, Properties and Schema Compatibility

**Priority:** P0 · **Depends on:** Stories 01 and 03  
**Goal:** Make approved relational data sources and typed properties reusable while keeping physical schema changes under migration control.

## User story

As an application developer, I want a data-source/property contract that drives lists and forms consistently, while physical D1 schema changes remain reviewable and safe.

## Three change classes

1. **Configuration-only:** labels, visibility, ordering, help text, supported formatting and choices where storage remains compatible.
2. **Physical schema:** tables, columns, affinity/type, indexes, constraints and foreign keys. These require a new migration and coordinated metadata update.
3. **Code:** new validation semantics, domain behavior, integrations or unsupported property renderers. These require a reviewed code release.

Administrators can create a property definition in the configuration UI when it maps to an already-existing approved physical column, and can edit its supported presentation/validation metadata. A property that needs a new physical column, table, index or constraint is marked **Migration required** and cannot become active until a reviewed migration and metadata update are deployed. Changing a property's type is a controlled conversion workflow, not a metadata-only edit. The UI must explain the impact and collect a conversion plan, but execution is performed by a developer-controlled migration.

## Scope

1. Map approved data sources to physical D1 tables.
2. Map properties to physical columns or explicitly declared virtual properties.
3. Define type contracts for text/title, number, currency, select, multi-select, date, checkbox, email, phone, URL, relation and system fields as supported.
4. Define each type's storage representation, editor/display behavior, validation, filter/sort support, import/export behavior and migration implications.
5. Add a schema compatibility service comparing metadata with actual D1 schema.
6. Add a developer migration process for a new table/column and matching metadata.
7. Support property creation against existing approved columns, and classify new-column requests as migration-required.
8. Provide a type-change assessment workflow with source/target types, conversion validation, affected-row counts, invalid-value report and recovery/backup plan; actual conversion requires a migration.
9. Ensure sensitivity and writability metadata are recorded now; enforcement is implemented in the later security phase.

## D1 and SQLite schema limits

Treat Cloudflare D1's documented limit of 100 columns per table as a hard design ceiling for this platform version. Set a lower operational warning threshold (default 80 columns) so there is room for system fields and future migrations. Validate column count before proposing or applying a migration; do not encourage wide tables as a substitute for relations or normalized child tables. Recheck the current Cloudflare D1 limits during implementation because provider limits can change.

SQLite does not provide a general in-place `ALTER COLUMN` operation for changing a column's declared type. Type changes and many constraint changes require a table-rebuild migration: create a replacement table, copy/convert validated data, verify row counts and constraints, swap tables safely, recreate indexes/triggers/foreign keys, and retain a recovery path. Account for foreign keys, indexes, triggers, views, dependent queries and D1 migration behavior. Never drop the source table before validation succeeds. For large or risky conversions, use staged expand/backfill/switch/contract releases rather than one destructive migration.

Property retirement should first hide/deprecate the property and preserve stored data. Physical column removal is a separate reviewed migration and is not part of ordinary property deletion.

## Source-of-truth rules

- Physical schema is authoritative for actual columns, constraints and storage.
- Metadata defines supported UI semantics only when compatible with physical schema.
- A mapped column missing from D1 or with incompatible storage blocks publish/deploy.
- Drift diagnostics identify expected versus observed schema; never silently drop or coerce fields.
- Existing migrations are immutable.

## Acceptance criteria

- [ ] Every data source maps to an approved physical table.
- [ ] Every non-virtual property maps to a real column.
- [ ] Type/storage contracts are explicit and tested.
- [ ] Schema drift is detected before publish and deployment.
- [ ] Metadata cannot expose a column absent from physical schema.
- [ ] Admin metadata edits cannot execute arbitrary DDL.
- [ ] A property can be defined against an existing approved physical column through the configuration UI.
- [ ] New physical columns are classified as migration-required and are not created by live admin configuration.
- [ ] Type changes produce a reviewed conversion plan and cannot run as metadata-only updates.
- [ ] D1 column-count limits and operational warning thresholds are validated before schema changes.
- [ ] Table-rebuild migrations validate converted data, constraints, indexes and relationships before switching.
- [ ] Property retirement does not automatically drop physical data.
- [ ] Type conversion requires migration, validation and recovery plan.
- [ ] Values are bound parameters; identifiers are allowlisted and safely quoted.
- [ ] Existing Imam Mobile inventory/customer/sales schema remains compatible.

## Tests

SQLite affinity/column inspection; missing table/column; incompatible type; metadata drift; injection; property validation; migration from empty and existing development database.

## Out of scope

Live admin DDL, arbitrary SQL editor, formula language, rollups and unrestricted user-created relational schemas. Full automated schema migration orchestration from the browser is also out of scope.

## Required storage semantics

- Currency uses integer minor units plus an ISO 4217 currency code; never use floating-point arithmetic for money. Preserve exact stored precision even if a UI displays whole rupees.
- Select values use stable option keys, not labels.
- Multi-select uses normalized junction rows, not comma-separated text.
- Date is a calendar date in YYYY-MM-DD with no timezone conversion. Timestamp is UTC ISO-8601 and is converted only for display.
- Checkbox accepts boolean at the API and stores INTEGER 0/1.
- Relations use declared target keys, verify target existence/read permission, and declare delete behavior. Default relation deletion to RESTRICT.
- Number values declare integer/fractional semantics, range and precision. Reject non-finite values and unsafe overflow.
- Every property declares nullability, required/unique behavior, supported query operators, sensitivity and writability. Virtual/computed fields are read-only reviewed server implementations, never metadata expressions.

## Additional acceptance criteria

- [ ] Currency calculations use integer minor units and explicit currency codes.
- [ ] Multi-select values are normalized and referentially validated.
- [ ] Date and timestamp semantics are tested separately, including timezone boundaries.
- [ ] Relation deletion behavior is explicit and tested.
- [ ] Property type/operator support is consistent across forms, lists, filters, sorting and import/export.
