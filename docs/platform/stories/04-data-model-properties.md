# Story 04 — Data Model, Properties and Schema Compatibility

**Status:** Complete with deferred items (slices 04a to 04f done; 04f on 2026-11-12). Deferred boxes are listed in the Story review  
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

- [ ] Every data source maps to an approved physical table. (04b: inspection reports blocked and missing tables, and changes are refused for them. The check on publish and deployment arrives with Story 07)
- [ ] Every non-virtual property maps to a real column. (04b: checked before every configuration change through these services. Publish and deployment checks arrive with Story 07)
- [x] Type/storage contracts are explicit and tested. (04a: `TYPE_CONTRACTS` for 19 types, 33 unit tests)
- [ ] Schema drift is detected before publish and deployment. (04b: `SCHEMA_DRIFT` refuses property updates and adoption. The Story 07 publish and the deployment check are still to do)
- [x] Metadata cannot expose a column absent from physical schema. (04b: `assertNoDrift` before each change, and adoption reads the table first)
- [x] An unmapped column can be adopted as a property. (04b: `POST /api/platform/properties/adopt`)
- [x] No operation accepts arbitrary DDL or SQL text. (04c, 04d: a closed list of five operations. Unknown operations, fields and SQL are refused at the top level and in `params`)
- [x] Add property works in `guided_live` mode with preview, confirmation and a log entry, and produces a reviewable migration in `migration_controlled` mode. (04c `guided_live`, 04d `migration_controlled`)
- [x] Repeating an operation with the same operation ID does not repeat the change. (04c)
- [x] A failed physical change leaves metadata unchanged; a partial failure is recoverable through **Add as property**. (04c: one batch, tested with a competing release. Orphan column recovered through adoption)
- [x] Adding a property is refused when the table reaches 100 columns, and remaining capacity is shown. (04b shows capacity, 04c refuses with `COLUMN_LIMIT` at 100)
- [x] Select and status options can be added, renamed, recolored, reordered and deactivated without changing stored keys. (04a: `PATCH /api/platform/properties`; removing a key is refused)
- [x] Presentation conversions validate existing values and report non-conforming rows before applying. (04d: `convert_presentation`; the report lists row IDs and reasons, and values only for option columns)
- [x] Data-rewriting conversions are rejected until Phase B provides preview, backup and recovery. (04d: `CONVERSION_REWRITES_DATA`; only text-like to text-like and select to status are allowed)
- [x] Values are bound parameters; identifiers are allowlisted and safely quoted. (04c, 04d: all five operations; injection attempts in names, columns and indexes are tested)
- [x] Existing Imam Mobile inventory/customer/sales schema remains compatible. (04e: migration 0009 only adds columns, indexes and a table. The legacy baseline tests pass unchanged, and the compatibility report stays `ok: true`)
- [ ] Searchable, filterable and sortable properties have indexes or a recorded exception. (04d: searchable is enforced and reported through `searchWithoutIndex`. Filterable and sortable flags arrive with Story 05)
- [x] Marking a column searchable without an index on a table over 1,000 rows is refused. (04d: `INDEX_REQUIRED` on property update and on `add_property`; `indexExceptionReason` records an exception)
- [x] Creating or updating one record writes at most 10 rows, including index rows, on the reference dataset. (04e: device create 9, device update 4 to 8, customer create 7, entry create 7. Measured on the test database. A sale is a domain action: 17 cash, 24 credit)
- [x] Every approved data table has an indexed `updated_at` column. (04e: migration 0009; tested for all four tables)
- [ ] Counters stay equal to a full recount after creates, updates and archives, and the rebuild reports drift. (04e: tested after creates, updates, deletes and sales, and the rebuild reports and repairs injected drift. No archive path exists until Story 06, which adds one with `archived_at` and the counter statements)
- [x] The version counter increments in the same batch as the write, and a failed batch changes neither. (04e: every legacy write route, including custom field values; failed batches tested for create, delete and update)

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

