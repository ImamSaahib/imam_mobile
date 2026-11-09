# Story 01 — Platform Foundation and Application Identity

**Status:** In progress (slices 01a, 01b and 01c-1 done; 01c-2 and 01d remaining)  
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
- [x] Application identity is distinct from deployment/client identity. *(01c-1: `cfg_application` vs `DEPLOYMENT_KEY` var vs release; test.)*
- [x] Stable IDs are independent of display names and route labels. *(01c-1: seed IDs derived from type and seed key; golden-value and rename tests.)*
- [x] Seed package can be applied twice without duplicate rows or data loss. *(01c-1: second install is a no-op; test. Upgrades are 01c-2.)*
- [x] Seed package declares version and minimum supported platform/configuration version. *(01c-1: `version` and `minPlatformVersion`; too-old platform refused.)*
- [x] Schema compatibility check reports missing/incompatible mapped tables and columns. *(01c-1: `GET /api/platform/schema-compatibility`.)*
- [x] Incompatible metadata is not silently accepted. *(01c-1: install fails with `SCHEMA_INCOMPATIBLE`, nothing written.)*
- [x] Every API route declares its required permission and calls the placeholder `authorize` function. Enforcement is deferred to Story 11. *(Slice 01b: 27 routes in `backend/src/platform/policy.ts`, with a test that fails when a route has no entry.)*
- [x] `dev-open` is refused outside development, and the health check fails if it is active elsewhere. *(Slice 01b.)*
- [x] Baseline tests for current Imam Mobile workflows exist and pass before any workflow moves onto metadata. *(Worker routes: 35 tests, slice 01a.)*
- [x] The test runner and TypeScript build are in place. *(Worker side done in slice 01a. Frontend test tooling is still open, see notes.)*
- [x] The legacy admin code and `custom_field_values` inventory and plan are recorded. *(Slice 01b: [legacy-inventory.md](../legacy-inventory.md).)*
- [x] Actor columns and the audit event shape exist with a placeholder actor. *(Slice 01b: migration 0003.)*
- [x] The owner's confirmation that production holds no real data is recorded. *(Decisions C4, and the legacy inventory.)*
- [ ] Bootstrap reads at most 5 rows and writes none, measured on the reference dataset.
- [ ] Rows read and written are recorded for each request in development and tests.
- [ ] A reached daily limit returns `DAILY_LIMIT_REACHED`.
- [x] A bootstrap request with a matching release version reads at most one row. *(01c-1: query count verified as 1; rows-read measurement arrives with 01d's helper.)*
- [ ] The governor changes between Normal, Conserve, Essential and Limit at the documented thresholds and resets at 00:00 UTC.
- [ ] The governor state appears in the bootstrap response and the health check.
- [ ] A looping client is rate limited without affecting other clients.
- [ ] The service worker caches static files only.
- [x] Worker metadata SQL is behind service/repository boundaries. *(01c-1: all `cfg_*` SQL lives in `backend/src/platform/config/`.)*
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

## Implementation notes

Findings, evaluations and evidence are recorded here as the work happens, so they live in the repository and not in a session. Each slice adds a dated entry.

### Slice 01a — test runner, TypeScript checking, baseline tests (2026-11-08)

**Scope items covered:** 10 (test runner and baseline tests, Worker side), 12 (type checking, partly). Items 1 and 11 were started by reading the code, see the inspection below. Items 2–9 and 13–23 are still open.

**Decisions**
- **D10 resolved for the Worker.** The test runner is Vitest 4.1 with `@cloudflare/vitest-plugin` 1.6, which runs tests inside the Workers runtime with a local D1 database. The older `@cloudflare/vitest-pool-workers` is deprecated and renamed to this package, so it was not adopted. `vitest-pool-workers` 0.23 also pins `vitest ^4.1`, while the newest Vitest is 5.x. Version pins matter here.
- Installing with plain `npm install -D` failed with an npm internal error (`Cannot read properties of null (reading 'edgesOut')`) on the deprecated package. The same install succeeds with `@cloudflare/vitest-plugin`. `npm ci` from the committed lockfile works from a clean checkout.
- **TypeScript:** `tsc --noEmit` runs with `strict` on the tests and config. `allowJs` is on and `checkJs` is off, so the existing `src/index.js` is not type-checked yet. New platform modules are written in TypeScript and the existing file is converted when it changes (D3).
- Lockfiles added for `backend` and `frontend`. CI now uses `npm ci` for both, runs `node --check`, `npm run typecheck` and `npm test` for the Worker, and builds the frontend. The Worker CI job was renamed `worker-syntax` to `worker-checks`. If a required status check is configured later, use the new name.

**Evidence**
- `npm run check` in `backend`: type check clean, 4 test files, 35 tests passing. Clean `npm ci` followed by `npm run check` also passes.
- `npm audit`: 0 vulnerabilities in the plugin-based install. An earlier install of the deprecated package reported 6 high-severity findings in development-only tooling (`sharp`, `undici`, `zod`), another reason not to use it.
- Frontend baseline build: `index` JavaScript 207.8 kB (62.8 kB gzip), Admin Studio chunk 30.0 kB (7.7 kB gzip), CSS 37.1 kB (7.7 kB gzip). About 78 kB gzip in total, against the 300 KB gzip budget (Contracts §9). This is the starting point for Story 00's bundle check.

**Inspection of the current code (D11, scope items 1 and 11)**
- A server-side sale operation exists: `POST /api/sales`. It checks stock, inserts the sale, then runs one `batch()` of sale items, conditional device updates and an optional credit ledger entry. The sale row is inserted in a separate statement before the batch, so a failure in the batch leaves an orphan sale. A concurrent sale of the same device is also possible. There is no idempotency key; a test shows a repeated request with the same `requestId` creates a second sale. Story 06 fixes this.
- The frontend loads all devices, customers, entries and sales with four unpaginated calls on every load, then filters and sorts in the browser. Story 05 replaces this. `GET /api/devices` has a pinned test that returns every row (60 in the test).
- Device and customer deletes are physical. The database refuses deleting a sold device or a customer with ledger entries (foreign keys, 409), which is pinned by tests. Story 04 moves records that matter to archive.
- Validation gap: `condition` must be `Pack` or `Used` and `status` must be `Available`, `Booked` or `Sold Out`, but only the database checks this. A wrong value returns a generic 500 ("An unexpected server error occurred"). That is the kind of random error the product must not show. Pinned by a test and to be fixed in Story 06.
- Admin routes use one shared bearer token. Every admin route returns 401 without it, pinned by tests. `GET /api/configuration` is public and cacheable for 60 seconds at the edge, which conflicts with D13 and is addressed in item 16.
- `custom_field_values` and the live add-column and add-index endpoints exist and are not yet covered by tests. Item 11 (the legacy inventory) still needs its written plan.
- `frontend/README.md` says data is held in memory. The code calls the API, so the README is out of date.
- The API URL is hardcoded to the dev Worker in `App.jsx` and `AdminStudio.jsx`.

**Test conventions**
- Tests call the Worker's `fetch` directly with the local D1 binding and a helper in `backend/test/helpers.ts`.
- Business tables are emptied before each test, because D1 data is not rolled back between tests in a file.
- Tests that document a known defect say so in their names ("known gap") and name the story that changes them. When that story changes the behavior, it updates the test.

**Still open for Story 01**
- Frontend test tooling (Vitest with Testing Library), the rest of D10.
- Tests for `custom_field_values` and the legacy schema endpoints, and the written legacy inventory and removal plan (item 11).
- Slices 01b (policy placeholder, actor columns, audit shape, folder layout), 01c (metadata catalog, snapshots, bootstrap, seed) and 01d (measurement helper, caches, governor, service worker).
- Confirm the D1 result fields for rows read and written (item 18).

### Slice 01b — policy layer, actors and audit shape, legacy inventory, layout (2026-11-09)

**Scope items covered:** 8 (placeholder policy), 11 (legacy inventory and tests), 13 (folder layout), 15 (actor columns and audit shape), and the API base URL fix noted in slice 01a. Still open: 2–7, 9, 14, 16–23.

**What was built**
- `backend/src/platform/policy.ts`: the permission names (defined in code), `ROUTE_POLICY` (every route with its method, path pattern and permission), `matchRoute`, `getActor`, `authorize` and `policyHealth`. The Worker resolves the route once, resolves the actor once and calls `authorize` once, before any route logic, so route handlers were not rewritten. Story 11 replaces `getActor` and `authorize`.
- Open access exists only as `AUTH_MODE=dev-open` together with `ENVIRONMENT=development`. Any other combination denies every route except those marked `public`. The `/api/health` route returns 503 with `ok:false` when `dev-open` is set outside development. Today only `/api/health` is `public`.
- `backend/wrangler.toml` sets `ENVIRONMENT=development` and `AUTH_MODE=dev-open` for the development Worker only.
- Migration `0003_actor_columns_and_audit_events.sql`: `created_by` and `updated_by` on devices, customers, sales and ledger entries, and an `audit_events` table (opaque id, UTC time, actor id and kind, action, entity, outcome of success, denied or failed, summary, details, request id) with three indexes. Existing rows keep NULL. All insert and update routes now fill the actor, including the sale batch.
- `backend/src/platform/audit.ts`: `auditStatement()` builds one audit insert so a business write and its audit event can share one D1 batch. Details are truncated at 2,000 characters. Which events are recorded, retention and read access are decided in Story 09. No route records audit events yet, because each event costs a write.
- Folder layout from D4: `applications/imam-mobile/seed/`, `client/configuration/`, `client/extensions/`, `deployment/`, each with a short README. They are empty on purpose.
- `frontend/src/App.jsx` and `AdminStudio.jsx` read `VITE_API_BASE`, with the dev Worker as the default. `frontend/.env.example` documents it.

**Decisions made during the slice**
- **Public routes.** Only `/api/health` is `public`. `GET /api/configuration` is `configuration.read`, so Story 11 can decide whether the shell needs it before sign-in.
- **Actor ids are text.** The placeholder is the string `dev-placeholder`. Story 11 will store user ids in the same columns.
- **No audit writes yet.** Writing an event on every change would add a write per change against the 100,000 daily write limit before the audit design (Story 09) decides what matters.
- **The shared admin token stays** until Story 11, in addition to the policy layer.

**Evidence**
- `npm run check` in `backend`: type check clean, 7 test files, 71 tests passing (35 baseline from 01a, 14 policy, 8 actor and audit, 14 legacy admin).
- The route inventory test scans the Worker source, so a new route without a policy entry fails the build, and a policy entry for a removed route fails too.
- The policy tests call all 27 routes three ways: dev-open in development (never 403), no mode (always 403 except public), and dev-open outside development (always 403).
- Frontend build passes. Same bundle size as the baseline (JS index 207.8 kB).

**Risks and notes for later**
- **Promotion to `main`:** this code denies every route except health when `AUTH_MODE` and `ENVIRONMENT` are not set to `dev-open` and `development`. A production Worker without those variables would stop serving data. Do not promote the policy layer to `main` until Story 11 is done, or a production Worker exists that has been deliberately set up for it. Recorded in the timeline.
- The legacy `ADMIN_CONFIG_TOKEN` has no value in the dev Worker's checked-in config, as before.
- The development database may contain test rows. Check `custom_field_values` and `schema_changes` before dropping them (legacy inventory, Story 04).
- `README`s in `client/` and `deployment/` mention contents that arrive in later stories.

**Still open for Story 01:** frontend test tooling, then slices 01c (metadata catalog, release snapshots, bootstrap, seed, compatibility inspection, items 2–7, 9, 14, 16, 19) and 01d (resource measurement, caches, governor, service worker, items 18, 20–23).

### Slice 01c — metadata catalog, releases, bootstrap, seed (started 2026-11-09)

**Plan.** The storage model, identifier rules, table list, release and bootstrap contract, compatibility rules and seed installation rules are recorded first in [Contracts §12](../IMPLEMENTATION-CONTRACTS.md) (scope item 14). The slice is split in two so each part is reviewable:

- **01c-1:** migration `0004` with the `cfg_*` tables, ID derivation, snapshot builder and release publish, the Imam Mobile seed package (two menus, six modules and pages matching today's navigation, four data sources with their columns), initial seed installation, schema compatibility inspection, `GET /api/bootstrap` with ETag, deployment key var, and tests.
- **01c-2:** seed upgrade preview with three-way comparison, apply for safe items, conflict reporting, explicit reset to upstream default, and tests (scope item 6 completion).

**Decisions taken in the plan**
- The normalized `cfg_*` rows are the editable working copy. The release snapshot is derived at publish and never edited (D1).
- The bootstrap reads one row when the browser's version matches, and two rows otherwise, against the budget of 5.
- Admin Studio is not seeded as a module. It becomes configure mode (Story 07).
- Views and forms are deferred to Stories 05 and 06, and full property configuration to Story 04.

#### Slice 01c-1 completion notes (2026-11-10)

**Built**
- Migration `0004_configuration_catalog.sql`: `cfg_application`, `cfg_page`, `cfg_menu`, `cfg_module`, `cfg_component`, `cfg_data_source`, `cfg_property`, `cfg_release`, `cfg_active_release`, `cfg_seed_package`, `cfg_seed_item`.
- `backend/src/platform/config/`: ID derivation, canonical JSON and hashing, snapshot builder, compatibility inspection, seed expansion and install, bootstrap with ETag, registry of seed packages. `routes.ts` adds `GET /api/bootstrap`, `POST /api/platform/seed`, `GET /api/platform/schema-compatibility`, each with a policy entry.
- Seed package `applications/imam-mobile/seed/package.ts`: 2 menus, 6 modules, 6 pages, 5 components, 4 data sources, 37 properties (61 seed items).
- `DEPLOYMENT_KEY` var in `wrangler.toml`.

**Decisions and behavior**
- Snapshot ordering is deterministic: menus and modules by position, pages by id, data sources by key. Without this the stored snapshot and one rebuilt from rows differed.
- Seed IDs are pinned by tests (application `app_6f8c8eb21614abbf`; digest of all 61 IDs), so a change that would orphan existing installations fails the build.
- Errors use `PlatformError` with a code and plain message: `PLATFORM_TOO_OLD`, `SEED_UPGRADE_REQUIRED`, `SEED_COLLISION`, `SEED_INVALID`, `SCHEMA_INCOMPATIBLE`, `NOT_INSTALLED`.
- D1 limits rechecked against the Cloudflare docs: `batch()` counts as one query toward the per-invocation limit, no interactive transactions, 100 bound parameters per statement. Install and bootstrap stay inside them.

**Evidence**
- `npm run check`: type check clean, 99 tests in 8 files pass (71 before this slice, 28 added in `test/catalog.test.ts`).
- Frontend build unchanged (main chunk 62.8 KB gzip).
- Bootstrap: 1 query on a matching ETag (304), 2 otherwise. Rows read and written are not yet measured; 01d adds the helper and this slice's budget claim is re-verified there.

**Before deploying to the dev Worker**
- Apply migrations `0003` and `0004` to the dev D1 database first. The new Worker code writes `created_by`/`updated_by` and reads `cfg_*` tables.
- Then call `POST /api/platform/seed` once on dev.
- Do not promote to `main` (see the promotion warning in TIMELINE).

**Still open in 01c**
- 01c-2: seed upgrade preview, three-way comparison, conflicts, reset to default.
- The React shell still reads hardcoded arrays; it moves to bootstrap in Story 02.
