# Story 03 — Page Builder and Component Registry

**Priority:** P0 · **Depends on:** Stories 01–02  
**Goal:** Render module pages from a validated component tree instead of page-specific JSX.

## User story

As an administrator, I want to assemble a module page from reusable components so that a new module can be created without writing a new React page.

## Component registry

Create a registry of supported component types. Each type has:
- stable type key and schema version;
- human-readable name and category;
- JSON configuration schema;
- default configuration;
- renderer;
- validation function;
- supported data source bindings;
- capability flags (resizable, reorderable, configurable, data-bound).

Initial component types:
1. List/database view
2. Form
3. KPI/count
4. Report/chart placeholder (full behavior in Story 08)
5. Button/action
6. Text/heading
7. Section/container/layout

A component instance stores type, page ID, title, position, enabled state, and validated config JSON. It must not store executable code.

## Scope

1. Implement a page renderer that loads a module's page definition and renders components by registry type.
2. Implement a component palette to add supported types.
3. Support reorder, duplicate, enable/disable, and delete in draft configuration.
4. Support layout containers and predictable responsive rules.
5. Provide an explicit unsupported-component fallback that identifies the missing type without crashing the whole page.
6. Convert existing hardcoded Dashboard/Inventory/Customers/Sales areas incrementally into component renderers. Preserve existing forms and business behavior until parity is proven.

## API

- `GET /api/modules/:id/page` returns page layout and component instances from published configuration.
- `POST /api/pages/:id/components`
- `PATCH /api/components/:id`
- `DELETE /api/components/:id`
- `POST /api/pages/:id/components/reorder`

Mutations affect draft metadata only. The API validates component config against the registry's server-side schema.

## Runtime rules

- Renderers are selected from a fixed local registry. Never dynamically import a URL or execute configuration text.
- Component data bindings reference data-source IDs and property IDs, not arbitrary SQL.
- Every renderer handles loading, empty, error, and permission-denied states.
- A component cannot bind to a data source outside its workspace.
- Page layout must have sensible maximum nesting depth and component count.

## Acceptance criteria

- [ ] A new page can be created and display a heading, text, list, KPI, form, and button component without new page-specific JSX.
- [ ] Components can be added, duplicated, reordered, disabled, and removed in draft mode.
- [ ] Refreshing the browser retains draft edits for the administrator.
- [ ] Publishing is required before normal runtime users see changes.
- [ ] Invalid type/config is rejected with field-level errors.
- [ ] Unknown component type produces a contained fallback, not a blank application.
- [ ] Existing business workflows still function after their first conversion.
- [ ] Mobile layouts do not overflow horizontally except inside intentionally scrollable tables.

## Tests

Registry unit tests; config schema validation; page renderer tests for every component type; reorder persistence; published/draft isolation; invalid binding and unknown type tests.

## Out of scope

Full drag/drop canvas, custom component code, marketplace, arbitrary HTML, workflow scripting.