- [ ] Currency calculations use integer minor units and explicit currency codes. (04a: stored integers, explicit code and a per-property `scale` are validated. Calculations arrive with Story 06)
- [ ] Multi-select values are normalized and referentially validated. (04a: validation and normalization done. Junction storage is not built yet)
- [ ] Date and timestamp semantics are tested separately, including timezone boundaries. (04a: value validation tested. Filter semantics arrive with Story 05)
- [ ] Relation deletion behavior is explicit and tested. (04a: `onDelete` is configured and validated. Enforcement arrives with Story 06)
- [ ] Property type/operator support is consistent across forms, lists, filters, sorting and import/export. (04a: one registry and a table-driven consistency test. The forms, lists, filters and import/export consumers do not exist yet)

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

**Measured on the dev Worker (2026-11-10, after the seed was installed).** `GET /api/platform/schema-compatibility` for the four data sources read 79 rows and wrote none. Part of that cost is `PRAGMA table_info`, which counts one row per column. Slice 04b must measure its new report the same way and keep it within a stated budget, because the report adds index and capacity queries. The report currently lists `created_by` and `updated_by` as unmapped columns on all four tables; slice 04b decides whether they are system columns (hidden from adoption) or adoptable properties, and records the decision.

### Slice 04a: property contracts and configuration model (2026-11-11)

**Built**
- Migration `0006_property_configuration.sql` adds six columns to `cfg_property`, each with a constant default: `description`, `required`, `default_json`, `searchable`, `sensitivity`, `config_json`. The planned `hidden` and `index_exception_reason` columns are left for slice 04d, where they are first used.
- `config/property-types.ts`: the type registry for 19 types (text, title, number, currency, select, multiSelect, status, date, timestamp, checkbox, email, phone, url, relation, uniqueId, createdTime, lastEditedTime, createdBy, lastEditedBy). Each type declares its storage, accepted SQLite types, writability, operators, sortability, searchability, option use, editor, display and import/export. It also holds option rules, strict configuration validation, value validation and settings validation.
- `config/property-config.ts`: `listProperties` and `updateProperty`. A change is one `db.batch()` with the property row, a new release, the active-release pointer and an audit event.
- Routes: `GET /api/platform/property-types`, `GET /api/platform/properties?dataSource=`, `PATCH /api/platform/properties`. Policy: `schemaInspect` for the two reads, `configurationConfigure` for the update.
- `config/compat.ts` now uses the registry instead of its own type map. A property whose type is stored in a junction table is reported as incompatible with a column.
- Seed package version 2 (`applications/imam-mobile/seed/package.ts`): options for the six select and status columns, currency (PKR, scale 0) for four amount columns, and relation targets for four foreign keys. 14 properties change. No item is added or removed (61 items). No seed ID changes.

**Decisions**
- Option keys equal the strings already stored (`Sold Out`, `In (+)`), so no stored value is rewritten. Keys for options created later come from `newOptionKey`. An option key can never be removed, only deactivated.
- Currency limits (owner answer, 2026-11-10): 0 to 100,000,000 PKR. `devices.purchase_price`, `devices.sale_price` and `sales.total_amount` use min 0 and max 100,000,000. `ledger.amount` uses min 1 and the same maximum. Currency has a per-property `scale`. The existing columns use scale 0. This is recorded in Contracts §3. Owner question 1 is therefore answered.
- Owner question 2 (a schema change publishes a release immediately until Story 07 adds drafts): answered 2026-11-11, acceptable while development stays on track. `PATCH /api/platform/properties` also publishes a release immediately.
- Settings equal to their default are left out of seed values and snapshots, so an unchanged property keeps its old shape and hash.
- Options on select, status and multiSelect, and the target of a relation, are optional. Seed version 1 is installed without them and must still validate. When present they are validated strictly.
- Locked after creation (409 `CONFIG_LOCKED`): currency code, currency scale, relation target once set, multiSelect junction. Setting a relation target that was never set is allowed.
- Optimistic guard: `cfg_release` has `UNIQUE (application_id, version)`. Two changes made from the same release both insert the same next version, so the second batch fails as a whole and nothing is half written. The Worker returns 409 `UPDATE_FAILED`. An optional `releaseVersion` in the request returns 409 `STALE_RELEASE` when it is not the active version.
- Updating with the same values returns `unchanged` and publishes no release.

