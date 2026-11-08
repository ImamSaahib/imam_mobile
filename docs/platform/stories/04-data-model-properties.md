# Story 04 — Data Model, Properties and Schema Compatibility

**Status:** Planned (waiting on dependencies)  
**Priority:** P0 · **Depends on:** Story 01. Authorization enforcement is deferred to the security phase.  
**Goal:** Make approved relational data sources and typed properties reusable, let a person configure properties from a table column in edit mode, and keep physical schema changes under the schema change service and migrations.

## User story

As an application developer, I want a data-source/property contract that drives lists and forms consistently.

As a person building a module, I want to add a property, edit its options and configure it from the table column, as in a Notion database, while physical D1 schema changes stay safe and reviewable.

## Change classes

1. **Configuration-only:** labels, descriptions, visibility, ordering, display formats, select and status options, defaults, where storage remains compatible.
2. **Physical schema:** handled in two ways.
   - Through the schema change service ([Architecture §7.3](../ARCHITECTURE.md)): add property, add or remove an index, presentation conversions, hide property.
   - Through developer migrations: new tables, constraints, foreign keys, and data-rewriting conversions until the service supports them.
3. **Code:** new validation semantics, domain behavior, integrations or unsupported property renderers. These require a reviewed code release.

A person building a module may configure supported metadata and request allowlisted schema operations through the service. They cannot run arbitrary DDL or SQL.

## Scope

1. Map approved data sources to physical D1 tables.
2. Map properties to physical columns or explicitly declared virtual properties.
3. Define type contracts for title, text, number, currency, select, multi-select, status, date, checkbox, email, phone, URL, relation, unique ID, and created/last edited time and actor. Deferred types are listed in Architecture §7.
4. For each type define storage, editor and display behavior, validation, filter and sort support, import/export behavior, configuration options (Architecture §7.1) and migration implications.
5. Add the schema compatibility service (Architecture §7.2): compare metadata with the actual D1 schema, report unmapped columns, and support **Add as property**.
6. Add the schema change service ([Implementation Contracts §8](../IMPLEMENTATION-CONTRACTS.md)): `add_property`, `add_index`, `drop_index`, `convert_presentation`, `hide_property`; modes `guided_live` and `migration_controlled`; preview; `schema_change_log`; idempotent operation IDs; remaining column capacity (D1 limit 100 columns per table).
7. Add the property configuration model and APIs used by the configure panel: name, description, required, default, searchable, number format, currency, options (stable keys, colors, order, deactivate), status groups, date options, relation settings, unique ID prefix and sensitivity.
8. Add a developer migration process for new tables and constraints with matching metadata.
9. Reject data-rewriting type changes unless they follow the conversion plan in Architecture §7.3.
10. Store a sensitivity value for each property. Enforcement is deferred to the security phase.
11. Index rule ([Contracts §9](../IMPLEMENTATION-CONTRACTS.md)): each searchable, filterable or sortable property declares an index. The schema change service refuses to mark a column searchable on a table over 1,000 rows without one, unless the property is flagged as an exception with a reason.
12. Report each data source's row count, indexes and remaining column capacity, so scans on large tables are visible.
13. Every approved data table has an indexed `updated_at` column and uses archive or cancellation instead of physical delete for records that matter, so a later local copy can sync changes ([Contracts §10.8](../IMPLEMENTATION-CONTRACTS.md)).
14. Add the counter mechanism ([Contracts §10.4](../IMPLEMENTATION-CONTRACTS.md)): registered counter definitions, the `data_source_counters` table, and a rebuild operation that reports drift.
15. Every write to a data source increments its `data_source_versions` row in the same `batch()`.

## D1 and SQLite schema limits

- D1 allows 100 columns per table. Treat that as a hard ceiling, and warn at 80 so there is room for system fields and later migrations.
- SQLite has no general in-place `ALTER COLUMN`. Changing a column type or many constraints needs a table rebuild: create a replacement table, copy and convert validated data, verify row counts, constraints, indexes and relations, then switch.
- Retire a property by hiding or deprecating it and keeping its data. Dropping a physical column is a separate reviewed operation, never part of ordinary property deletion.

## Phasing within this story

