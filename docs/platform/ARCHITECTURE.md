# Platform Architecture — Lightweight Configurable Application Platform

**Status:** Proposed baseline for development  
**Repository:** `ImamSaahib/imam_mobile`  
**Current deployment model:** React/Vite on Cloudflare Pages; JavaScript Cloudflare Worker API; Cloudflare D1 (SQLite).  
**Architecture principle:** metadata-driven composition over hardcoded business pages.

## 1. Product model

The product is a small application platform. Imam Mobile is its first workspace/application. The platform hierarchy is:

```
Platform / Workspace
├── Application
│   ├── Application Menu (navigation collection)
│   │   ├── Module (route/page)
│   │   └── Module
│   └── Application Menu
├── Data Sources (tables)
│   ├── Properties (columns and types)
│   ├── Relations
│   └── Records
├── Pages
│   └── Components
│       ├── List / Database view
│       ├── Form
│       ├── KPI / Count
│       ├── Report / Chart
│       ├── Button / Action
│       └── Layout / Text
└── Configuration (drafts, validation, publishing, versions)
```

Definitions:
- **Workspace:** ownership and configuration boundary. Initial deployment may contain one workspace, but every metadata row should carry a workspace identifier or have an explicit documented single-workspace constraint.
- **Application:** a named product area inside a workspace (e.g. Imam Mobile).
- **Application menu:** a named, ordered collection of modules shown in the left navigator.
- **Module:** a navigable route/page. It is not a separate application or a database table.
- **Page:** a composition of components and layout settings.
- **Component:** a registered, typed UI building block with a validated configuration schema.
- **Data source:** a logical reference to a physical D1 table or approved query source.
- **Property:** metadata describing a database column, its type, validation, choices, relation, and presentation behavior.
- **View:** a saved presentation/query configuration over a data source. Multiple views can share the same records.
- **Draft configuration:** editable, unpublished metadata.
- **Published configuration:** immutable, validated configuration consumed by normal runtime users.

## 2. Product and technical goals

### Goals
- Build and extend simple business applications through configuration rather than one-off React code.
- Keep the normal runtime clean; configuration controls appear only in configuration mode.
- Support application menus, modules, reusable components, typed fields, views, forms, reports, and actions.
- Make schema, forms, and views consistent: one property definition drives all three.
- Keep the stack light and suitable for a small shop and a handful of concurrent users.
- Keep development and production infrastructure and data isolated.

### Non-goals for the first release
- Full ServiceNow parity, workflow orchestration, enterprise CMDB, marketplace, scripting engine, or arbitrary plug-ins.
- Full Notion parity (formula language, rollups, complex automations, collaborative editing, external sharing).
- Multi-region distributed writes or a microservice architecture.
- Arbitrary SQL or JavaScript entered by administrators.
- A generic no-code platform for every possible application domain. The initial target is CRUD/data-centric internal business apps.

## 3. Runtime architecture

```
Browser (React/Vite)
  ├── Platform shell: top bar, Super Menu, left navigator
  ├── Runtime renderer: page -> component registry
  ├── List / Form / Report renderers
  └── Configuration experience (unlocked mode)
             |
             | HTTPS JSON API
             v
Cloudflare Worker (API + validation + authorization)
  ├── Metadata/configuration services
  ├── Data source and schema services
  ├── Query compiler (allowlisted SQL identifiers)
  ├── Record CRUD services
  ├── View/filter/sort services
  ├── Audit and publication services
  └── D1 binding
             |
             v
Cloudflare D1 (SQLite)
  ├── Platform metadata tables
  ├── Existing business tables (mobile_devices, customers, ...)
  └── Future user-created physical tables
```

Keep the frontend as a renderer, not the authority. The Worker validates every operation and enforces access. The browser must never connect directly to D1.

## 4. Technology decisions and constraints