**Tests**
- Backend: 191 passing in 12 files (was 139 in 10). New: `property-types.test.ts` (33) and `property-config.test.ts` (19).
- `test/fixtures/seed-v1.ts` is a frozen copy of the version 1 package. `catalog.test.ts` and `seed-upgrade.test.ts` use it as the baseline. The route test now expects the real 1 to 2 upgrade (14 updates, 47 unchanged), then 0 updates and 61 unchanged after applying.
- The seed IDs of version 1 and 2 are equal. The golden digest test is unchanged.
- The option keys in the seed equal the CHECK literals in the table SQL for all six option properties.
- A property update is asserted to write at most 10 rows and read at most 100. An unchanged request publishes nothing. A competing release leaves no partial write. A request without a dev-open actor returns 403.
- Frontend build passes.

**Findings for later slices**
- `GET /api/platform/properties` reads one row per property: 111 rows for all data sources and 31 for one. Slice 04b can read from the active snapshot (2 rows) instead.
- `updateProperty` repeats part of the release-publishing code in `seed-upgrade.ts`. Slice 04c adds a third caller, so extract a shared helper there.
- Existing stored values are not checked again when a setting changes. Only new writes are validated. A setting that existing data violates needs the conforming-rows report planned for slice 04d.
- `created_by` and `updated_by` still appear as unmapped columns. Slice 04b decides how to treat them.

**Required on the dev environment before the new Worker is deployed:** apply migration 0006 (`npx wrangler d1 migrations apply imam-mobile-dev-db --remote`), deploy, then call `POST /api/platform/seed/preview` and `POST /api/platform/seed/upgrade`. Expect 14 property updates and release 2.

### Slice 04b: schema inspection and adoption (2026-11-11)

**Built**
- `config/schema-inspect.ts`: `inspectSchema`, `assertNoDrift`, `adoptColumn`, `adoptableTypes`.
- `config/release.ts`: `readActiveRelease` and `releaseStatements`, the shared release publishing that slice 04a noted as duplicated. `updateProperty` and `adoptColumn` use it. Seed install and seed upgrade keep their own code because they also write seed items.
- `config/compat.ts`: `compareTable` (one comparison used by the compatibility report and by inspection), `SYSTEM_COLUMNS`, exported `quote` and `isValidName`.
- Routes: `GET /api/platform/schema?dataSource=<key>` and `POST /api/platform/properties/adopt`. Policy: `schemaInspect` and `configurationConfigure`. The plan named `/api/platform/data-sources/:key/schema`; a query parameter is used instead so the route policy scan keeps matching literal paths.
- The schema report holds columns (type, not-null, primary key, mapped property, system flag), indexes (unique, origin, partial, columns), capacity (100 hard, warning from 80), a row count capped at 1,000 and the adoptable columns with the types each can become.

**Decisions**
- `created_by` and `updated_by` are system columns. They are reported in a new `system` list, are not in `unmapped`, and cannot be adopted (400 `COLUMN_RESERVED`). The schema-compatibility report changed accordingly: devices now shows `unmapped: []` and `system: [created_by, updated_by]`.
- A primary key column cannot be adopted. A column is adoptable only if its name matches the allowlist pattern and at least one writable, column-stored type accepts its SQLite type. BLOB columns and typeless columns have none.
- Adoption is metadata only. It writes the property row, a release, the active-release pointer and an audit event in one batch. It reads no stored values and does not change the table. The key equals the column name and the label is derived from it unless one is given. `nullable` comes from the column's NOT NULL flag.
- Server-assigned types (unique ID, created and edited time and actor) cannot be adopted.
- `SCHEMA_DRIFT` (409): property updates and adoption are refused while a mapped column is missing, a mapped column has an incompatible type, the table is missing or the table is blocked. Nothing is written.
- Row counts use `SELECT COUNT(*) FROM (SELECT 1 FROM t LIMIT 1001)`, so at most 1,001 rows are read, and the report states when the count is capped.
- Existing report decision for owner question 2 still applies: adoption publishes a release immediately.

