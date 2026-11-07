# Architecture — Forkable Configurable Business Application Baseline

**Status:** Proposed target architecture for development  
**Repository:** `ImamSaahib/imam_mobile`  
**Distribution model:** Client-owned GitHub fork + client-owned Cloudflare deployment  
**Runtime:** React/Vite, Cloudflare Worker API, Cloudflare D1 (SQLite)

## 1. Product boundary and success test

The product is a reusable baseline for **related, small-to-medium internal operations applications with conventional relational data and a known set of workflows**. It is not a universal no-code platform, full ServiceNow replacement, multi-tenant SaaS, or arbitrary scripting environment.

Imam Mobile is the first reference application. The architecture is successful only when a second, distinct application can be created with the same runtime and shared components primarily through configuration.

The platform should support common CRUD workflows. Business-specific behavior such as selling stock, posting ledger entries, approvals or integrations belongs in explicit domain services.

## 2. Distribution and ownership model

### 2.1 Fork-and-deploy

1. The baseline maintainer owns an upstream repository.
2. A client forks that repository into a GitHub account or organization they control.
3. The client connects their fork to their own Cloudflare account.
4. Their Pages project, Worker, D1 database, secrets, custom domains and deployment credentials belong to that client.
5. Client configuration and optional extensions live in the client fork, separated from shared core code.
6. The client chooses when to merge or cherry-pick upstream baseline releases.

Each client deployment is independent. The initial model is **one application instance per fork/deployment with its own D1 database**. Do not introduce shared-hosting, workspace tenancy across clients, or cross-client data access unless a concrete requirement justifies it.

A single client may have separate development and production environments. Those environments must use separate resource names, database IDs, secrets and deployment settings.

### 2.2 Ownership boundaries

| Asset | Owner |
|---|---|
| Upstream baseline repository and tagged releases | Baseline maintainer |
| Client fork and client-specific commits | Client |
| Client Cloudflare account and resources | Client |
| Client data and backups | Client |
| Client credentials and secrets | Client |
| Optional maintenance agreement and upgrade assistance | Defined separately with client |

A fork is a copy of source code, not a transfer of ownership of the upstream repository. Client contracts and licensing must separately define rights, support, maintenance and data responsibilities.

## 3. Deployment configuration contract

Client-specific deployment names must not be scattered through source code. Provide a documented, editable, non-secret deployment manifest before the first Cloudflare build.

Proposed location: `deployment/client.config.json`.

Illustrative shape:

