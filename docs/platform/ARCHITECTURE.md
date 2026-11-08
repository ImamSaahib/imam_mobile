# Architecture — Forkable Configurable Business Application Baseline

**Status:** Proposed target architecture for development  
**Repository:** `ImamSaahib/imam_mobile`  
**Distribution:** Client-owned GitHub fork + client-owned Cloudflare deployment  
**Runtime:** React/Vite, Cloudflare Worker API, Cloudflare D1 (SQLite)

## 1. Product boundary and success test

The product is a reusable baseline for **related, small-to-medium internal operations applications with conventional relational data and a known set of workflows**. It is not a universal no-code platform, full ServiceNow replacement, multi-tenant SaaS or arbitrary scripting environment.

Imam Mobile is the first reference application. The architecture is successful only when a second, distinct application can be created with the same runtime and shared components primarily through configuration.

The platform supports common CRUD workflows. Business-specific behavior such as selling stock, posting ledger entries, approvals or integrations belongs in explicit domain services.

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

## 6. Shared visual design system

Story 01 owns the shared design system: a restrained Cloudflare-Dashboard-inspired visual language, tokens for typography, spacing, colors, surfaces, borders, radii, elevation and focus states, responsive breakpoints, light/dark themes, and reusable primitives for shell, navigation, page headers, buttons, fields, dialogs, inspector panels, tabs, status indicators, tables and feedback states. Feature stories compose these primitives instead of introducing competing local styles. Require keyboard accessibility, visible focus, readable contrast and usable touch targets. Do not copy proprietary assets or branding.

## 7. Configuration, schema and code are different change classes

| Change class | Examples | First-release policy |
|---|---|---|
| UI/application configuration | Rename label, hide/reorder column, layout, saved view, menu order, form presentation | Admin edits draft, validates and publishes |
| Physical schema | Add table/column, change type, constraint, index or relation | Developer-controlled migration and deployment |
| Application code | New domain rule, integration, custom renderer or unsupported behavior | Reviewed code change in client fork or shared baseline |

Administrators may configure supported metadata for approved existing tables. They cannot freely create or alter physical D1 schema through ordinary live configuration in v1.

A property may be defined through the UI when it maps to an existing approved physical column. A new physical column/table/index/constraint requires a developer-controlled migration and matching metadata update. Type conversion requires a reviewed conversion plan, data validation, recovery strategy and compatibility handling; it cannot be a metadata-only edit.

## 8. Data architecture and source of truth

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

Initial property types: text/title, number, currency, select, multi-select, date, checkbox, email, phone, URL, relation and system-managed timestamps/actors where supported. Formula/rollup expressions and arbitrary executable formulas are deferred.

## 9. Metadata and deployment seed packages

Separate client application identity/configuration from shared runtime code. Each application seed package contains:
- application identity and branding defaults;
- menus, stable routes and modules;
- page/component definitions;
- data-source/property metadata;
- initial views and forms;
- supported feature flags;
- seed version and minimum platform version.

Seed operations must be repeatable and must not overwrite client data or silently replace client customizations. Distinguish initial installation from upgrade. Import/export validates package version, identifiers, references and compatibility before applying changes.

## 10. Client customization and extension model

Use three layers:

1. **Shared core:** platform shell, renderers, metadata services, validation, query engine, security hooks and release machinery.
2. **Client configuration:** branding, navigation, fields, forms, views, component arrangements and supported settings.
3. **Client extensions:** client-specific domain services, integrations, custom component implementations and behavior that configuration cannot safely express.

Do not use patches as the normal customization mechanism. Patches against shared files are fragile when upstream changes. Prefer documented extension interfaces and isolated client-owned files/modules. If an exceptional patch is unavoidable, record its upstream base version, reason, affected files, tests and rebase plan.

### 10.1 Domain action contract

Each server-side action defines a stable key and implementation version, input/output schema, required permission, transaction/idempotency behavior, audit behavior, retry policy, error codes and supported platform/API version.