- **Phase A:** scope items 1–8 and 10. Add property, option editing, presentation conversions, compatibility inspection.
- **Phase B:** data-rewriting conversions and drop property with backup. Schedule after the early reuse test.

## Source-of-truth rules

- Physical schema is authoritative for actual columns, constraints and storage.
- Metadata defines supported UI semantics only when compatible with physical schema.
- Select and status options live in property metadata with stable keys. Stored values are option keys, never labels.
- A presentation conversion never changes stored values.
- A mapped column missing from D1 or with incompatible storage blocks publish and deploy.
- Drift diagnostics identify expected versus observed schema; never silently drop or coerce fields.
- Existing migrations are immutable.

## Acceptance criteria

- [ ] Every data source maps to an approved physical table.
- [ ] Every non-virtual property maps to a real column.
- [ ] Type/storage contracts are explicit and tested.
- [ ] Schema drift is detected before publish and deployment.
- [ ] Metadata cannot expose a column absent from physical schema.
- [ ] An unmapped column can be adopted as a property.
- [ ] No operation accepts arbitrary DDL or SQL text.
- [ ] Add property works in `guided_live` mode with preview, confirmation and a log entry, and produces a reviewable migration in `migration_controlled` mode.
- [ ] Repeating an operation with the same operation ID does not repeat the change.
- [ ] A failed physical change leaves metadata unchanged; a partial failure is recoverable through **Add as property**.
- [ ] Adding a property is refused when the table reaches 100 columns, and remaining capacity is shown.
- [ ] Select and status options can be added, renamed, recolored, reordered and deactivated without changing stored keys.
- [ ] Presentation conversions validate existing values and report non-conforming rows before applying.
- [ ] Data-rewriting conversions are rejected until Phase B provides preview, backup and recovery.
- [ ] Values are bound parameters; identifiers are allowlisted and safely quoted.
- [ ] Existing Imam Mobile inventory/customer/sales schema remains compatible.
- [ ] Searchable, filterable and sortable properties have indexes or a recorded exception.
- [ ] Marking a column searchable without an index on a table over 1,000 rows is refused.
- [ ] Creating or updating one record writes at most 10 rows, including index rows, on the reference dataset.
- [ ] Every approved data table has an indexed `updated_at` column.
- [ ] Counters stay equal to a full recount after creates, updates and archives, and the rebuild reports drift.
- [ ] The version counter increments in the same batch as the write, and a failed batch changes neither.

## Tests

SQLite affinity/column inspection; missing table/column; incompatible type; metadata drift; unmapped column adoption; injection; property validation; option rename and deactivate; operation idempotency; column limit; failed apply; migration from empty and existing development database.

## Out of scope

Arbitrary DDL, an arbitrary SQL editor, formula language, rollups, person, files and place properties, and unrestricted user-created relational schemas.

## Required storage semantics

- Currency uses integer minor units plus an ISO 4217 currency code; never use floating-point arithmetic for money. Preserve exact stored precision even if a UI displays whole rupees.
- Select values use stable option keys, not labels.
- Status values use stable option keys; each option belongs to one group (to-do, in progress, complete).
- Multi-select uses normalized junction rows, not comma-separated text.
- Date is a calendar date in YYYY-MM-DD with no timezone conversion. Timestamp is UTC ISO-8601 and is converted only for display.
- Checkbox accepts boolean at the API and stores INTEGER 0/1.
- Unique ID is assigned by the server, never reused and never writable.
- Relations use declared target keys, verify target existence/read permission, and declare delete behavior. Default relation deletion to RESTRICT.
- Number values declare integer/fractional semantics, range and precision. Reject non-finite values and unsafe overflow.
- Every property declares nullability, required/unique behavior, supported query operators, sensitivity and writability. Virtual/computed fields are read-only reviewed server implementations, never metadata expressions.

## Additional acceptance criteria

- [ ] Currency calculations use integer minor units and explicit currency codes.
- [ ] Multi-select values are normalized and referentially validated.
- [ ] Date and timestamp semantics are tested separately, including timezone boundaries.
- [ ] Relation deletion behavior is explicit and tested.
- [ ] Property type/operator support is consistent across forms, lists, filters, sorting and import/export.
