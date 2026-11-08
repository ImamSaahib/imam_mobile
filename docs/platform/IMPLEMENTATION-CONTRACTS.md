# Implementation Contracts — Version 1

**Status:** Normative implementation guidance for Stories 01–10.

This document makes the architecture's extension, seed, property-type, reuse-test, maintenance and CI expectations implementable. If a story conflicts with this document, update both in the same reviewed change.

## 1. Client extension registration and build contract

### First-release boundary

Extensions are trusted code compiled and deployed with the client's Worker. They are not downloaded or executed dynamically at runtime. There is no marketplace, arbitrary plugin upload, eval, runtime module loading, or extension-provided SQL.

Use a static registration entry point:
- Shared interfaces: backend/src/platform/extensions/contracts.ts.
- Client-owned implementations: backend/src/extensions/.
- Client registration entry point: backend/src/extensions/index.ts.
- Worker startup imports the registration entry point and registers implementations with the platform registry.
- Routes and generic CRUD code must not import individual client implementations.

The exact folders may be adjusted after inspecting the existing backend, but static registration and separation are mandatory.

### Domain action interface

Each action implementation must satisfy a typed interface equivalent to:

    type ActionContext = {
      db: D1Database;
      actor: { id: string; permissions: string[] };
      requestId: string;
      idempotencyKey?: string;
    };

    type ActionDefinition<Input, Output> = {
      key: string;
      version: number;
      inputSchema: JsonSchema;
      outputSchema: JsonSchema;
      requiredPermission: string;
      minimumPlatformVersion: string;
      execute(input: Input, context: ActionContext): Promise<Output>;
    };

Use the repository's actual D1 and schema-validation types; do not add a dependency solely to copy this illustrative type. The platform validates input before execution and validates output in tests. The action implementation must not trust client-supplied actor, permission, database binding or request identity.

The registry rejects duplicate keys/versions and exposes registered action metadata to configuration validation. Each action defines:
- stable namespaced key, such as inventory.sell-device;
- positive integer implementation version;
- input and output schemas;
- required permission;
- minimum platform/API version;
- transaction and idempotency policy;
- audit event policy;
- documented error codes and retryability.

The dispatcher authorizes before execution. It creates/uses an idempotency record for non-repeatable operations and executes related D1 writes atomically where supported. A failed action must not be reported as successful. Never automatically retry a non-idempotent action.

### Dependencies and compatibility

- Extensions may import documented public platform contracts, explicitly public shared utilities, and their own client extension modules.
- Extensions must not import private internal modules or mutate platform registries directly.
- Every extension declares its version and supported platform/API range.
- Configuration references actions only by registered key and compatible version.
- Missing, duplicate or incompatible registrations fail validation clearly.
- Tests register extensions through the same entry point used by Worker startup.
- Client-only actions stay in the client fork. Generally reusable actions may be proposed upstream.
- Custom component renderers, if required, follow the same static registration and public-contract principle. Metadata cannot contain component source.

## 2. Seed ownership and upgrade conflict contract

### Stable ownership identity

Every seed-managed configuration item has a stable item ID, owning package ID, stable seed key, ownership state (seed_managed or client_owned), last applied upstream version, last applied baseline value/hash, and current local value. Seed keys are independent of labels. Business records are never seed-managed.

### Initial installation and upgrades

Initial installation inserts missing seed items and fails on ambiguous identity collisions. Re-running the same package is idempotent.

An upgrade performs a three-way comparison: previous upstream baseline, new upstream baseline, and current installed value.

- If current value still equals the previous baseline, apply the upstream change.
- If upstream did not change the item, preserve the current value.
- If both upstream and client changed the same item, mark a conflict and leave the installed value unchanged.
- If the client explicitly owns an item, upstream does not overwrite it.
- Deleted upstream items are marked deprecated/orphaned first; do not hard-delete an item referenced by client configuration or data.
- Resetting an item to the upstream default is an explicit action after preview.

Upgrade preview reports additions, updates, unchanged items, client-owned items, conflicts, deprecated items and incompatible references. It shows old and proposed values without exposing secrets.

Applying an upgrade requires a validated plan. Conflicts are resolved individually by choosing upstream, retaining client value, or editing a merged value. Record resolution and actor in the audit trail. Apply transactionally where practical; partial failure must be detectable and safe to retry.

Never overwrite business records, credentials, secrets, client extensions or client-owned configuration during seed upgrade.

## 3. Property type and storage contract

