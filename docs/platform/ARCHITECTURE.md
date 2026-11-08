# Architecture — Forkable Configurable Business Application Baseline

**Status:** Proposed target architecture for development  
**Repository:** `ImamSaahib/imam_mobile`  
**Distribution:** Client-owned GitHub fork + client-owned Cloudflare deployment  
**Runtime:** React/Vite, Cloudflare Worker API, Cloudflare D1 (SQLite)  
**Interface:** [UI Reference](UI-REFERENCE.md)  
**Decisions:** [Decisions Record](DECISIONS.md)

## 1. Product boundary and success test

The product is a reusable baseline for **related, small-to-medium internal operations applications with conventional relational data and a known set of workflows**. It is not a universal no-code platform, full ServiceNow replacement, multi-tenant SaaS or arbitrary scripting environment.

Imam Mobile is the first reference application. The architecture is successful only when a second, distinct application can be created with the same runtime and shared components primarily through configuration.

The platform supports common CRUD workflows. Business-specific behavior such as selling stock, posting ledger entries, approvals or integrations belongs in explicit domain services.

### Direction

The product is an environment for building, customizing and extending modules, not one business application. It is a lightweight counterpart to the ServiceNow platform, at Notion's level of simplicity, with a Cloudflare-style interface:

- **ServiceNow** supplies the framework: application menus containing modules, pages built from components, lists, forms and a configuration mode.
- **Notion** supplies the data interaction: typed properties, table views with filters, sorts and groups, and property configuration.
- **Cloudflare** supplies the look: the layout, components and spacing defined in [UI Reference](UI-REFERENCE.md).

People with the right permission build modules inside the running application. The configuration they create is stored as metadata and published as releases (§12). Imam Mobile is the first application built this way.

## 2. Distribution and ownership model

### 2.1 Fork-and-deploy

1. The baseline maintainer owns an upstream repository.
2. A client forks that repository into a GitHub account or organization they control.
3. The client connects their fork to their own Cloudflare account.
4. Their Pages project, Worker, D1 database, secrets, custom domains and deployment credentials belong to that client.
5. Client configuration and optional extensions live in the client fork, separated from shared core code.
6. Clients merge or cherry-pick upstream baseline releases on their own schedule.

Each client deployment is independent. The initial model is **one application instance per fork/deployment with its own D1 database**. Do not introduce shared-hosting, cross-client tenancy or cross-client data access without a concrete requirement.

A client may have separate development and production environments. Those environments use separate resource names, database IDs, secrets and deployment settings.

### 2.2 Ownership boundaries

| Asset | Owner |
|---|---|
| Upstream baseline repository and tagged releases | Baseline maintainer |
| Client fork and client-specific commits | Client |
| Client Cloudflare account and resources | Client |
| Client data and backups | Client |
| Client credentials and secrets | Client |
| Maintenance/support arrangements | Defined separately with client |

A fork is a copy of source code, not a transfer of ownership of the upstream repository. Licensing, support, maintenance and data responsibilities must be defined separately.

## 3. Deployment configuration contract

Client-specific resource names must not be scattered through source code. Provide an editable, non-secret deployment manifest before the first Cloudflare build.

Proposed location: `deployment/client.config.json`.

Illustrative structure:

```json
{
  "client": { "name": "Client Name", "slug": "client-name" },
  "cloudflare": {
    "pages_project": "client-name",
    "worker_name": "client-name-api",
    "database_name": "client-name-db",
    "database_id": "SET_AFTER_D1_CREATION"
  },
  "application": {
    "name": "Client Business",
    "slug": "client-business",
    "default_locale": "en",
    "theme": "light"
  }
}
```

This file contains identifiers and defaults only. It must never contain Cloudflare API tokens, passwords, signing keys or other secrets. The D1 ID is obtained after the client creates the database and is then entered into the manifest/binding configuration.

The deployment preparation process validates required fields, slug/resource formats, Pages/Worker/D1 agreement, frontend API target, allowed origins, and selected environment. It must warn if a development deployment points at production resources.

The manifest is the source for generating or validating Wrangler and frontend environment configuration. If provider configuration requires generated files, document which file is authoritative and how it is regenerated. Avoid duplicate independent copies of resource names.