**Tests and measurements**
- Backend: 207 passing in 13 files (16 new in `schema-inspect.test.ts`).
- Schema report for devices: 80 rows read, 0 written (15 columns, 4 indexes). The report reads one row per column, per index and per indexed column.
- Adoption: 89 rows read and 13 written. The 10-row limit applies to record writes. This is a configuration change: property row and its unique index, release row and its unique index, active-release pointer, audit event.
- Covered: column and system-column lists, bounded row count over 1,000 rows, capacity at 79, 80 and 100 columns, adoption with a label, a currency configuration and a NOT NULL column, refusal of missing, system, primary-key, mapped and incompatible columns, SQL and odd identifiers, unknown fields, stale release, permissions, drift (missing column, incompatible column, missing table), and unchanged behavior for the installed properties.

**For later slices**
- `inspectSchema` reads properties through `loadRows` (about 40 rows). Reading the active snapshot instead is still an option if the budget gets tight.
- Junction tables (multi-select) are still reported as incompatible. They are inspected when multi-select storage is built.
- The Contracts text calls for a recovery path after a failed physical change (unmapped column, then Add as property). That path now exists.

### Slice 04c: schema change service and `add_property` (2026-11-11)

**Built**
- Migration `0007_schema_change_log.sql`: table `schema_change_log` (operation ID as primary key, operation, data source, mode, request hash, parameters, SQL, result, release version, time, actor). Separate from the legacy `schema_changes` table, which stays until Story 07.
- `config/schema-change.ts`: `previewChange`, `applyChange`, `listChanges`. Routes: `POST /api/platform/schema-changes/preview`, `POST /api/platform/schema-changes`, `GET /api/platform/schema-changes?dataSource=`. Policy: `schemaChange` for the two POST routes, `schemaInspect` for the list.
- One operation: `add_property` in `guided_live` mode. Types: text, title, number, currency, select, status, date, timestamp, checkbox, email, phone, url. Relation, multi-select and server-assigned types are refused (`TYPE_UNAVAILABLE`) until later slices.

**Runtime check (plan finding 7, now confirmed on the test runtime)**
`schema-change.test.ts` runs a batch with an `ALTER TABLE`, one valid insert and one failing insert. The failure undoes both: the column is absent and the insert is not kept. Apply therefore uses one batch, so the column, the property, the release, the log row and the audit event exist together or not at all. The recovery path through **Add as property** stays for any case outside this guarantee (tested with an orphan column).

**How it works**
- Preview is read-only. It returns the generated SQL, existing row count (capped at 1,000), the fact that no row is rewritten, capacity before and after (warning from 80), `backupRequired: false`, the next release version and a `planHash`.
- Apply needs `operationId` (8 to 64 letters, digits, underscores, hyphens) and `confirm: true`. An optional `planHash` from the preview is checked, and a mismatch returns 409 `PLAN_CHANGED`.
- Repeating an operation ID with the same request returns the stored result (200, `repeated: true`) and changes nothing. The same ID with a different request returns 409 `OPERATION_ID_REUSED`.
- SQL comes only from validated parameters: identifiers match `^[a-z][a-z0-9_]{0,63}$` and are quoted, the column type comes from a fixed map (TEXT, INTEGER, REAL), and the new column is always nullable with no default or constraint, so existing rows are not rewritten. `required` and `default` are enforced by the property configuration when records are written (Story 06). Unknown fields, including `sql`, are refused at the top level and in `params`.
- Refused with a clear code: reserved column names (`id`, `rowid`, `created_at`, `updated_at`, actor columns), an existing column (`COLUMN_EXISTS`, use Add as property), an existing key (`PROPERTY_EXISTS`), 100 columns (`COLUMN_LIMIT`), drift between configuration and table (`SCHEMA_DRIFT`), and `migration_controlled` (`MODE_UNAVAILABLE`, comes in 04d).
- A failed apply writes an audit event with outcome `failed` and returns 409 `SCHEMA_CHANGE_FAILED`. It writes nothing else.
- If the code is live before migration 0007 reaches the database, apply and list return 503 `MIGRATION_PENDING` and change nothing.