All values are validated on the Worker. SQLite affinity alone is not validation. Physical constraints should reinforce rules where practical.

| Property | Storage | Validation and behavior |
|---|---|---|
| text/title | TEXT | UTF-8 string; configured maximum length; title is a presentation/required variant |
| number | INTEGER for whole values; REAL only for explicitly fractional values | finite value; range/precision rules; reject NaN/infinity; display format (plain, separators, percent) is configuration only and does not change storage |
| currency | INTEGER minor units plus ISO 4217 currency code | never use floating-point arithmetic for money; locale-aware display |
| select | TEXT stable option key | must match an active configured option; labels may change |
| multi-select | normalized junction rows keyed by record and option | validate every option; deduplicate; never store comma-separated values |
| date | TEXT YYYY-MM-DD | calendar-valid date without time-zone conversion |
| timestamp | TEXT UTC ISO-8601 | parse and normalize to UTC; display in user/application locale |
| checkbox | INTEGER constrained to 0 or 1 | API accepts boolean; database stores 0/1 |
| email/phone/URL | TEXT | normalized string plus format/length validation; no claim of external deliverability |
| relation | foreign-key ID using target key's declared storage type | target and record must exist and be readable; delete behavior explicit |
| status | TEXT stable option key; option groups (to-do, in-progress, complete) in metadata | must match an active option; each option belongs to exactly one group; a default option is defined |
| unique ID | INTEGER assigned by the server; optional text prefix in metadata | server-assigned, unique, never reused, not writable; the number is allocated atomically in the same batch as the insert |
| system actor/timestamps | stable actor ID and UTC timestamp | server-managed; clients cannot mass-assign |

Currency requires a currency code at property or record level. Preserve exact minor-unit storage and reject unsafe integer overflow. Display whole rupees where a business UI requires it, without changing stored precision.

Every property declares supported filter/sort/search operators, nullability, required/unique behavior, limits, default policy, sensitivity and writability. Indexes are added through migrations based on measured query needs. Relation deletion defaults to RESTRICT; cascading business-record deletion is not implicit.

Virtual/computed properties are read-only and implemented by reviewed server code with an explicit output type. Formula strings and SQL expressions in metadata are prohibited.

## 4. Measurable second-application reuse test

The second application must be a distinct operational application with its own seed package, data tables and workflows, not a renamed Imam Mobile.

Acceptance evidence must show:
1. Same platform runtime and shared component registry.
2. Separate application identity, navigation, data-source/property metadata, forms and views supplied through a seed/configuration package.
3. Standard list, search, filters, forms and ordinary CRUD work without shared-core edits.
4. At least one application-specific business operation uses the documented extension interface, not a patch to generic CRUD/list/form code.
5. A clean development database can be migrated and seeded from scratch.
6. Reapplying the seed does not duplicate metadata or alter business records.
7. Authorization, schema compatibility and core workflow tests pass.
8. No shared-core changes are needed for ordinary application setup.

Record configuration-only files changed, extension files changed, shared-core files changed (target: zero for ordinary setup), migrations added, tests/deployment result, implementation time and blockers requiring platform changes.

Run a minimal early slice after Story 04 ([Decisions D12](DECISIONS.md)): seed a small, distinct second application with its own identity, one separate relational table, a data source, typed properties, a basic page and one list and one form from configuration, with no shared-core edits. This exposes metadata-model assumptions before the full CRUD and view surface is built; it is not the final reuse proof. If it fails, stop and revise the metadata design. Then build the smallest meaningful full proof after Stories 01–06. Use evidence to decide whether Story 08 needs expansion and whether the edit-mode contract (§7) needs changes.

Build the full measurable proof after Stories 01–06. Use evidence to decide whether Stories 07–08 need expansion.

## 5. Initial upstream maintenance policy

Support the latest tagged stable baseline as the primary supported line. Publish release notes, migration notes, compatibility requirements and known risks for each tag. Security or critical correctness fixes target the latest stable release; backports to older tags are not promised unless announced.

Clients may defer updates, but their fork is unverified until they review upstream changes, resolve source/seed conflicts, apply migrations in their development environment, pass build/authorization/schema/business regression tests, and record deployed baseline and extension versions.

Do not promise automatic conflict-free merges, an SLA, indefinite support for old versions, or automatic production updates. Client production promotion requires explicit client approval. Revisit this policy when actual external clients and support capacity exist.

## 6. Continuous integration contract