```json
{
  "client": {
    "name": "Client Name",
    "slug": "client-name"
  },
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

This file contains identifiers and defaults only. It must never contain Cloudflare API tokens, passwords, signing keys or other secrets. The database ID is obtained after the client creates the D1 database and is then entered into the manifest/binding configuration.

The deployment preparation process must validate:
- required fields are present and correctly formatted;
- slugs and resource names meet provider constraints;
- Pages project, Worker name and D1 binding agree;
- frontend API base URL targets the intended environment;
- no production resource is accidentally selected during development;
- secrets are configured in Cloudflare, not in Git.

The manifest is a source for generating or validating Wrangler and frontend environment configuration. Avoid multiple independent copies of the same resource name. If provider configuration requires a generated file, document which file is authoritative and how it is regenerated.

### 3.1 Cloudflare resource responsibilities

- Pages project name is chosen when the Pages project is created/connected.
- Worker name is defined in the Worker deployment configuration.
- D1 database name is chosen when the database is created; its database ID is used in the Worker D1 binding.
- Frontend public configuration (for example API base URL and non-secret app branding) may be supplied at build time.
- Secrets and credentials are set as Cloudflare Worker secrets/environment settings.
- D1 migrations are applied to the explicitly selected database before deploying code that requires the new schema.

Do not promise that editing a JSON file alone renames already-created Cloudflare resources. Resource creation/renaming is a provisioning step; runtime configuration is a separate step.

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

Logical hierarchy:

```
Deployment / Application Instance
├── Application
│   ├── Menus
│   │   └── Modules (stable route + page)
│   ├── Pages
│   │   └── Registered component instances
│   ├── Data sources
│   │   ├── Properties
│   │   └── Relations
│   └── Saved views and forms
├── Configuration drafts and releases
├── Domain action registrations
└── Audit events
```

Definitions:
- **Deployment/application instance:** one client-owned installed copy of the baseline.
- **Application:** a named product area within that installation.
- **Menu:** an ordered collection of modules in the navigator.
- **Module:** a stable navigable route/page, not a table.
- **Page:** a composition of registered components and layout metadata.
- **Component:** a fixed, typed renderer with a versioned configuration schema.
- **Data source:** a logical reference to an approved physical D1 table or approved server query.
- **Property:** metadata for a physical column or explicitly supported virtual property.
- **View:** a saved presentation/query definition over records; it does not duplicate records.
- **Configuration release:** an immutable validated snapshot consumed by normal users.

Use stable opaque IDs for identity. Routes, slugs and display labels may change independently; do not use labels as identifiers.

## 6. Configuration, schema and code are different change classes

This separation is mandatory.

| Change class | Examples | First-release policy |
|---|---|---|
| UI/application configuration | Rename label, hide/reorder column, layout, saved view, menu order, form presentation | Admin can edit in draft, validate and publish |
| Physical schema | Add table/column, change type, constraint, index or relation | Developer-controlled migration and deployment |
| Application code | New domain rule, integration, custom renderer, new action implementation | Reviewed code change in the client fork or shared baseline |

Administrators may configure approved existing tables and supported property behavior. They cannot freely create or alter physical D1 schema through ordinary live configuration in v1.

A new field that requires a physical column must be delivered as a migration plus matching metadata update. Type conversion requires a reviewed conversion plan, data validation, recovery strategy and compatibility handling.

## 7. Data architecture and source of truth

Use physical relational D1 tables for business records and normalized metadata for describing their UI and behavior. Do not put all business records into a generic EAV/key-value table.

A data source maps to an approved physical table. A property maps to a real column, except explicitly declared virtual/computed properties. The physical schema and property metadata are two representations that must be checked for compatibility.

Required safeguards:
- A migration/deployment check compares expected metadata with actual SQLite table/column definitions.
- Publish validation refuses to publish references to missing or incompatible columns.
- Runtime bootstrap/data access fails visibly and safely if a published configuration is incompatible with deployed code/schema.
- Drift is reported with the table, column, expected contract and observed schema; do not silently guess.
- Physical schema is authoritative for what exists and its storage constraints; metadata is authoritative for supported UI semantics only when compatible.
- Migrations update physical schema and metadata in a controlled sequence.
- All values use prepared statement bindings; identifiers are validated against allowlists and safely quoted.

Initial property types: text/title, number, currency, select, multi-select, date, checkbox, email, phone, URL, relation and system-managed timestamps/actors where authentication exists. Formula/rollup expressions and arbitrary executable formulas are deferred.

## 8. Metadata and deployment seed packages

Separate client application identity/configuration from shared runtime code. Provide a seed/configuration package for each application instance containing:
- application identity and branding defaults;
- menus, stable routes and modules;
- page/component definitions;
- data-source/property metadata;
- initial views and forms;
- feature flags supported by the runtime;
- required seed version and minimum platform version.

Seed operations must be repeatable and must not overwrite client data or silently replace client customizations. Distinguish initial installation from upgrade. Import/export must validate package version, identifiers, references and compatibility before applying changes.

## 9. Client customization and extension model

Use three layers:

1. **Shared core:** generic platform shell, renderers, metadata services, validation, query engine, authentication/authorization hooks and release machinery.
2. **Client configuration:** branding, navigation, fields, forms, views, component arrangements and supported settings.
3. **Client extensions:** client-specific domain services, integrations, custom component implementations and behavior that cannot be represented safely through configuration.

Do not use patches as the normal customization mechanism. Patches against shared files are fragile when upstream changes. Prefer documented extension interfaces and isolated client-owned files/modules. If an exceptional patch is unavoidable, record its upstream base version, reason, affected files, tests and rebase/merge plan.

### 9.1 Domain action contract

Generic CRUD must not replace domain transactions. Domain actions are registered server-side and invoked through stable action keys.

Each action contract defines:
- stable key and implementation version;
- input schema and validation;
- output schema;
- required permissions;
- transactional/idempotency behavior;
- audit behavior;
- error codes and retry policy;
- supported platform/API version.

The client may configure a button to invoke an approved action key, but cannot provide executable code or SQL in configuration. Actions execute in the Worker, not in the browser. Financial or inventory-changing actions must protect against duplicate submissions and partial writes.

## 10. Views and safe query contract

Views reference data sources and define visible properties, column order, typed filters, sorts, grouping, pagination, search fields and row behavior. Start with table/list views and a deliberately small query language.

The Worker validates field IDs, types, operators, sort directions, grouping and page size, then compiles to parameterized SQL. Bound query complexity and result size. Provide a documented escape hatch for developer-defined domain queries instead of expanding the generic query language indefinitely.

## 11. Authentication, authorization and audit

Every API endpoint has an explicit access policy from the first implementation story. The lock/edit UI toggle is not a security control.

- Select a supported authentication approach before real multi-user deployment.
- Never ship secrets in Vite variables or browser assets.
- Enforce permissions in Worker routes and data services.
- Start with Admin, Manager and User role presets mapped to permissions, not hardcoded role-name checks.
- Protect sensitive fields at the API/query layer, not only by hiding columns.
- Audit configuration changes, publish/restore, schema migrations, permission changes and sensitive/destructive business operations.
- Client deployments have independent credentials, sessions, secrets and data.

## 12. Draft, validation and publishing

Normal users read only the published configuration snapshot. Authorized administrators edit a draft.

Validation checks:
- metadata references and component schemas;
- platform/component/property schema versions;
- required data sources and physical columns;
- permissions and action registrations;
- seed/configuration version compatibility;
- deployed platform/API compatibility.

Publish creates an immutable release and switches the active release atomically. A failed publish leaves the previous release active. Restoring a prior configuration creates a new release; it does not erase history.

A configuration rollback does not reverse a physical database migration. Schema rollback/recovery is a separate migration and data-recovery concern.

## 13. Platform and configuration compatibility

Every release declares:
- minimum supported platform version;
- configuration schema version;
- component type/schema versions;
- required API/action contract versions;
- required database migration level.

The runtime must reject or clearly mark configuration requiring a newer unsupported platform. Upgrades must follow expand → migrate/backfill → switch → contract where breaking schema changes are necessary. Do not deploy a configuration that references code or schema not yet deployed.

Promotion between client development and production environments must validate the target environment's platform version and migration state. Promote a versioned configuration package/release; do not copy arbitrary database contents.

## 14. Deployment and upgrade lifecycle

### First installation

1. Client forks the baseline repository.
2. Client edits the non-secret deployment manifest.
3. Client creates/uses their Cloudflare account.
4. Client creates D1 and records its ID in the correct environment configuration.
5. Client connects the fork to Pages and configures build settings.
6. Client configures Worker name, D1 binding, CORS/origin and environment variables.
7. Client sets secrets in Cloudflare.
8. Client applies migrations to the selected empty/client database.
9. Client applies the application seed package.
10. Client deploys Worker and Pages, then runs health/bootstrap smoke tests.

The process must be documented and, where practical, automated by a safe preparation/validation script. It must not require the maintainer's Cloudflare credentials.

### Client development and production

A client may use separate branches and separate Cloudflare resources for development and production. The default convention can be `development` and `main`, but client naming is configurable. Never infer the target database from a branch name alone; require an explicit environment configuration and show the target before migration/deployment.

### Upstream updates

- The upstream maintainer tags baseline releases (for example, v1.1.0).
- Client forks add upstream as a remote and review updates.
- Clients merge/cherry-pick updates on a maintenance branch.
- Run compatibility checks, migrations and regression tests in client development.
- Resolve conflicts in client configuration/extensions separately from core changes.
- Promote to client production only after explicit client approval.

A fork does not automatically receive upstream commits. Define a release note and upgrade guide for every baseline release. Avoid promising automatic conflict-free updates.

## 15. Technology decisions

- Frontend: React + Vite.
- Frontend hosting: Cloudflare Pages.
- Backend: one modular Cloudflare Worker.
- Database: Cloudflare D1/SQLite.
- Source control/distribution: GitHub upstream plus client-owned forks.
- Configuration: versioned JSON/metadata with fixed schemas.
- Business records: physical relational tables.
- Deployment settings: one validated, non-secret client/environment manifest plus provider secrets.

Do not add multi-tenant hosting, arbitrary plug-ins, custom scripting, microservices or additional Cloudflare products without demonstrated need.

## 16. Required out-of-scope declarations for the first proof of concept

Unless validated by the second application, defer:
- multi-tenant shared hosting;
- arbitrary schema editing by administrators;
- arbitrary scripting and SQL;
- marketplace/plugin ecosystem;
- advanced workflow/approval engine;
- complex formula/rollup language;
- advanced BI and scheduled report delivery;
- offline-first synchronization;
- enterprise identity federation;
- multi-region data architecture.

Record future requirements explicitly rather than silently treating them as forgotten.

## 17. Platform success criteria

The baseline is proven when:
1. A client can fork and deploy without maintainer-owned Cloudflare resources.
2. All client resource names and environment bindings can be prepared before the first build/deploy.
3. Secrets remain in the client's Cloudflare account.
4. A second distinct related application can be seeded primarily through configuration.
5. Physical schema changes are versioned, validated migrations.
6. Client-specific business behavior uses documented extension contracts.
7. Upstream releases can be adopted without overwriting client configuration/data.
8. Configuration/code/schema compatibility is checked before publish and deployment.
9. Each client owns independent runtime resources and data.
10. Existing Imam Mobile workflows continue to pass regression tests.
