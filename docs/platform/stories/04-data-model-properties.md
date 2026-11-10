# Story 04 — Data Model, Properties and Schema Compatibility

**Status:** In progress (slice plan written 2026-11-10; slices 04a to 04f not started)  
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

## Implementation notes

Findings, decisions and evidence are recorded here as the work happens. Each slice adds a dated entry.

### Slice plan (written 2026-11-10, before any code)

**Starting point.** Story 01 is code complete. These parts already exist and are reused:
- `cfg_property` holds `key`, `label`, `column_name`, `type`, `nullable` and `position` only (migration 0004).
- `config/compat.ts` has `inspectCompatibility`, the `ACCEPTED` type map and `isBlockedTable`. It reports mapped, missing, incompatible and unmapped columns, with quoted identifiers.
- `config/rows-sql.ts`, `PlatformError`, `auditStatement`, `bumpVersionStatement` and the test helpers (`call`, `callWithEnv`, `X-Rows-Read` headers).
- Seed upgrade (`previewUpgrade`, `applyUpgrade`) already writes configuration rows, creates a release and moves the active pointer in one `db.batch()`.
- The legacy `schema_changes` table and the admin add-column and add-index routes stay until Story 07 (legacy inventory). The new log table is separate: `schema_change_log`.

**Findings from reading the code that shape the plan**
1. `sales` and `customer_entries` have no `updated_at` column (only `created_at`). The acceptance criterion "every approved data table has an indexed `updated_at`" therefore needs a migration. SQLite cannot add a column with a non-constant default, so the column is added as nullable, backfilled from `created_at`, and set by every write.
2. Stored values of existing select and status columns are the display strings (`Sold Out`, `In (+)`, `Out (-)`). The contract says stored values are option keys. The option key for these seeded options is therefore the stored string, and the label is separate. Generated keys for options created later use a slug. A key is never changed once records may use it.
3. Amounts are stored as whole rupees (migration 0001), and the seed maps them as `number`. Contracts §3 says currency is integer minor units plus an ISO code. A currency property gets a `scale` setting (digits of minor unit stored: 0 for the existing whole-rupee columns, 2 for new columns), so existing data is not rewritten. This adds a rule to Contracts §3, which is updated in slice 04a.
4. Write cost is near the budget. A device insert writes the table row, the unique IMEI index, the status index, the company and model index and, after slice 04e, the `updated_at` index: 5 rows. Version row plus two counter rows (total and status) make 8. An audit event makes 9. The budget is 10. Slice 04e measures this and reports it; no index is added to a table without that measurement.
5. Row counts for the compatibility report cannot use an unbounded `COUNT(*)`, which reads the whole table. Until counters exist (04e), the report counts at most 1,001 rows and shows "1,000+" (Contracts §9 rule 4).
6. The 01d notes say counters belong to Stories 05 and 06. Story 04 scope items 14 and 15 assign the counter mechanism and the version bump to this story, and Stories 05 and 06 use them. This story owns the mechanism. Stories 05 and 06 keep rebuilding the record writes.
7. D1 runs a `batch()` as one transaction. Whether an `ALTER TABLE` and the metadata inserts in the same batch roll back together on failure is not yet confirmed on this runtime. Slice 04c tests it before relying on it. The contract's recovery path (unmapped column, **Add as property**) stays in place either way.

**Slices.** Each slice is one commit on `development` that includes code, tests, this section, Status lines, TIMELINE and HANDOFF.