Shared baseline CI validates pull requests targeting development and pushes to development. Production branch main is not a development target; production deployment is a separate approval-controlled workflow.

Minimum CI gates:
- frontend dependency install and production build;
- Worker type-check/build or syntax check matching the actual backend toolchain;
- unit tests for changed platform services;
- migration from an empty test database;
- seed idempotency and schema compatibility tests;
- API authorization and sensitive-field tests;
- core Imam Mobile regression tests once the harness exists;
- secret scan and explicit environment-target safety check for deployment jobs.

Do not claim a check is covered until its command exists and runs. Add checks incrementally with each story. Commit lockfiles and use npm ci for reproducible CI once a lockfile is present. Until then, record the missing lockfile as a CI gap and do not use npm ci prematurely.

CI must not deploy or migrate production. Development deployment is separate and uses explicit dev resource configuration without production credentials.

## 7. Edit-mode and configure-menu contract

**Status:** Normative for Stories 00, 03, 05 and 07.

Every configurable element type (navigator menu, module, component type, property type, view, form) registers a descriptor through the same static registration used for components:

    type ConfigurableDescriptor = {
      key: string;                    // stable type key, for example component.table
      schemaVersion: number;
      configSchema: JsonSchema;       // validated on the Worker, not only in the browser
      configurePanel: PanelRef;       // registered panel implementation
      contextActions: Array<{
        key: string;                  // configure | duplicate | move | disable | remove | registered custom key
        label: string;
        requiredPermission: string;   // enforced in the security phase
        changesSchema: boolean;       // true routes through the schema change service
      }>;
    };

Use the repository's actual types. Rules:

- The shell owns the context menu. Elements supply descriptors and never render their own right-click menus, so mouse, keyboard and touch behave the same.
- Configure panels read and write the draft only through the configuration service. They never write to data tables.
- Actions with `changesSchema: true` call the schema change service only.
- Draft content is served through a different request path from published content, and normal users cannot request it once authorization exists.
- Edit mode is user-interface state. It grants nothing on the server.
- A configuration that references a descriptor version that is not deployed fails validation.
- Keyboard and touch alternatives are tested for every context action.

## 8. Schema change service contract

**Status:** Normative for Stories 04 and 07.

### Operations

A closed list: `add_property`, `add_index`, `drop_index`, `convert_presentation`, `hide_property`, and, in a later phase, `convert_data` and `drop_property` (which requires a backup). Anything else is rejected. The service builds SQL from validated parameters. Identifiers come from an allowlist and are quoted, and values are bound. No operation accepts SQL text.

### Request and preview

Each request carries a client-generated operation ID, the data source, the property, the operation and its parameters. Before applying, the service returns a preview: the generated SQL (read-only), affected row counts, rows that fail validation, remaining column capacity (limit 100 per table), and whether a backup step is required. Applying requires the operation ID and an explicit confirmation flag.

### Log

A `schema_change_log` table records operation ID, data source, property, operation, parameters, SQL hash, status (`previewed`, `applied`, `failed`, `blocked`), actor, timestamps and error text. Operation IDs are unique, so repeating a request is idempotent.

### Ordering and failure

1. Validate and preview.
2. Take the pre-change safeguard when required (export or D1 Time Travel bookmark).
3. Apply the physical change.
4. Update metadata in the draft.
5. Record the log entry.

If step 3 succeeds and step 4 fails, the column exists without a property. The next schema inspection reports it as an unmapped column and offers **Add as property**. The service never reports success for a failed step.

### Modes

- `guided_live`: preview, then apply on confirmation.
- `migration_controlled`: preview, then write a migration file and metadata change for review. Applying is a deployment step. A release in this mode records its required migration level, and publishing is refused until the target database reports that level.

### Limits