**Decisions**
- Failures are logged in `audit_events`, not in `schema_change_log`, because the log row is part of the transaction that failed.
- New columns are always nullable. Adding a NOT NULL column to an existing table needs a constant default in SQLite, and that default would be a stored value. Making a column required later is a configuration setting now and a data-checking conversion in 04d.
- A schema change publishes a release immediately (owner accepted, 2026-11-11).

**Tests and measurements**
- Backend: 227 passing in 14 files (20 new, all in `schema-change.test.ts`). Frontend build passes.
- Apply: 162 rows read and 17 written. The reads come from loading the whole configuration (`loadRows`) and the table information. Writes: the property row and its index, the release row and its index, the active-release pointer, the log row, the audit event. This is a configuration change, not a record write.
- A repeat with the same operation ID writes at most 2 rows.
- Preview writes 0 rows.

**For later slices**
- `loadRows` dominates the read count. Reading the active snapshot instead would cut it to a few rows, but the snapshot lacks row IDs that the insert needs. Decide in 04d if reads matter.
- `add_property` for relation and multi-select, and the other operations, come in 04d or later.

**Migration:** 0007 adds one table and one index. No existing table changes.

### Slice 04d: remaining operations and `migration_controlled` mode (2026-11-11)

**Built**
- Migration `0008_property_hidden_and_pending_changes.sql`: `cfg_property.hidden` and `cfg_property.index_exception_reason`; `schema_change_log.status` (`applied` or `awaiting_migration`) and `migration_file`. All with constant defaults. (Slice 04e moves to migration 0009.)
- Two new property settings, `hidden` and `indexExceptionReason`, with defaults that are left out of seed values and snapshots like the other settings, so unchanged properties keep their hashes. `hidden` changes only through `hide_property`. `indexExceptionReason` changes through the property update route and is cleared when search is turned off.
- `config/schema-change.ts` now has five operations: `add_property`, `add_index`, `drop_index`, `hide_property`, `convert_presentation`. Two modes: `guided_live` and `migration_controlled`.
- `GET /api/platform/schema` adds `searchWithoutIndex`: searchable properties that no index starts with and that have no recorded exception.
- Apply returns 201 (applied), 202 (`awaiting_migration`) or 200 (a repeat).

**Operations**
- `add_index`: 1 to 3 properties, name `idx_...` (generated, or given). Refused: unique indexes (`UNIQUE_INDEX_UNAVAILABLE`, they need a duplicate check), an existing name or an existing index on the same columns (`INDEX_EXISTS`). Preview warns that every record write now writes one more index row, warns from 6 indexes, and warns that building the index reads the whole table once on a table over 1,000 rows. No release is published, because the snapshot does not change.
- `drop_index`: only indexes that were created, not those of the table definition (`INDEX_PROTECTED`), not unique indexes (`INDEX_ENFORCES_CONSTRAINT`), and not the only index of a searchable property that has no exception (`INDEX_IN_USE`).
- `hide_property`: configuration only. The column and data stay. A required property without a default cannot be hidden (`PROPERTY_REQUIRED`). Publishes a release.
- `convert_presentation`: configuration only. Allowed: between text, title, email, phone and url, and between select and status. Everything else returns `CONVERSION_REWRITES_DATA` (Phase B). Preview checks stored values against the new type: a value is non-conforming when it is invalid or not in the normalized form (for example upper-case email). The report gives the count and up to 20 examples as row ID and reason, without the value, except for option columns where the stored value is shown (option keys are labels, not personal data). For select and status, every existing option key must be kept, and stored values must be option keys. Apply is refused when any value does not fit (`CHANGE_BLOCKED`) or when more than 1,000 values exist, because they cannot all be checked here.
- Index rule: marking a property searchable on a table over 1,000 rows with no index starting at its column and no recorded exception is refused (`INDEX_REQUIRED`). It applies to property updates and to `add_property`.