A configured button may invoke an approved action key, but cannot provide executable code or SQL. Actions execute in the Worker, not the browser. Financial or inventory-changing actions protect against duplicate submissions and partial writes.

## 11. Views and safe query contract

Views reference data sources and define visible properties, column order, typed filters, sorts, grouping, pagination, search fields and row behavior. Start with table/list views and a deliberately small query language.

The Worker validates field IDs, types, operators, sort directions, grouping and page size, then compiles parameterized SQL. Bound query complexity and result size. Complex domain queries use approved developer-defined query services rather than expanding the generic query language indefinitely.

## 12. Security implementation sequence

Authentication and authorization are scheduled after the UI/UX and reusable-runtime foundation. Stories 01–08 establish policy hooks, stable actor/permission contracts and sensitivity metadata, but hidden navigation and edit-mode controls are not security. Story 09 implements authentication/session management, server-side permission evaluation, sensitive-field enforcement and audit. Real multi-user or production use is prohibited until Story 09's release gate and tests pass.

- Never ship secrets in Vite variables or browser assets.
- Enforce permissions in Worker routes and data services when Story 09 is implemented.
- Use Admin, Manager and User role presets mapped to permissions, not hardcoded role-name checks.
- Protect sensitive fields at API/query level, not only by hiding columns.
- Audit configuration changes, publish/restore, schema migrations, permission changes and sensitive/destructive operations.
- Client deployments have independent credentials, sessions, secrets and data.

## 13. Draft, validation and publishing

Normal users read only the published configuration snapshot. Authorized administrators edit a draft.

Validation checks metadata references, component/property schema versions, required data sources and physical columns, permissions, action registrations, seed compatibility, and deployed platform/API compatibility.

Publish creates an immutable release and switches the active release atomically. A failed publish leaves the previous release active. Restoring a prior configuration creates a new release; it does not erase history.

A configuration rollback does not reverse a physical database migration. Schema rollback/recovery is a separate migration and data-recovery concern.

## 14. Platform and configuration compatibility

Every release declares minimum supported platform version, configuration schema version, component/property schema versions, required API/action versions and required database migration level.

The runtime rejects or clearly marks configuration requiring a newer unsupported platform. Upgrades follow expand → migrate/backfill → switch → contract where breaking schema changes are necessary. Do not deploy configuration that references code or schema not yet deployed.

Promotion between client development and production validates target platform version and migration state. Promote a versioned configuration package/release; do not copy arbitrary database contents.

## 15. Deployment and upgrade lifecycle

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

## 16. Technology decisions

- Frontend: React + Vite.
- Hosting: Cloudflare Pages.
- Backend: one modular Cloudflare Worker.
- Database: Cloudflare D1/SQLite.
- Distribution: GitHub upstream plus client-owned forks.
- Configuration: versioned JSON/metadata with fixed schemas.
- Business records: physical relational tables.
- Deployment settings: validated non-secret client/environment manifest plus provider secrets.

Do not add multi-tenant hosting, arbitrary plug-ins, custom scripting, microservices or additional Cloudflare products without demonstrated need.

## 17. Explicit first-release exclusions

Unless validated by the second application, defer multi-tenant shared hosting, arbitrary admin DDL, arbitrary scripting/SQL, marketplace, advanced workflow/approval engine, formula/rollup language, advanced BI, offline-first sync, enterprise identity federation and multi-region data architecture.

Record future requirements explicitly rather than silently treating them as forgotten.

## 18. Platform success criteria

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


## 19. Normative implementation contracts

The detailed extension registration, seed ownership/upgrades, property storage, second-application proof, maintenance policy and CI rules are defined in [Implementation Contracts](IMPLEMENTATION-CONTRACTS.md). These rules are part of the target architecture. Stories implement them incrementally. Evaluate the second-application proof after Stories 01–06; expand Stories 07–08 only where that evidence demonstrates a common need.