Columns per table (100), statement size (100 KB), bound parameters (100) and per-invocation query count are checked before applying. Chunked data conversion stays within D1 limits per statement. See [D1 limits](https://developers.cloudflare.com/d1/platform/limits).

### Tests

Idempotent repeat; preview equals applied SQL; failed apply leaves metadata unchanged; column limit refused; unmapped column adoption after partial failure; no operation accepts raw SQL; runs against an empty database and an existing database.

## 9. Resource budget contract

**Status:** Normative for Stories 00, 01, 04, 05, 06, 07 and 10. All numbers are starting values. Re-measure them with real Imam Mobile data and update this section.

### Target environment

A local business with about 5 users and about 100 sessions a day, on Cloudflare's free plan. Design against these limits, which are lower than the plan's published figures, so there is headroom:

| Resource | Design limit | Notes |
|---|---|---|
| D1 rows read per day | 1,000,000 | Cloudflare's free plan documents 5,000,000. Reads count rows scanned, not rows returned. |
| D1 rows written per day | 100,000 | A write to an indexed column also counts one row per index. |
| Database storage | 500 MB | |
| Worker requests per day | 100,000 | |
| Worker CPU per request | 10 ms | Do not validate the whole configuration on every request; validate at publish. |

Daily limits reset at 00:00 UTC.

### Reference dataset (assumption)

5,000 devices, 2,000 customers and 5,000 sales. Devices grow by about 10 a day, so 5,000 is about 17 months of data; a growth test at 20,000 devices (about 5.5 years) must also stay within budget. Customer and sales counts are assumptions until real counts are known. Budgets and tests use this dataset.

### Per-operation budgets

Rows read and written are taken from the D1 result metadata (verify the exact field names in Story 01).

| Operation | Rows read | Rows written |
|---|---|---|
| Bootstrap (shell and active configuration) | ≤ 5 | 0 |
| List page load (default page size 25) | ≤ 50 | 0 |
| Search request | ≤ 500 on the reference dataset | 0 |
| Record open | ≤ 10 | 0 |
| Create or update one record | ≤ 10 | ≤ 10, including index and audit rows |
| Domain action such as a sale | ≤ 30 | ≤ 15 |

A query on a table of more than 1,000 rows that scans the table must be listed as an exception with a reason.

### Session model

One session is 1 bootstrap, 10 list loads, 5 searches, 3 record opens and 2 writes. That is about 3,000 rows read and about 20 written. The target is at most 5,000 rows read per session and 200 written per day per user. Across 100 sessions that is at most 500,000 reads, half the design limit.

### Design rules

1. **Configuration is read as one snapshot.** The runtime reads the active published release as a single stored snapshot with a version identifier. It does not read normalized configuration rows per request. Drafts are read only in configure mode.
2. **Indexes.** Every property that is searchable, filterable or sortable declares an index. The schema change service refuses to mark a column searchable on a table over 1,000 rows without an index, unless the property is flagged as an exception.
3. **Search.** Minimum 2 characters before a query runs, debounce, prefix search on indexed columns by default. Contains-search (`LIKE '%x%'`) is allowed only on small tables or flagged properties. Verify whether D1 supports full-text search before using it.
4. **Totals.** Unfiltered totals and KPI counts come from maintained counters (§10). A filtered total counts at most 1,001 rows and shows "1,000+" beyond that.
5. **Aggregates.** Footer calculations and counts run on request or on a bounded schedule, not on every page load, and use the same row cap.
6. **Retention.** Keep the last 20 release snapshots; older ones are archived or removed after confirmation. Audit events have a retention period and a maximum row count, and an export before removal.
7. **Limit reached.** The resource governor (§10) lowers usage before a limit is reached. If D1 still reports the daily limit, the API returns the error code `DAILY_LIMIT_REACHED` and the interface shows a clear message with the reset time. The application never shows a blank or partial page or a raw error.
8. **Frontend weight.** Initial JavaScript at most 300 KB gzipped and at most 10 requests on first load. These are starting values; measure after the Story 00 component choices.

### Measurement and tests

- A test helper records rows read and written for each request in development and in tests.
- CI runs the reference workflows on the reference dataset and fails when an operation exceeds its budget.
- A simulated day of 100 sessions must stay at or below 500,000 rows read and 20,000 rows written.
- Report the measured figures in each story's evidence.

## 10. Resource-aware data access contract

**Status:** Normative for Stories 01, 04, 05, 06, 07 and 11. It extends §9. The goal is to use so little of the daily limits that they are not reached, and to switch to cheaper behavior before they are, so users do not see limit errors. Numbers are starting values to re-measure.

### 10.1 Caching layers

1. **Browser.** Static files are cached by the service worker with content-hashed names. API responses are never cached by the service worker.
2. **Worker memory.** The active release snapshot is held in the Worker's memory for at most 60 seconds. Each request carries the release version the browser has; if it matches, the response is "unchanged" and costs at most one row read.
3. **Cache API (optional).** May be used for non-user-specific responses. It is per data center, is not available for Workers behind Cloudflare Access, and may not work on `workers.dev` domains. Nothing may depend on it. Do not add Workers KV or other products for caching.

### 10.2 Version counters and conditional requests

Each data source has a version number in a `data_source_versions` table, incremented in the same `batch()` as every write to that data source. Read endpoints return an `ETag` made of the release version and the data source version. A request with a matching `If-None-Match` returns 304 and reads one row.

### 10.3 Pagination

Use keyset pagination: the cursor is the sort values plus the primary key of the last row. Do not use `OFFSET`, because it scans the skipped rows and cost grows with page number. The interface offers first, previous, next and last (last is a reversed query). Jumping to an arbitrary page number is not supported. The current page number is derived from the cursor trail and is approximate.

### 10.4 Counters

A `data_source_counters` table holds registered counters (a data source key, a counter key such as `status=Available`, a value). They are updated in the same `batch()` as the business write, so they stay consistent. They provide unfiltered totals, "Showing x–y of z" totals, and KPI counts at the cost of one row read. A rebuild operation recomputes a counter from the table and reports drift. Counter definitions are registered in code, not in configuration.

### 10.5 Query shape

- Select only the columns a view shows.
- Indexed prefix search by default. For large text tables, use an FTS5 virtual table, which D1 supports. Triggers are not confirmed on D1, so the FTS table is updated by code in the same `batch()` as the write.
- Reads run through the query compiler; unbounded scans are refused unless listed as exceptions (§9).

### 10.6 Interface discipline

No polling and no background refresh. Refresh is manual. When the tab regains focus, the app does one version check. Search waits for 2 characters, debounces and cancels stale requests. Configure-mode drafts save changed items only, after a pause of at least 2 seconds, never per keystroke.

### 10.7 Resource governor

The Worker adds up `rows_read` and `rows_written` from the metadata of every D1 result. Each Worker instance flushes its total to a `usage_daily` row (UTC day, rows read, rows written) at most every 5 minutes and only when it changed. Because instances do not share memory, the estimate can be low, so thresholds are conservative.

| State | Trigger (estimated share of the daily budget) | Behavior |
|---|---|---|
| Normal | below 70% | Everything works. |
| Conserve | 70% to 90% | Lengthen cache times, pause footer calculations and automatic version checks, restrict search to indexed prefix, keep all create, update and action routes working. |
| Essential | above 90% | Serve lists from cache, allow only core actions (such as sales and payments), show a discreet banner that some information may be a few minutes old. |
| Limit | D1 reports the daily limit | One calm message with the reset time (00:00 UTC). Cached data stays readable. Financial writes are not queued for later. |

Rules:

- The state is returned in the bootstrap response and in the health check, and the interface shows a banner only in Essential and Limit.
- A per-client request rate limit stops a runaway client loop from consuming the budget.
- The Limit state ends at 00:00 UTC, or when a D1 request succeeds again.
- User-facing text never contains a raw error, a status code or a mention of D1.

### 10.8 Optional local copy of small tables (deferred)

Keeping tables under about 2,000 rows in the browser, with incremental sync by `updated_at` and tombstones for deleted rows, would make search and filters cost no reads. Build it only if measurement shows daily reads above 30% of the budget after §10.1–10.7. At about 10 new devices a day, the devices table passes 2,000 rows in about 200 days, so a local copy would not cover the main table, which supports keeping it deferred. It needs a second query engine in JavaScript that behaves exactly like the server one, tests for parity, per-role exclusion of sensitive fields from synced data (Story 11), and clearing the local copy on sign-out and on shared devices.

### 10.9 Tests

- Version counter increments in the same batch as the write, and a failed batch changes neither.
- A matching `If-None-Match` reads one row.
- Keyset pagination returns each row exactly once and reads no skipped rows.
- Counters match a full recount after a sequence of creates, updates and archives; the rebuild operation reports drift.
- The governor changes state at the thresholds, and returns to Normal after the daily reset.
- Simulated day: 100 sessions stay within the budgets in §9, and the governor stays in Normal.
- Forced Limit state: the interface shows the message, lists stay readable from cache, and no raw error is displayed.
- A looping client is rate limited without affecting other clients.

## 11. UI/UX MVP and security release gate

The UI/UX and reusable-runtime MVP establishes the design system, metadata-driven shell, page/component registry, early edit-mode/inspector interaction, typed property model, basic list/search and standard forms/CRUD. Authentication and authorization are implemented after this UI/UX phase in Story 11. The application must not be used with real multi-user business data or promoted to production before Story 11's authentication, authorization and sensitive-field tests pass. Development-only policy stubs must be clearly marked and must not be mistaken for security.