**`migration_controlled` design**
- The Worker cannot write repository files. Preview returns `migration.fileName` (next number after the highest in `d1_migrations`, then operation, table and name) and `migration.sql` (a header comment and the generated statement).
- First apply (`202`, `awaiting_migration`): records the change in `schema_change_log` with the migration file name and writes an audit event. It changes no table and no configuration.
- The maintainer commits the file under `backend/migrations`. Cloudflare applies it on deploy.
- Second apply with the same operation ID: if the database shows the physical change (column with the same SQLite type, index with the same columns, or index gone), the configuration change, release, log update and audit event are written in one batch (`201`, `applied`). If not, the response is the stored result with a message that the database does not show the change yet (`200`, nothing changed).
- This deviates from the plan sentence "the release records its required migration level, and publish is refused until the database reports it". Because the configuration is published only after the schema is present, a release never describes a schema the database lacks, and the existing drift check covers the rest. A release table column for a migration level would add nothing the check does not already guarantee. If Story 07 needs it for deployment checks, it can be added then.
- The check is on the physical change, not on the file name, so renaming the file or merging migrations in another order does not break it.
- `hide_property` and `convert_presentation` have no physical part and apply at once in either mode.

**Decisions**
- The log holds one row per operation ID. A change moves from `awaiting_migration` to `applied` in place. Reusing an operation ID with another request or another mode returns `OPERATION_ID_REUSED`.
- Operations that would drop or rewrite data (drop column, rename column, change a column's type) are not in the list. They need Phase B.
- `MIGRATION_PENDING` (503) now covers migrations 0007 and 0008: the code can be live a moment before the database has the new table or columns.

**Tests and measurements**
- Backend: 256 passing in 15 files (29 new in `schema-operations.test.ts`; one assertion in `schema-change.test.ts` changed because `migration_controlled` is now accepted).
- Covered: each operation in both modes, preview without writes, plan hash, repeat and reuse of operation IDs, refusals for every error code above, injection attempts, hidden in the snapshot only while true, conversion reports that never contain values of text columns, the 1,000-row limit for conversions and for the index rule, the full migration_controlled sequence including a column with the right name but the wrong type, and that nothing changes before the migration exists.
- Measured: `add_index` apply writes 9 rows. `hide_property` apply writes 13 rows (property, release and indexes, active-release pointer, log row, audit event). These are configuration changes, not record writes. `convert_presentation` preview on a table over 1,000 rows reads about 2,100 rows (a bounded count and a bounded value check, up to 1,001 each).

**Gate for TIMELINE step 7:** met. Add-property works in both modes with preview and log.

**For later slices**
- Unique indexes need a duplicate check. Relation and multi-select `add_property` need more than one column or a junction table.
- A conversion check over more than 1,000 values needs batched validation (Phase B).
- Filterable and sortable flags arrive with Story 05. The index rule then covers them too.
- `loadRows` still dominates the read count of an apply (see 04c).

**Migration:** 0008 adds four columns. No existing data changes.

### Slice 04e: storage rules, counters and versions (2026-11-12)

**Built**
- Migration `0009_storage_rules_counters.sql`:
  - `updated_at` (nullable, filled from `created_at`) on `sales` and `customer_entries`.
  - `archived_at` (nullable) on `mobile_devices` and `customers`.
  - Indexes on `updated_at` for all four tables.
  - Table `data_source_counters` (`WITHOUT ROWID`, so a new counter key writes one row, not two), filled with the actual counts at migration time.
- `platform/counters.ts`: counter definitions in code (devices: total and one counter per status; customers, ledger and sales: total), statement builders (`countersOnCreate`, `countersOnDelete`, `countersOnGroupChange`), `versionBump`, `listCounters`, `rebuildCounters`, `counterTotal`.
- Legacy routes in `src/index.js`: every create, update and delete of devices, customers and customer entries, the sale, and custom field values now run as one `db.batch()` with the counter statements and the data source version bump. `updated_at` is set on every write. Counter statements that read the current row (delete, status change) come before the write in the batch.
- The sale route is now one batch. Before, the sale row was written first and the rest in a second step, so a failure in the second step left a sale without items. The sale ID comes from the first statement's result.
- Routes: `GET /api/platform/counters?dataSource=` and `POST /api/platform/counters/rebuild` (`{ dataSource?, apply? }`, a report by default, repair only with `apply: true`, one audit event). Policy: `schemaInspect` and `configurationConfigure`.
- The schema report takes `rowCount` from the counter (`source: "counter"`, one row read) and falls back to the bounded count when there is none.
- Seed package version 3: four property items for the new columns (`devices.archived_at`, `customers.archived_at`, `ledger.updated_at`, `sales.updated_at`). 61 items become 65. After the upgrade every column of the four tables is mapped.

**Decisions**
- A counter key is `total` or `<column>=<value>`. Only devices have a group counter (status), because the plan names status as the one KPI counter now. Stories 05 and 06 add definitions as screens need them.
- Counters have no CHECK for non-negative values. A counter bug must not stop a business write. The rebuild reports it instead.
- The legacy DELETE routes stay physical deletes (pinned by baseline tests) until Story 06, but they now update counters and versions, so counters stay correct. Archive and cancellation come with Story 06. This is why the archive part of the counter box stays open.
- Recording the domain-action budget: a sale writes 17 rows (cash) or 24 rows (credit), above the 15 in Contracts §9. The causes are rows the stories require: the `updated_at` index on each table, counters, and the version row. §9 now says 30 for a domain action, and the 100,000 rows a day design limit leaves room for thousands of sales. Record writes (create or update of one record) stay at 10 or fewer. Re-measure with Story 06.
- Rebuild reads each table once (about one row per record). It is an administrator action, not part of normal requests.

**Tests and measurements**
- Backend: 278 passing in 17 files (20 new in `counters.test.ts`, 2 in `seed-v3.test.ts`; seed version 2 is frozen in `test/fixtures/seed-v2.ts`; older upgrade tests now expect version 3). Frontend build passes. The legacy baseline tests for the changed routes pass unchanged.
- Rows written (test database): device create 9, device update 4 to 8 (6 when the IMEI changes, 8 with a status change), customer create 7, entry create 7, cash sale 17, credit sale 24. Counter list: at most 3 rows read. Schema report row count: one counter row.
- Covered: `updated_at` and its index on all four tables, `archived_at` columns, `updated_at` set on every write, counters after creates, status changes, deletes, sales and a mixed sequence (equal to a full recount), exact version increments for each route, failed batches (duplicate IMEI, delete with a sale, rejected status, missing customer) leaving record, counters and version unchanged, not-found writes changing no counter, drift injected three ways (wrong value, missing key, stale key) reported and repaired with an audit event, permissions.

**Before the Worker with this slice runs on dev**
- Migration 0009 must be applied first. If the new code is live without it, the create, update, delete and sale routes fail, because the counters table and the `updated_at` columns are missing. Check with: `npx wrangler d1 execute imam-mobile-dev-db --remote --command "SELECT name FROM d1_migrations ORDER BY id"` (expect `0009_storage_rules_counters.sql`). Then call the seed upgrade: `POST /api/platform/seed/preview` (expect version 3, add 4) and `POST /api/platform/seed/upgrade` with the `planHash`.

### Slice 04f: migration process, tests, legacy inventory and story review (2026-11-12)

**Built**
- `docs/platform/MIGRATIONS.md`: when a change is a platform schema change and when it is a developer migration, file naming and ordering rules, a checklist for a new table or column (seed version, counter definition, version row, `updated_at` index), the order of events on deploy, and rollback by forward fix. Linked from the platform README.
- `backend/test/migrations-process.test.ts` (5 tests): migration names match `NNNN_snake_case.sql`, numbers are unique, ordered and without gaps, every seed data source maps to an existing, non-blocked table with no table mapped twice, and every such table has `updated_at` with an index.
- `docs/platform/legacy-inventory.md`: the schema routes, the custom field routes, `schema_changes` and `custom_field_values` are now removed in Story 07, not Story 04. Reason: the Admin Studio screen calls them and Story 07 replaces that screen. The schema service is complete, so nothing in Story 04 depends on removing them.

**Decision:** keep the legacy admin schema routes until Story 07. The risk is that live DDL can still be run through `/api/admin/schema/*` with the shared token, without preview or the 100-column limit. It was already the case before Story 04, requires `ADMIN_CONFIG_TOKEN`, and dev holds test data only. A column added that way shows as unmapped in the compatibility report and can be adopted.

**Dev database check (2026-11-12, from the owner):** `d1_migrations` lists 0001 to 0009, and `POST /api/platform/counters/rebuild` reports every data source `ok: true` with no drift (1 device, 1 customer, 3 ledger entries, 0 sales). The seed upgrade to version 3 was not confirmed yet.

#### Story review

Backend: 283 tests passing in 18 files. Frontend build passes.

Acceptance boxes checked: type contracts, metadata cannot expose absent columns, adoption, no arbitrary DDL, add property in both modes, operation ID idempotency, failed change recovery, 100-column limit, option editing, presentation conversions and the refusal of data-rewriting conversions, bound parameters, legacy schema compatibility, the `INDEX_REQUIRED` rule, record write budget, `updated_at` indexes, version counter in the write batch.

Deferred boxes, each with the story that closes it:

| Box | Reason | Closed by |
|---|---|---|
| Every data source maps to an approved table; every non-virtual property maps to a real column; drift detected before publish and deployment | The checks run on every change through the platform services. Publish and deployment checks need the publish flow | Story 07 |
| Searchable, filterable and sortable properties have indexes or an exception | Searchable is enforced. Filter and sort flags do not exist yet | Story 05 |
| Counters equal a recount after creates, updates and archives | Tested for creates, updates, deletes and sales. No archive path exists | Story 06 |
| Currency calculations in integer units | Calculations do not exist yet | Story 06 |
| Multi-select normalized and referentially validated | Validation done, junction storage not built | Story 06 |
| Date and timestamp semantics including timezone boundaries | Value validation tested, filter semantics not built | Story 05 |
| Relation deletion behavior enforced | Configured and validated, enforcement not built | Story 06 |
| Type and operator support consistent across forms, lists, filters, sorting, import and export | One registry and a consistency test exist, consumers do not | Stories 05, 06, 09 |
| Scope item 13: archive and cancellation instead of physical delete | Legacy DELETE routes are pinned by baseline tests | Story 06 |

Risks:
1. A Worker deploy that lands before its migration breaks writes. Mitigation: migrations are additive and the process doc states the order. Dev holds test data only.
2. Schema changes publish a release immediately until Story 07 adds drafts (owner accepted this on 2026-11-11).
3. The legacy admin schema routes remain (decision above).
4. Counters have no non-negative check. Drift is reported by the rebuild, which reads the whole table. It is an administrator action.
5. Domain-action write budget is 30 (was 15). Re-measure in Story 06, which changes the sale route.
6. Measurements were taken on the test database, not on a reference dataset of realistic size. Repeat with Story 05 and Story 10.
