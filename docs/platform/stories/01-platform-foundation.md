# Story 01 — Platform Foundation and Application Identity

**Status:** Ready for development  
**Priority:** P0 · **Depends on:** none · **Unlocks:** Stories 02–11  
**Goal:** Establish the smallest persistent metadata model, stable application identity, seed package contract and foundational security/schema rules.

## User story

As a maintainer, I need a minimal metadata foundation so the same runtime can load different application seed packages without hardcoded Imam Mobile navigation or labels.

## Scope

1. Inspect current D1 schema, Worker routes and existing Imam Mobile workflows before changing anything.
2. Define stable IDs and a minimal metadata catalog for application identity, menus/modules, pages/components, data sources/properties, views/forms and configuration releases.
3. Separate deployment identity from in-app application identity. A client fork/deployment is an installation boundary; the seeded business application is configuration inside that installation.
4. Add a bootstrap API returning the active published application shell and supported platform/configuration versions.
5. Seed current Imam Mobile experience as metadata without replacing business records or domain endpoints.
6. Define repeatable, versioned seed packages. Initial seed and upgrade seed are distinct operations.
7. Add metadata-to-physical-schema compatibility inspection.
8. Add the placeholder policy layer ([Decisions D7](../DECISIONS.md)): one `authorize(actor, permission)` function, a documented required permission for every API route, `AUTH_MODE=dev-open` allowed only when `ENVIRONMENT=development`, and a health check that fails otherwise. Real authentication is Story 11.
9. Document which metadata is shared runtime core and which is application-specific.
10. Select the test runner (D10), and write baseline tests for the current Imam Mobile workflows before moving anything onto metadata (D11). Base the list on the real routes, and confirm whether a server-side sale operation exists.
11. Inventory the legacy Admin Studio, its admin endpoints and `custom_field_values`, and record the migration and removal plan (D2).
12. Set up the TypeScript build and type checking (D3).
13. Create the folder layout for seed packages, client-owned files and the deployment manifest (D4).
14. Record the configuration storage model (D1) and the identifier rules (D5) in the contracts before defining tables.
15. Add actor columns (`created_by`, `updated_by`) and the audit event shape, filled with a placeholder actor until Story 11.
16. Serve configuration with a release version identifier and no multi-minute edge cache (D13).
17. Record that production on `main` holds no real data today, as confirmed by the owner (D8, C4), so the legacy migration has no production data to preserve.
18. Add the resource-budget measurement helper ([Contracts §9](../IMPLEMENTATION-CONTRACTS.md), D16): confirm the D1 result fields for rows read and written, record them per request in development and tests, and create the reference dataset.
19. The bootstrap API reads the active release as one stored snapshot with a version identifier, not many configuration rows.
20. Map the D1 daily-limit error to the `DAILY_LIMIT_REACHED` error code.
21. Implement the caching layers in [Contracts §10.1–10.2](../IMPLEMENTATION-CONTRACTS.md): hold the release snapshot in Worker memory for at most 60 seconds, answer "unchanged" when the browser's release version matches, and add the `data_source_versions` table.
22. Implement the resource governor ([Contracts §10.7](../IMPLEMENTATION-CONTRACTS.md), D17): usage accumulation from D1 result metadata, the `usage_daily` row, the four states, the per-client rate limit, and the state in the bootstrap response and health check. The interface banner and message text are completed with Story 00 components.
23. Make the service worker cache static files only, with content-hashed names.

## Design constraints

- Start with the minimum catalog needed for the first real workflow.
- Do not create a large cross-client workspace/tenant subsystem; each fork/deployment is its own installation boundary.
- Use stable opaque IDs; labels, slugs and routes are not identity.
- Do not put business records in generic EAV storage.
- Do not store executable scripts or arbitrary SQL in metadata.
- Seed reruns must not duplicate rows or overwrite client edits/data.
- Physical schema changes go through developer migrations in this story. The schema change service is added in Story 04.

## Visual design system

The shared design system is owned by [Story 00](00-ui-shell-design-system.md), which runs alongside this story. This story adds no visual primitives.

## API and persistence

Define Worker repository/service boundaries. At minimum provide bootstrap/read access and a controlled seed mechanism. Exact SQL names may be finalized after inspecting existing migrations, but logical entities and ownership boundaries in Architecture are required.

Every metadata record must have an explicit application/global scope. Include version fields and timestamps where needed. Existing migrations are immutable; add new numbered migrations.

## Acceptance criteria

- [ ] Existing Imam Mobile records and workflows remain intact.
- [ ] Bootstrap loads the application shell from published metadata, not hardcoded React arrays.
- [ ] Application identity is distinct from deployment/client identity.
- [ ] Stable IDs are independent of display names and route labels.
- [ ] Seed package can be applied twice without duplicate rows or data loss.
- [ ] Seed package declares version and minimum supported platform/configuration version.
- [ ] Schema compatibility check reports missing/incompatible mapped tables and columns.
- [ ] Incompatible metadata is not silently accepted.
- [ ] Every API route declares its required permission and calls the placeholder `authorize` function. Enforcement is deferred to Story 11.
- [ ] `dev-open` is refused outside development, and the health check fails if it is active elsewhere.
- [ ] Baseline tests for current Imam Mobile workflows exist and pass before any workflow moves onto metadata.
- [ ] The test runner and TypeScript build are in place.
- [ ] The legacy admin code and `custom_field_values` inventory and plan are recorded.
- [ ] Actor columns and the audit event shape exist with a placeholder actor.
- [ ] The owner's confirmation that production holds no real data is recorded.
- [ ] Bootstrap reads at most 5 rows and writes none, measured on the reference dataset.
- [ ] Rows read and written are recorded for each request in development and tests.
- [ ] A reached daily limit returns `DAILY_LIMIT_REACHED`.
- [ ] A bootstrap request with a matching release version reads at most one row.
- [ ] The governor changes between Normal, Conserve, Essential and Limit at the documented thresholds and resets at 00:00 UTC.
- [ ] The governor state appears in the bootstrap response and the health check.
- [ ] A looping client is rate limited without affecting other clients.
- [ ] The service worker caches static files only.
- [ ] Worker metadata SQL is behind service/repository boundaries.
- [ ] Development migration and tests pass; production remains untouched.

## Tests

Empty-database migration; repeatable seed; bootstrap response; stable IDs; legacy data regression; schema mismatch fixtures; invalid metadata; route-policy inventory; migration ordering.

## Out of scope

Full visual editor, arbitrary table/column creation, multi-tenant shared hosting, marketplace, workflow engine, advanced reports, and real authentication (Story 11).

## Seed ownership and upgrade contract

Every seeded configuration item must carry a stable seed key, package owner, ownership state, last-applied upstream version and baseline value/hash. Business records are never seed-managed. Initial install and repeated application must be idempotent. Upgrades use a three-way comparison (previous upstream, new upstream, current installed value): apply upstream changes only when the client has not changed that item; preserve client-owned values; and flag simultaneous changes as conflicts without overwriting them. Preview additions, updates, conflicts, deprecated items and incompatible references before applying. Resolve conflicts per item and audit the actor/choice. Mark removed items deprecated rather than hard-deleting referenced configuration. Never overwrite client data, secrets or extensions.

## Additional acceptance criteria

- [ ] Seed items have stable keys and explicit seed/client ownership.
- [ ] Upgrade preview and three-way conflict detection are defined before upgrade automation is considered complete.
- [ ] Repeated install and interrupted/retried application are safe.
- [ ] Client-owned items and business records are never overwritten by upstream seed updates.
- [ ] Seed reset-to-upstream-default is an explicit, auditable operation.