### 3.1 Cloudflare resource responsibilities

- Pages project name is selected when the Pages project is created/connected.
- Worker name is defined in Worker deployment configuration.
- D1 database name is selected when created; its ID is used in the Worker D1 binding.
- Frontend public configuration (API base URL and non-secret branding) may be supplied at build time.
- Secrets and credentials are set as Cloudflare Worker secrets/environment settings.
- Migrations are applied to the explicitly selected database before deploying code that requires the new schema.

Editing a manifest does not rename an already-created Cloudflare resource. Resource creation/renaming and runtime configuration are separate operations.

## 4. Runtime architecture

```
Client browser
  React + Vite
    - platform shell and navigator
    - page/component registry
    - list, form and report renderers
    - configuration interface
          | HTTPS JSON API
          v
Client-owned Cloudflare Worker
    - authentication and authorization
    - metadata/configuration services
    - schema compatibility checks
    - safe query compiler and record services
    - registered domain action dispatcher
    - audit and publish services
          | D1 binding
          v
Client-owned Cloudflare D1
    - platform metadata
    - application-specific relational tables
    - migration/version records
    - audit events
```

The browser never connects directly to D1. The Worker validates and authorizes every operation. Keep one modular Worker initially; do not create one Worker per module or business feature.

## 5. Application structure and metadata

```
Deployment / Application Instance
├── Application
│   ├── Menus -> Modules (stable route + page)
│   ├── Pages -> Registered component instances
│   ├── Data sources -> Properties and relations
│   └── Saved views and forms
├── Configuration drafts and releases
├── Domain action registrations
└── Audit events
```

- **Deployment/application instance:** one client-owned installed copy of the baseline.
- **Application:** a named product area inside that installation.
- **Menu:** ordered collection of modules in the navigator.
- **Module:** stable navigable route/page, not a database table.
- **Page:** composition of registered components and layout metadata.
- **Component:** fixed, typed renderer with versioned configuration schema.
- **Data source:** logical reference to an approved physical D1 table or approved server query.
- **Property:** metadata for a physical column or explicitly supported virtual property.
- **View:** saved presentation/query definition over records; it does not duplicate records.
- **Configuration release:** immutable validated snapshot consumed by normal users.

Use stable opaque IDs. Routes, slugs and display labels may change independently; do not use labels as identifiers.

### 5.1 Interface shell

The runtime renders one shell, specified in [UI Reference](UI-REFERENCE.md):

- a left navigator of application menus and modules, with quick search;
- a top bar with the Super Menu at the top right;
- a page area that renders the components of the selected module;
- a reserved right-panel region, not built initially.

The shell, design tokens and primitives are shared code. Menus, modules, pages and components come from configuration. A module is a page, and a page is an ordered layout of components.

Component types in the first release: page header, text, container/layout, table (list), form, count (KPI), report and action button. Every table has an embedded search field unless configuration disables it. A page contains components only and cannot embed another page in release 1; tabs and sections use the container component ([Decisions D6](DECISIONS.md)).

### 5.2 Edit mode

There is no separate Admin Studio module. The Super Menu contains a lock/edit toggle. "Lock disabled", "editing enabled", "edit mode" and "configure mode" all name the same state ([Decisions C1](DECISIONS.md)):

| State | Behavior |
|---|---|
| Locked (default) | The interface shows the published release. Configuration options are not shown. |
| Unlocked (configure mode) | The interface shows the working draft and exposes configuration. |

All configuration of menus, modules, components, properties, views and forms happens only in configure mode, through the Configure option of the element. No other screen edits configuration.

In edit mode:

- Right-clicking a configurable element opens a context menu with **Configure** and the actions that element supports, such as duplicate, move, disable and remove. The context-menu key, Shift+F10 and long press give the same menu on keyboard and touch.
- Configurable elements are navigator menus and modules (add, rename, reorder, disable, remove), page components, table columns (property configuration, §7.1), views and forms.
- Configure opens a panel generated from the element's registered configuration schema.
- Changes are written to the draft. A draft bar shows the number of unpublished changes with Validate, Publish and Discard.
- Normal users never see draft content.
- Schema operations requested from edit mode go through the schema change service (§7.3).

