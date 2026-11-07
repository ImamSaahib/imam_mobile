# Story 01 — Platform Foundation and Application Identity

**Priority:** P0 · **Depends on:** none · **Unlocks:** Stories 02–10  
**Goal:** Establish the smallest persistent platform metadata model and stable application identity without building a broad configuration engine prematurely.

## User story

As a maintainer, I need a minimal metadata foundation and application identity so the same runtime can load different application seed packages without hardcoded Imam Mobile navigation or labels.

## Scope

1. Inspect current D1 schema, Worker routes and existing Imam Mobile workflows before changing anything.
2. Define stable IDs and a minimal metadata catalog for application identity, menus/modules, pages/components, data sources/properties, views/forms and configuration releases.
3. Separate deployment identity from in-app application identity. A client fork/deployment is an installation boundary; the seeded business application is configuration inside that installation.
4. Add a bootstrap API that returns the active published application shell and supported platform/configuration versions.
5. Seed current Imam Mobile navigation and metadata without replacing existing business records or domain endpoints.
6. Add a repeatable, versioned seed package contract. Initial seed and upgrade seed must be distinct operations.
7. Add metadata-to-physical-schema compatibility inspection.
8. Document which tables/metadata are shared platform core and which are app-specific.

## Design constraints

- Start with the minimum catalog needed by the first real workflow.
- Do not create a large generic workspace/tenant subsystem for independent client deployments.
- Use stable opaque IDs; labels/slugs/routes are not identity.
- Do not put business records in generic EAV storage.
- Do not store executable scripts or arbitrary SQL in metadata.
- Seed reruns must not duplicate rows or overwrite client edits/data.

## API and persistence

Define repository/service boundaries in the Worker. At minimum provide bootstrap/read access and a controlled seed mechanism. Exact table names may be finalized after inspecting existing migrations, but the logical entities and ownership boundaries in Architecture are required.

Every metadata record must have an explicit owner/application scope or a documented global scope. Include version fields and timestamps where needed. Existing migrations are immutable; add new numbered migrations.

## Acceptance criteria

- [ ] Existing Imam Mobile records and workflows remain intact.
- [ ] Bootstrap loads the application shell from published metadata, not hardcoded React arrays.
- [ ] Application identity is distinct from deployment/client identity.
- [ ] Stable IDs are independent of display names and route labels.
- [ ] Seed package can be applied twice without duplicate rows or data loss.
- [ ] Seed package declares its version and minimum supported platform/configuration version.
- [ ] Schema compatibility check reports missing/incompatible mapped tables and columns.
- [ ] Incompatible metadata is not silently accepted.
- [ ] Worker metadata SQL is behind service/repository boundaries.
- [ ] Development migration and tests pass; production remains untouched.

## Tests

Empty-database migration; repeatable seed; bootstrap response; stable IDs; legacy data regression; schema mismatch fixtures; invalid metadata; migration ordering.

## Out of scope

Full visual editor, arbitrary table/column creation, multi-tenant shared hosting, marketplace, workflow engine and advanced reports.