- **Frontend:** retain React + Vite. Use a small component registry and shared design tokens. Avoid adding a heavyweight page-builder framework unless a story proves it necessary.
- **Backend:** retain one Cloudflare Worker API. Organize code into focused service modules as the backend grows; do not create multiple Workers for each feature.
- **Database:** retain D1/SQLite. Use normalized metadata tables and physical relational tables for business records.
- **Migrations:** checked-in ordered SQL migrations. Never modify a migration already applied to any environment. Deployment must apply pending migrations before the Worker starts using the new schema.
- **No runtime schema discovery on every request:** cache schema metadata in process/request scope where safe; refresh after schema publish. Do not assume Worker memory is durable.
- **No arbitrary dynamic execution:** configurations are JSON validated against versioned schemas. No eval, Function constructor, user-supplied SQL, or user-supplied JavaScript.
- **Avoid premature services:** D1 is adequate for the current small workload. Cloudflare documents D1 as SQLite-based and single-threaded per database; optimize queries and indexes, and revisit architecture only with measured evidence.

## 5. Core metadata model

The following is the logical model. Stories may refine exact SQL names and columns, but must preserve these relationships.

| Entity | Purpose | Key fields |
|---|---|---|
| workspaces | Ownership boundary | id, name, slug, status |
| applications | App identity | id, workspace_id, name, slug, icon, status |
| application_menus | Navigator collections | id, application_id, title, position, visibility |
| modules | Navigable pages | id, application_id, menu_id, title, route, icon, position, status |
| pages | Page composition root | id, module_id, layout_json, status |
| components | Reusable component instances | id, page_id, type, title, config_json, position, enabled |
| component_types | Registry of supported component kinds | type, schema_version, config_schema_json |
| data_sources | Logical tables/data sources | id, workspace_id, physical_table, title, primary_key, status |
| properties | Database column metadata | id, data_source_id, key, label, type, required, unique, default_json, validation_json, options_json, relation_json, position |
| data_views | Saved view definitions | id, data_source_id, title, layout, config_json, position |
| forms | Form definitions | id, data_source_id, title, config_json |
| configuration_releases | Published snapshots | id, workspace_id, version, snapshot_json, created_by, created_at |
| audit_events | Change history | id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at |

Use stable opaque IDs (UUID/ULID or existing integer IDs where compatibility requires). Human-readable slugs are not primary keys. Add created_at/updated_at and indexes where appropriate. Avoid storing the same source of truth in multiple JSON blobs.

### Physical schema and metadata relationship

Use physical SQLite tables for records and normalized metadata for describing them. Do not put all business records into one generic EAV table. EAV harms type safety, filtering, indexes, relations, and reporting.

- A data source maps to one approved physical table.
- A property maps to one physical column, except explicitly supported virtual/computed properties.
- Property type metadata must agree with the actual SQLite column affinity and constraints.
- Select/multi-select choices live in metadata; stored representation must be explicitly defined and validated. Prefer a normalized relation table for multi-select when querying/filtering matters; JSON arrays may be used only where a story documents the trade-off.
- Relations require explicit foreign-key or relation-table behavior and delete policy.
- User-created physical table/column names are generated from validated slugs and quoted by the server. Values always use prepared statement bindings.
- D1/SQLite schema changes are migrations. Changing a property type is not a cosmetic metadata edit: it requires a conversion plan, validation, backup/recovery strategy, and a migration.

## 6. Property type contract

Initial supported property types:
- title/text
- rich_text (plain text initially; no arbitrary HTML)
- number (integer/decimal; precision and min/max)
- currency (integer minor units or documented decimal strategy; currency code)
- select
- multi_select
- date (ISO-8601 date; timezone semantics documented)
- checkbox (integer 0/1)
- email
- phone
- url
- relation (single/multiple with target and delete behavior)
- created_time / updated_time (system-managed)
- created_by / updated_by (once authentication exists)
- formula/rollup are explicitly deferred; never accept executable expressions in v1.

Every type needs: storage mapping, editor, display renderer, validation, filter operators, sort semantics, CSV import/export behavior, and migration behavior. Unsupported operators must be rejected, not silently ignored.

## 7. Views and query contract

A view references a data source; it does not own or duplicate records. Its configuration includes:
- layout: table (first), then list, board, calendar, gallery, chart as stories permit;
- visible property IDs and column order;
- filter tree (AND/OR groups, typed operators and values);
- sort rules (ordered list);
- group-by property (single grouping initially);
- page size and pagination mode;
- searchable properties and query text;
- row actions and default record-open behavior.