View operations on a table (sort, filter, search, show or hide columns, reorder) work in both states. Saving them into a shared view requires edit mode. Until accounts exist, settings kept for one person are stored in that browser.

Unlocking becomes permission-gated in the security phase (§11.1). The toggle is a user-interface state and is never a security boundary.

## 6. Configuration, schema and code are different change classes

| Change class | Examples | First-release policy |
|---|---|---|
| UI/application configuration | Rename label, hide/reorder column, layout, saved view, menu order, form presentation | Admin edits draft, validates and publishes |
| Physical schema | Add column, add index, convert type, add relation; new tables and constraints | Add column, add index and presentation conversions run through the platform schema service (§7.3). New tables, constraints and data-rewriting conversions use developer-controlled migrations until the service supports them |
| Application code | New domain rule, integration, custom renderer or unsupported behavior | Reviewed code change in client fork or shared baseline |

Edit mode may request physical schema operations such as adding a property, but only through the platform schema service (§7.3). The service accepts a closed set of operations and generates the SQL itself. It never runs SQL supplied by a person or by configuration. Arbitrary table creation, arbitrary DDL and free-form SQL remain excluded.

Each environment sets `schema_change_mode`:

- `guided_live`: the service applies an approved operation after preview and confirmation, and records it in the schema change log. This is the default for development.
- `migration_controlled`: the service generates a migration file and the matching metadata change for review. Applying it is a deployment step. This is the default for production.

Operations that rewrite existing data need the conversion plan in §7.3 in both modes.

## 7. Data architecture and source of truth

Use physical relational D1 tables for business records and normalized metadata to describe their UI and behavior. Do not put all business records into a generic EAV/key-value table.

A data source maps to an approved physical table. A property maps to a real column, except explicitly declared virtual/computed properties. Physical schema and property metadata are two representations that must be checked for compatibility.

D1/SQLite constraints are part of the product contract:
- Cloudflare D1 currently documents a maximum of 100 columns per table. Treat this as a hard ceiling and warn at a configurable lower threshold (default 80 columns); revalidate provider limits during implementation.
- SQLite does not support a general in-place column-type alteration. Type/constraint changes commonly require a table rebuild and data copy/validation.
- Rebuild plans must account for foreign keys, indexes, triggers, views, dependent queries and constraints; validate row counts and converted values before switching, and preserve a recovery path.
- Property retirement is metadata deprecation first. Physical column removal is a separate reviewed migration.

Required safeguards:
- A migration/deployment check compares expected metadata with actual SQLite table/column definitions.
- Publish validation refuses references to missing or incompatible columns.
- Runtime reports incompatibility visibly and safely.
- Drift diagnostics identify table, column, expected contract and observed schema.
- Physical schema is authoritative for actual columns, constraints and storage; metadata defines UI semantics only when compatible.
- Migrations update physical schema and metadata in a controlled sequence.
- Values use prepared statement bindings; identifiers are allowlisted and safely quoted.

Property types follow Notion's set where it fits relational storage (see [Notion database properties](https://notion.com/help/database-properties)).

**Release 1:** title, text, number (with display formats), currency, select, multi-select, status (options grouped as To-do, In progress and Complete), date (optional end date and time), checkbox, URL, email, phone, relation, unique ID (prefix plus sequence), created time, last edited time, created by and last edited by. Actor values hold a placeholder until authentication exists.

**Deferred**, with reasons: person (needs user accounts), files (needs object storage, a new Cloudflare product that requires demonstrated need), formula and rollup (need a reviewed expression language; configuration cannot contain executable expressions), place, and button as a property (use the action button component).

