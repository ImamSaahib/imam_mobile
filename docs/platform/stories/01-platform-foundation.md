# Story 01 — Platform Foundation and Metadata Catalog

**Priority:** P0 · **Depends on:** none · **Unlocks:** Stories 02–10  
**Goal:** Establish the persistent, versioned metadata foundation without replacing existing business tables.

## User story

As a platform administrator, I need a workspace and application metadata foundation so that menus, modules, pages, components, data sources, and views can be configured as records rather than hardcoded React arrays.

## Scope

1. Introduce a migration-managed metadata catalog.
2. Define stable IDs, ownership, status, ordering, timestamps, and uniqueness constraints.
3. Create a single bootstrap/read API returning the published application shell.
4. Add repository/service boundaries in the Worker so metadata SQL is not embedded in route branches.
5. Seed the existing Imam Mobile experience as metadata, while preserving existing business records and endpoints.
6. Add schema/configuration version fields to support future upgrades.

## Data model

Create or adapt these logical tables: workspaces, applications, application_menus, modules, pages, components, component_types, data_sources, properties, data_views, configuration_releases, audit_events. Use foreign keys and cascade/restrict behavior deliberately. Add indexes for parent IDs, slugs, status, and ordering. A default workspace and Imam Mobile application should be seeded idempotently.

Do not migrate mobile_devices/customers/sales data into a generic records table. Register those existing tables as data sources and register their existing columns as properties in metadata. Keep legacy API behavior during this story.

## API and behavior

- `GET /api/platform/bootstrap`: returns published workspace/application shell, menu/module hierarchy, supported component types, and metadata version.
- Response includes `platformSchemaVersion`, `configurationVersion`, and feature capability flags.
- Bootstrap must return a controlled error if published metadata is invalid; do not silently generate a partial navigation tree.
- Seed operation must be idempotent.
- Metadata repositories must use prepared statements.

## Frontend

No major visual redesign in this story. Replace only the hardcoded navigation source with bootstrap data behind a compatibility adapter. If bootstrap is unavailable, show a clear recoverable error rather than rendering a misleading empty application. Keep current page routes working.

## Acceptance criteria

- [ ] Fresh development D1 migration creates all metadata tables and indexes.
- [ ] Existing Imam Mobile business tables and records remain unchanged.
- [ ] Seed can run twice without duplicate applications, menus, modules, or properties.
- [ ] Bootstrap returns the seeded application hierarchy from D1.
- [ ] Changing a menu/module title in a development fixture changes bootstrap output without frontend source edits.
- [ ] Invalid references (module to missing menu/page) are rejected by validation.
- [ ] Existing inventory/customer/sales APIs still pass regression tests.
- [ ] No production resource or `main` branch is modified.

## Tests

Unit: slug/ID validation, metadata reference validation, bootstrap serialization.  
Integration: migration on empty D1; seed twice; bootstrap; invalid foreign key.  
Regression: current core API read/write flows against a disposable development test database.

## Definition of done

Migration committed, API documented, tests pass, bootstrap consumed by the existing shell, and a development deployment smoke test is recorded. Include the exact commit SHA and test evidence in the story completion report.

## Out of scope

Visual navigator polish, drag/drop, full menu editor, authentication redesign, and dynamic component rendering. Those belong to later stories.