The server compiles a typed, allowlisted filter/sort model to parameterized SQL. Identifiers must be checked against metadata; values are bound parameters. Enforce maximum page size, filter depth, number of sort rules, and query length. Never concatenate untrusted SQL fragments.

## 8. Configuration mode and publishing

- Normal mode is the default. Users see only published menus, pages, components, properties, views, and forms.
- The top-right Super Menu contains a lock/edit toggle.
- Unlocking requires the appropriate permission. It reveals configure affordances; it does not grant authorization by itself.
- Right-clicking a component opens its configuration menu. Keyboard-accessible configure controls must also exist.
- Right-clicking a property/column opens the property editor.
- Configuration is changed in a draft snapshot. Validate references, schemas, permissions, and physical schema compatibility before publish.
- Publishing creates an immutable version and atomically switches the active published snapshot.
- If publish fails, the previous published snapshot remains active.
- Rollback means publishing a previous snapshot as a new version, not deleting history.
- Avoid per-component immediate live writes; use explicit save/publish.

## 9. API conventions

Use versioned, resource-oriented JSON APIs. Exact route names are finalized by the relevant story. Suggested contracts:

- `GET /api/platform/bootstrap` — current published application shell and feature capabilities.
- `GET /api/applications`, `POST /api/applications`
- `GET /api/modules/:id`
- `GET /api/data-sources/:id/schema`
- `GET /api/data-sources/:id/records` — validated query/view request.
- `POST /api/data-sources/:id/records`
- `PATCH /api/data-sources/:id/records/:recordId`
- `DELETE /api/data-sources/:id/records/:recordId` — only where policy permits.
- `GET /api/views/:id`, `PUT /api/views/:id`
- `GET /api/configuration/draft`, `PUT /api/configuration/draft`
- `POST /api/configuration/validate`
- `POST /api/configuration/publish`
- `GET /api/configuration/versions`

All errors use a consistent shape: `{ "error": { "code": "...", "message": "...", "details": ... } }`. Include request/correlation ID. Use HTTP status codes consistently. Do not leak SQL, secrets, stack traces, or private record values in errors.

## 10. Security and data integrity

- Authentication and role-based authorization are prerequisites for multi-user production. A shared static admin token embedded in a browser bundle is not secure and must not be treated as final authentication.
- Enforce permissions in the Worker for every metadata and record operation.
- Roles should be workspace-scoped and support application/module/table/action permissions. Initial roles: Admin, Manager, User, but authorization must be permission-based, not hardcoded role-name checks.
- Validate input server-side; use prepared statements for values and allowlisted identifiers for tables/columns.
- Protect against mass assignment: users may write only allowed fields.
- Audit configuration changes, schema changes, publish, destructive record operations, and permission changes.
- Use explicit delete policies and foreign keys. Prefer archive/soft-delete where business records need retention.
- Never return purchase-cost or other restricted fields merely because the frontend hides a column.

## 11. Performance and operating limits

Current target is a small shop with a few concurrent users and modest API traffic. Keep queries indexed, paginated, bounded, and short. D1 processes queries serially per database, so avoid N+1 requests and long scans. Use batched statements for logically related writes where supported. Add query limits and indexes from measured access patterns. Do not add caching to mutable or permission-sensitive responses without a clear invalidation model.

## 12. Environments and release policy

- `development` branch → `imam-mobile-dev` Pages, `imam-mobile-api-dev` Worker, `imam-mobile-dev-db` D1.
- `main` branch → production Pages, `imam-mobile-api` Worker, `imam-mobile-db` D1.
- All story work stays on development.
- Production is changed only through an explicitly approved merge/release.
- Never run a migration against production as part of a development story.
- Keep environment-specific URLs and IDs in deployment configuration, not hardcoded across multiple components. Frontend should read a Vite environment variable with a safe documented default; secrets must remain server-side.

## 13. Definition of platform done

A feature is platform-grade only when:
1. It is metadata-driven and not hardcoded to Imam Mobile labels/entities.
2. It persists in D1 and survives reload/redeploy.
3. It is validated and authorized by the Worker.
4. It works in normal mode and configuration mode as applicable.
5. It has migration(s), tests, error handling, and documentation.
6. It does not break existing inventory, customer, sales, and ledger workflows.
7. It is verified on development and has not changed production.