Cloudflare D1 allows at most 100 columns per table ([D1 limits](https://developers.cloudflare.com/d1/platform/limits)). The platform shows the remaining capacity for each data source and refuses to add a property when the limit is reached. Multi-select values use a junction table and do not use a column.

### 7.1 Property configuration

In edit mode, right-clicking a column header or opening its menu shows **Configure property**. The panel offers, by type:

- all types: name, description, type, required, default value, searchable, and sensitivity (stored now, enforced in the security phase);
- number: display format (plain, with separators, percent); currency: ISO 4217 code and display;
- select, multi-select and status: add, rename, recolor, reorder and deactivate options; status groups. Options have stable keys, and renaming changes only the label. An option in use by records is deactivated, not deleted, unless the person confirms reassignment;
- date: include end date, include time, display format and time zone behavior;
- relation: target data source, display property, one-way or two-way, delete behavior (default restrict);
- unique ID: prefix;
- Convert type, Insert left, Insert right, Duplicate and Delete, as defined in §7.3.

The same header menu offers view operations (sort, filter, group, freeze, hide, calculate) in both lock states.

### 7.2 Schema synchronization

The table view stays synchronized with the physical table. For each data source the platform compares the actual columns with the property metadata and reports one of:

- mapped and compatible;
- unmapped column, offered in edit mode as **Add as property**;
- mapped column that is missing or incompatible, which blocks publish.

Inspection reads SQLite metadata (`PRAGMA table_info`, `PRAGMA index_list`) with allowlisted, quoted identifiers. It runs on demand and before publish.

### 7.3 Schema change service

The service accepts a closed set of operations. They are introduced in this order:

1. **Add property:** `ALTER TABLE ... ADD COLUMN`, nullable or with a constant default, plus metadata. This is additive and is allowed live in `guided_live` mode.
2. **Add or remove an index** on a mapped column.
3. **Presentation conversions without data change:** text to email, phone or URL and back; number format; select to status with the option keys kept. The service validates existing values and reports non-conforming rows before applying.
4. **Data-rewriting conversions** (for example text to number, text to select, select to multi-select), in a later phase. These require a preview of convertible and failing rows, an export or D1 Time Travel bookmark before applying, chunked execution within D1 limits, a SQLite table rebuild when `ALTER` is not enough (create the new table, copy and convert, verify, recreate indexes, foreign keys and triggers, swap), and a documented recovery step.
5. **Delete property:** hides the property first. The physical column is dropped only after a second explicit confirmation and a backup.

Every operation is authorized (in the security phase), previewed with the generated SQL shown read-only, recorded in the schema change log with actor, time and status, audited, idempotent per operation ID, checked against D1 limits, and fails closed. Contract details are in [Implementation Contracts §8](IMPLEMENTATION-CONTRACTS.md).

## 8. Metadata and deployment seed packages

Separate client application identity/configuration from shared runtime code. Each application seed package contains:
- application identity and branding defaults;
- menus, stable routes and modules;
- page/component definitions;
- data-source/property metadata;
- initial views and forms;
- supported feature flags;
- seed version and minimum platform version.

Seed operations must be repeatable and must not overwrite client data or silently replace client customizations. Distinguish initial installation from upgrade. Import/export validates package version, identifiers, references and compatibility before applying changes.

## 9. Client customization and extension model

Use three layers:

1. **Shared core:** platform shell, renderers, metadata services, validation, query engine, security hooks and release machinery.
2. **Client configuration:** branding, navigation, fields, forms, views, component arrangements and supported settings.
3. **Client extensions:** client-specific domain services, integrations, custom component implementations and behavior that configuration cannot safely express.

Do not use patches as the normal customization mechanism. Patches against shared files are fragile when upstream changes. Prefer documented extension interfaces and isolated client-owned files/modules. If an exceptional patch is unavoidable, record its upstream base version, reason, affected files, tests and rebase plan.

### 9.1 Domain action contract

Each server-side action defines a stable key and implementation version, input/output schema, required permission, transaction/idempotency behavior, audit behavior, retry policy, error codes and supported platform/API version.

A configured button may invoke an approved action key, but cannot provide executable code or SQL. Actions execute in the Worker, not the browser. Financial or inventory-changing actions protect against duplicate submissions and partial writes.

## 10. Views and safe query contract

Views reference data sources and define visible properties, column order, typed filters, sorts, grouping, pagination, search fields and row behavior. Start with table/list views and a deliberately small query language.

The Worker validates field IDs, types, operators, sort directions, grouping and page size, then compiles parameterized SQL. Bound query complexity and result size. Complex domain queries use approved developer-defined query services rather than expanding the generic query language indefinitely.

### 10.1 Table view capabilities

The table follows Notion's table view ([views, filters, sorts and groups](https://notion.com/help/views-filters-and-sorts)) in the Cloudflare-style layout of [UI Reference](UI-REFERENCE.md).

Release 1:

- embedded search over configured properties;
- sort by clicking column headers, with multiple ordered sorts;
- typed filters: simple filters, and advanced AND/OR filter groups nested up to three levels;
- group by one property;
- per view: visible columns, column order and width, freeze up to a column, wrap cells;
- footer calculations as bounded server-side aggregates (count, count values, empty, not empty, percent empty, sum, average, min, max);
- server-side pagination with the "Showing x–y of z" summary;
- row open mode: side panel (default), center dialog or full page;
- row action menu;
- several named views per data source, with view tabs; views can be renamed and duplicated;
- settings saved for everyone (shared view, edit mode) or kept personal (browser-local until accounts exist).

Deferred: sub-groups, sub-items, templates, and the board, timeline, calendar, gallery and chart views.

## 11. Authentication, authorization and audit

Every API endpoint declares the permission it requires and calls the central authorize function from the first implementation story. Until Story 11 that function is a development-only placeholder ([Decisions D7](DECISIONS.md)); Story 11 enforces it. The lock/edit UI toggle is not a security control.

- Never ship secrets in Vite variables or browser assets.
- Enforce permissions in Worker routes and data services when Story 11 is implemented.
- Use Admin, Manager and User role presets mapped to permissions, not hardcoded role-name checks.
- Protect sensitive fields at API/query level, not only by hiding columns.
- Audit configuration changes, publish/restore, schema migrations, permission changes and sensitive/destructive operations.
- Client deployments have independent credentials, sessions, secrets and data.

### 11.1 Security phasing

Authentication and authorization are implemented in the phase after the UI/UX phase. Until then:

- each route and module documents the permission it will require, and enforcement is added in the security phase;
- environments that run without authentication hold only test data, and no deployment that lacks authentication goes to production;
- stories record their authorization acceptance criteria as deferred to the security phase instead of treating them as met;
- the lock/edit toggle is not permission-gated until that phase.

## 12. Draft, validation and publishing

Normal users read only the published configuration snapshot. Authorized administrators edit a draft.

Validation checks metadata references, component/property schema versions, required data sources and physical columns, permissions, action registrations, seed compatibility, and deployed platform/API compatibility.

Publish creates an immutable release and switches the active release atomically. A failed publish leaves the previous release active. Restoring a prior configuration creates a new release; it does not erase history.

A configuration rollback does not reverse a physical database migration. Schema rollback/recovery is a separate migration and data-recovery concern.

## 13. Platform and configuration compatibility

Every release declares minimum supported platform version, configuration schema version, component/property schema versions, required API/action versions and required database migration level.

The runtime rejects or clearly marks configuration requiring a newer unsupported platform. Upgrades follow expand → migrate/backfill → switch → contract where breaking schema changes are necessary. Do not deploy configuration that references code or schema not yet deployed.

Promotion between client development and production validates target platform version and migration state. Promote a versioned configuration package/release; do not copy arbitrary database contents.

## 14. Deployment and upgrade lifecycle

### First installation

1. Client forks the baseline repository.
2. Client edits the non-secret deployment manifest.
3. Client creates/uses their Cloudflare account.
4. Client creates D1 and records its ID in the correct environment configuration.
5. Client connects the fork to Pages and configures build settings.
6. Client configures Worker name, D1 binding, CORS/origin and environment variables.
7. Client sets secrets in Cloudflare.
8. Client applies migrations to the selected database.
9. Client applies the application seed package.
10. Client deploys Worker and Pages, then runs health/bootstrap smoke tests.

The process should be documented and automated with safe preparation/validation scripts where practical. It must not require the maintainer's Cloudflare credentials.

### Client development and production

A client may use separate branches and Cloudflare resources for development and production. Branch naming is configurable. Never infer the target database from a branch name alone; require explicit environment configuration and show the target before migration/deployment.

### Upstream updates

- The maintainer tags baseline releases (for example, v1.1.0).
- Client forks review upstream updates.
- Clients merge/cherry-pick on a maintenance branch.
- Run compatibility checks, migrations and regression tests in client development.
- Resolve conflicts in client configuration/extensions separately from core changes.
- Promote to client production only after client approval.

Forks do not automatically receive upstream commits. Each release needs notes and an upgrade guide. Do not promise automatic conflict-free updates.

## 15. Technology decisions

- Frontend: React + Vite.
- Hosting: Cloudflare Pages.
- Backend: one modular Cloudflare Worker.
- Database: Cloudflare D1/SQLite.
- Distribution: GitHub upstream plus client-owned forks.
- Configuration: versioned JSON/metadata with fixed schemas.
- Business records: physical relational tables.
- Deployment settings: validated non-secret client/environment manifest plus provider secrets.
- Interface: shared design tokens and primitives defined in [UI Reference](UI-REFERENCE.md).

Do not add multi-tenant hosting, arbitrary plug-ins, custom scripting, microservices or additional Cloudflare products without demonstrated need.

### 15.1 Resource budget

The application must run within a free Cloudflare plan for a local business of about 5 users and about 100 sessions a day. The design limits are 1,000,000 D1 rows read, 100,000 rows written, 500 MB of storage and 100,000 Worker requests per day. Rows read count rows scanned, so unindexed search and counting are the main risk.

Rules: the runtime reads configuration as a single snapshot; searchable properties are indexed; search and totals are bounded; old releases and audit events have retention; the interface handles a reached daily limit clearly. Per-operation budgets, the reference dataset and the CI checks are in [Implementation Contracts §9](IMPLEMENTATION-CONTRACTS.md). Keep the design simple: add measurements and bounded queries, not elaborate caching.

### 15.2 Resource-aware data access

Beyond the budget, the application is designed to stay well under its limits and to degrade before a limit is reached. Layers: a cached release snapshot with conditional requests, per-table version counters, keyset pagination, maintained counters, bounded and indexed search, no polling, and a resource governor with Normal, Conserve, Essential and Limit states. Users never see a raw limit error. See [Implementation Contracts §10](IMPLEMENTATION-CONTRACTS.md) and [Decisions D17](DECISIONS.md). A local copy of small tables is deferred until measurement justifies it.

## 16. Explicit first-release exclusions

Unless validated by the second application, defer multi-tenant shared hosting, arbitrary admin DDL, arbitrary scripting/SQL, marketplace, advanced workflow/approval engine, formula/rollup language, advanced BI, offline-first sync, enterprise identity federation and multi-region data architecture. Also defer the person, files, formula, rollup and place property types, and the board, timeline, calendar, gallery and chart views.

Record future requirements explicitly rather than silently treating them as forgotten.

## 17. Platform success criteria

1. A client can fork and deploy without maintainer-owned Cloudflare resources.
2. Client resource names and environment bindings can be prepared before first build/deploy.
3. Secrets remain in the client's Cloudflare account.
4. A second distinct related application can be seeded primarily through configuration.
5. Physical schema changes are versioned, validated migrations.
6. Client-specific behavior uses documented extension contracts.
7. Upstream releases can be adopted without overwriting client configuration/data.
8. Compatibility is checked before publish and deployment.
9. Each client owns independent runtime resources and data.
10. Existing Imam Mobile workflows pass regression tests.
11. The runtime interface follows [UI Reference](UI-REFERENCE.md) in light and dark themes.
12. In edit mode, an authorized person can add, rename and remove menus and modules, configure components and properties, and publish the result without a code change.
13. Adding a property and editing select options from a table column need no developer migration in `guided_live` mode.


## 18. Normative implementation contracts

The detailed extension registration, seed ownership/upgrades, property storage, edit-mode and schema change service contracts, second-application proof, maintenance policy and CI rules are defined in [Implementation Contracts](IMPLEMENTATION-CONTRACTS.md). These rules are part of the target architecture. Stories implement them incrementally. Evaluate the second-application proof after Stories 01–06; expand Story 08 only where that evidence demonstrates a common need.