| Slice | Scope items | Content | Evidence that closes it |
|---|---|---|---|
| **04a** Property contracts and configuration model | 3, 4, 7, 10 (and 1, 2 for the seed) | Migration 0006 extends `cfg_property`: `description`, `required`, `default_json`, `searchable`, `sensitivity`, `hidden`, `config_json` (options, status groups, number and currency format, date options, relation settings, unique ID prefix), `index_exception_reason`. A type registry in code (`config/property-types.ts`) defines for each type: storage, accepted SQLite types, value validation, filter, sort and search operators, configuration schema and writability. Option rules: stable keys, labels, colors, order, deactivate; status options belong to one group and one default. Seed package version 2 declares options for the existing select and status columns (keys equal the stored strings), currency scale 0 for amounts, and keeps all seed IDs. Config-only property routes: read and update label, description, required, default, searchable, sensitivity and options. Contracts §3 gains the currency scale rule. | Tests for every type (valid and invalid values, date and timestamp boundaries, currency minor units and overflow, number range), option add, rename, recolor, reorder and deactivate with stable keys, operator consistency across list, filter, sort and import (one table-driven test), seed v2 upgrade preview showing only expected updates, seed IDs unchanged (golden test) |
| **04b** Schema inspection and adoption | 1, 2, 5, 12 | Extends inspection with `PRAGMA index_list` and `index_info`, column capacity (100 hard, warn at 80), bounded row count, system columns (`updated_at`, actor columns). `GET /api/platform/data-sources/:key/schema`. Adopt an unmapped column as a property (metadata only, type inferred from the SQLite type with the user's choice among compatible types). Metadata can never expose a column that is absent from the table. | Tests: missing table, missing column, incompatible type, unmapped column adoption, a column added outside the service, blocked tables, injection attempts in names, capacity at 79, 80 and 100 columns (synthetic table), rows read per report |
| **04c** Schema change service, core and `add_property` | 6 (log, preview, idempotency, limits, `guided_live`) | Migration 0007: `schema_change_log`. Closed operation list, validation, SQL generated only from validated parameters, preview with SQL (read-only), affected row counts, remaining capacity and backup requirement. Apply requires operation ID and confirmation. Repeating an operation ID returns the first result. The ALTER, property row, release and log update go in one `batch()` if the runtime test confirms rollback (finding 7); otherwise the contract's two-step order and recovery apply. The change publishes a release the same way seed upgrade does, until Story 07 adds drafts. | Tests: idempotent repeat, preview SQL equals applied SQL, failed apply leaves metadata unchanged, 100-column refusal, partial failure recovered by adoption, no operation accepts SQL text, empty and existing database |
| **04d** Remaining operations and `migration_controlled` | 6, 9, 11 | `add_index`, `drop_index`, `hide_property`, `convert_presentation` (text to email, phone, URL and back; number format; select to status with keys kept) with a report of non-conforming rows before applying. Index rule: refuse `searchable` on a table over 1,000 rows without an index unless an exception reason is recorded. Data-rewriting conversions are refused with a clear error until Phase B. `migration_controlled` returns the generated migration file name and text and the metadata change for review; the worker cannot write repository files, so the maintainer commits the file. The release records its required migration level, and publish is refused until the database reports it (design detail to be recorded in this slice's notes). | Tests: each operation in both modes, index rule refusal and exception, conversion previews, rewriting conversions refused, migration level gate |
| **04e** Data-source storage rules, counters and versions | 13, 14, 15 | Migration 0008: `updated_at` (nullable, backfilled, indexed) on `sales` and `customer_entries`, indexes on `updated_at` for devices and customers, `archived_at` on devices and customers, `data_source_counters`. Counter definitions registered in code, with a rebuild operation that reports drift. `bumpVersionStatement` and counter updates added to the legacy create and update routes in the same `batch()` as the write; legacy `updated_at` filled on every write. The behavior of the legacy DELETE routes (physical delete today, pinned by baseline tests) stays until Story 06, which replaces them with archive and cancellation. Seed v3 maps the new columns. Row counts in the schema report come from counters. | Measured rows written per create and update on the reference dataset (target at most 10), counters equal a full recount after create, update and archive, rebuild reports injected drift, a failed batch changes neither the record nor the version nor the counters |
| **04f** Migration process, review, close | 8 and the story review | Document the developer migration process for new tables and constraints with matching metadata, and a test that every approved data source maps to an approved table and every migration number is unique and ordered. Update the legacy inventory (`schema_changes`, add-column routes: what Story 07 removes). Story review written into these notes: acceptance boxes, deferred items, risks. | All acceptance boxes checked or explicitly deferred with a reason |

**Gate for TIMELINE step 7:** add-property works in both modes with preview and log. That is met after 04d. Slices 04e and 04f complete the story.

**Phase B** (data-rewriting conversions, drop property with backup) stays scheduled after the early reuse checkpoint (TIMELINE step 10, D15).

**Open questions for the owner**
1. Currency scale (finding 3): confirm that a per-property `scale` is acceptable, so whole-rupee columns stay as they are. The alternative is to rewrite existing amounts to minor units, which is a data-rewriting conversion and belongs to Phase B.
2. Until Story 07 adds drafts, a schema change publishes a new release immediately. Confirm this is acceptable for development-only data.

**Not started.** No code has been changed for this story yet.
