# Development Timeline

**Last updated:** 2026-11-13
**Branch rule:** work directly on development (C10); main changes require explicit owner approval. Do not assume branch protection is enabled.
**Continuing the work:** start with [HANDOFF.md](HANDOFF.md).  
**Source of truth:** the story files in [`platform/stories/`](platform/stories/). This file summarizes them. Update it in the same commit that changes a story's status.

## Product delivery phases (owner direction, 2026-11-12)

**Phase 1:** complete the agreed scope of all twelve existing stories (00–11) in the dependency order below. These stories establish the primary application functionality; they do not exhaust the product vision. Deliver quickly with quality, one bounded slice at a time. Do not expand scope with optional improvements or unrelated side work. Necessary tests, fixes, deployment diagnostics and acceptance verification remain part of delivery.

The owner plans integrated application testing after Phase 1 development is complete. Developers continue automated tests, regression checks and development verification during every slice. Do not mark Phase 1 complete while required acceptance criteria or deferred criteria assigned to its stories remain unverified. Record blockers and any explicit scope changes rather than silently treating them as complete.

**Phase 2:** after testing Phase 1, the owner will create new stories for additional functionality. Do not invent or begin that backlog now.

Keep story status, acceptance evidence, this timeline and HANDOFF synchronized with each implementation slice. Minimize routine owner involvement. See [Decision C8](platform/DECISIONS.md). The UI/UX, security and operations stages below are stages within Product Phase 1; the existing security and production-approval gates remain in force.

## Status values

| Status | Meaning |
|---|---|
| Planned | Waiting on dependencies |
| Ready | Dependencies met, no open decision blocks it |
| In progress | Work has started on `development` |
| In review | Implementation awaiting required acceptance review |
| Done | Merged to `development`, acceptance criteria met, evidence recorded |

## Current status

| Story | Title | Priority | Depends on | Status | Evidence |
|---|---|---|---|---|---|
| 00 | UI shell and design system | P0 | none | In progress (00a done; 00b fixture shell/table/context menu implemented) | See Story 00: seven browser scenarios; reference received; calibration and runtime integration pending |
| 01 | Platform foundation and application identity | P0 | none | In progress (01a–01d done) | 01a: baseline tests, type check, CI. 01b: policy layer, actors, audit shape, legacy inventory. 01c-1: catalog, seed, release, bootstrap, compatibility. 01c-2: seed upgrade preview, conflicts, reset (117 tests). 01d: row metering, governor, daily-limit mapping, rate limit, bootstrap cache, version counters (139 tests). See Story 01 notes |
| 02 | Application navigator | P0 | 00, 01 | Planned | |
| 03 | Page builder and component registry | P0 | 00, 01, 02 | Planned | |
| 04 | Data model, properties and schema compatibility | P0 | 01 | Complete with deferred items (04a to 04f done 2026-11-12) | Slice plan 04a to 04f in Story 04 notes. 04a: type registry, property routes, seed v2. 04b: schema inspection, adoption, drift check. 04c: schema change service, `add_property` in guided_live mode. 04d: add and drop index, hide property, convert presentation, `migration_controlled` mode. 04e: `updated_at` indexes, counters, version bumps on every legacy write (2026-11-12) |
| 05 | Lists, views and safe query engine | P0 | 00, 02, 04 | Planned | |
| 06 | Forms, records and domain service extensions | P0 | 00, 02, 04 | Planned | |
| 07 | Edit mode, configuration drafts and publishing | P0 | 00–06 | Planned | |
| 08 | Reports, metrics and registered actions | P2 | 04–06 | Planned | |
| 09 | Audit, operational governance and release compatibility | P1 | 01–08 | Planned | |
| 10 | Client deployment, upgrades and release readiness | P1 | practices from 01 | Planned | |
| 11 | Authentication and authorization | P1 | 01–07 | Planned | |

Evidence means the pull request, commit, test result and measured rows read and written ([Contracts §9](platform/IMPLEMENTATION-CONTRACTS.md)).

## Dependency map

```
00 ─────────────┐
                ├─► 02 ─► 03 ──┐
01 ─┬───────────┘              ├─► 05 ─┐
    └─► 04 ────────────────────┤       ├─► 07 ─► [Phase review] ─► 11 ─► 09 ─► 10 (final)
                               └─► 06 ─┘                                 ▲
                                          08 (after 04–06) ──────────────┘
```

Story 04 needs only Story 01, so it can run beside Stories 02 and 03. Stories 05 and 06 can run side by side once 02 and 04 are done. Story 10's practices (resource measurement, tests, environment safety) apply from Story 01 on, and its release work comes last.

## Development sequence

Work is done in cohesive slices directly on development (C10). Validation follows [agent workflow](AGENT-WORKFLOW.md).

| Step | Work | Why this order | Gate before moving on |
|---|---|---|---|
| 1 ✔ | **01a** Test runner, TypeScript build, baseline tests of current workflows | Nothing moves onto metadata until the current behavior is pinned by tests | Baseline tests pass on `development` |
| 2 ✔ | **00a** Kumo evaluation, icon set (done). Reference received; design token measurement pending | Frontend-only, can run beside step 1 | Evaluation and licence recorded |
| 3 ✔ | **01b** Policy placeholder, actor columns, audit shape, legacy inventory | Every later route declares its permission | Route-policy inventory exists |
| 4 | **00b** Shell, primitives, context menu, gallery | Needs the tokens | Gallery and screenshot tests pass, bundle under 300 KB gzip |
| 5 ✔ | **01c** Metadata catalog, release snapshots, bootstrap, seed | Core of the platform | Seed twice without duplicates, bootstrap reads at most 5 rows |
| 6 ✔ | **01d** Measurement helper, caches, `data_source_versions`, resource governor | Budgets must be measurable before features add load | Governor states and limit error mapping tested |
| 7 ✔ (deferred boxes listed in the Story 04 review) | **Story 04** Properties, schema compatibility, schema change service | Needs only Story 01, and Stories 05 and 06 depend on it | Add-property works in both modes with preview and log. Met after slice 04d (2026-11-11). Story complete after slice 04f (2026-11-12) |
| 8 | **Story 02** Navigator | Needs 00 and 01 | Navigator matches the UI reference |
| 9 | **Story 03** Page builder, component registry, shared configure panel | Needs 02 | Pages render from metadata |
| 10 | **Early reuse checkpoint** (Decisions D12) | Tests the metadata model before the full CRUD and view surface | Second data source, list and form from configuration with no shared-core edits. If it fails, revise the model before step 11 |
| 11 | **Story 05** Lists, views, query engine | Needs 02, 03 and 04 | Budgets met: list page at most 50 rows read, search at most 500 |
| 12 | **Story 06** Forms, records, atomic actions | Needs the same, and fixes the non-atomic sale | Sale is atomic and idempotent |
| 13 | **Story 07** Edit mode, drafts, publishing | Completes the configuration experience | Draft, validate, publish and restore work end to end |
| 14 | **Phase review** | Full reuse proof after Stories 01–06, resource budget re-measured | Simulated day of 100 sessions within budget |
| 15 | **Story 11** Authentication and authorization (hashing spike first) | Only after the UI/UX phase | Every deferred authorization criterion passes |
| 16 | **Story 08** Reports | After the reusable data and action contracts are proven | Fixed KPIs for Imam Mobile only |
| 17 | **Story 09** Audit, governance, release compatibility | Needs 01–08 | Audit events recorded and not editable by normal roles |
| 18 | **Story 10** Release readiness | Last | Dev verified. Only then plan promotion to `main` |

## Promotion warning

The policy layer denies every route except health unless `AUTH_MODE=dev-open` and `ENVIRONMENT=development` are set. Do not promote it to `main` until Story 11 is done, or until a production Worker has been deliberately configured for it.

## Rules for every step

- Work directly on development. No changes to `main` until dev testing is done.
- Each implementation slice updates this file and the story's `Status` line.
- Each implementation slice reports measured rows read and written for its main operations.
- No real business data in any deployment that runs `AUTH_MODE=dev-open`. No deployment of the placeholder policy to production. Production holds no real data today.
- Tests exist and pass before a story moves to Done.

## Open items

| Item | Needed by |
|---|---|
| Rough customer and sales counts (for the reference dataset) | Step 6 |
| Whether Admin, Manager and User are enough as roles | Step 15 |
| Password hashing spike result | Step 15 |
| Measure tokens from the original reference received 2026-11-12 | Step 4 (00b) |

## Change log

Historical entries describe state at their recorded date; current story status takes precedence.

| Date | Change |
|---|---|
| 2026-11-12 | Story 00b preflight: UI input helpers, 12 frontend tests, quick-search focus and bundle-size gate. Full shell remains screenshot-dependent. |
| 2026-11-08 | Timeline created. Stories 00 and 01 marked Ready. |
| 2026-11-10 | Story 04 planned: six slices (04a property contracts and configuration, 04b schema inspection and adoption, 04c schema change service and add property, 04d remaining operations and migration-controlled mode, 04e counters, versions and `updated_at`, 04f migration process and review). Plan and two owner questions are in the Story 04 notes. Story 00b stays blocked: the screenshots attached this session were the 00a Kumo demo renders, not the Cloudflare reference. |
| 2026-11-11 | Story 04 slice 04a done: migration 0006, type registry for 19 types, property configuration routes, seed package version 2 (options, currency scale 0 with a 0 to 100,000,000 PKR limit, relation targets), Contracts §3 currency scale rule. 191 backend tests pass. Migration 0006 and the seed upgrade are not yet applied to the dev database. |
| 2026-11-11 | Story 04 slice 04b done: schema inspection route (columns, indexes, capacity, bounded row count), adoption of unmapped columns, system columns, `SCHEMA_DRIFT` refusal, shared release helper. 207 backend tests pass. No migration. |
| 2026-11-11 | Story 04 slice 04c done: migration 0007 (`schema_change_log`), schema change service with `add_property` in `guided_live` mode (preview, confirmation, operation ID idempotency, plan hash, 100-column refusal, one-batch apply confirmed to undo `ALTER TABLE` on failure). 227 backend tests pass. |
| 2026-11-11 | Story 04 slice 04d done: migration 0008, operations `add_index`, `drop_index`, `hide_property`, `convert_presentation`, `migration_controlled` mode (migration text returned, change awaits the migration, configuration published only after the database shows it), index rule for searchable properties, conversion reports. 256 backend tests pass. TIMELINE step 7 gate met. |
| 2026-11-12 | Story 04 slice 04e done: migration 0009 (`updated_at` indexes, `archived_at`, `data_source_counters`), counters with rebuild and drift report, version bump and counters in the same batch as every legacy write, one-batch sale, seed version 3 (65 items). Record writes at most 10 rows; a sale writes 17 (cash) or 24 (credit), so the domain-action budget in Contracts §9 is now 30. 278 backend tests pass. |
| 2026-11-12 | Story 04 slice 04f done, Story 04 complete with deferred items: developer migration process (`docs/platform/MIGRATIONS.md`), test for migration order and data source to table mapping, legacy inventory updated (schema routes and `custom_field_values` removal moved to Story 07), story review written. Dev database confirmed: migrations 0001 to 0009 applied, counters rebuild reports no drift. 283 backend tests pass. Next step 8 (Story 02) needs Story 00b, which waits for the reference screenshot. |
| 2026-11-10 | Slice 01d done: request metering with rows read and written, resource governor, `DAILY_LIMIT_REACHED`, rate limit, bootstrap cache, `data_source_versions`, configuration revalidation. 139 Worker tests. Story 01 code complete; final review pending. |
| 2026-11-10 | Slice 01c-2 done: seed upgrade preview and apply with three-way comparison, conflict resolution, client ownership, reset to default, deprecation. 117 Worker tests. Slice 01c complete. |
| 2026-11-10 | Slice 01c-1 done: `cfg_*` catalog, seed package (61 items), release snapshot, bootstrap with ETag, compatibility check. 99 Worker tests. 01c-2 (seed upgrades) remains. |
| 2026-11-09 | Slice 01b done: policy layer with route inventory, actor columns, audit event shape, legacy inventory, folder layout. 71 Worker tests. |
| 2026-11-09 | Slice 00a done: Kumo evaluated and adopted for primitives (D20), Phosphor icons, bundle cost measured. Design tokens wait for the reference screenshot. |
| 2026-11-08 | Slice 01a done: Vitest with the Cloudflare plugin, 35 baseline tests, type checking, lockfiles and CI. Story 01 In progress. |

| 2026-11-12 | PR #3 review follow-up: strict TypeScript interaction helpers (D3), 12 frontend tests and 283 backend tests pass locally; JS 69.0 KiB gzip. Worker build logs require Cloudflare sign-in; CI run failed without executed jobs. PRs #3/#4 remain unmerged; Story 00b acceptance remains open. |

### 2026-11-12 — Story 00b component-test baseline

Added Vitest/Testing Library rendered-App regressions to the frontend check command: 12 helper tests + 4 component tests pass, build passes, JS remains 69.0 KiB gzip. PR #5 GitHub checks now pass; Cloudflare Worker build still fails and build-log access returns 403 with Wrangler OAuth. Owner is configuring Workers CI Read. Original visual reference received privately; measurements remain pending. Story 00 remains in progress.

### 2026-11-12 — Confirmed preview build fix

Worker build failed on missing previews configuration, not frontend compilation. Added explicit preview vars and shared test-only dev D1 binding, plus CI target guard. Build-log access resolved. Await normal Cloudflare PR build verification; no manual deployment or migration.

### Owner direction update — 2026-11-12

Recorded Product Phase 1 as Stories 00–11, followed by owner testing and owner-defined Phase 2 stories. Delivery prioritizes existing functionality and required quality gates; optional side work is deferred. This documentation change does not change story status or acceptance criteria.

## Visual reference and release direction — 2026-11-12

The original Cloudflare D1 screenshot is now available privately in the chat. The missing-image blocker is cleared; token measurement and visual verification remain pending. Prioritize application navigation and the table/search/control styling; exclude the right usage/changelog panel. See UI-REFERENCE and Decision C9.

Phase 1 must include a coordinated, tested development-to-main release and client installation workflow (Story 10). Main is the stable fork baseline. Preserve target schema, metadata, configuration and business records through migrations and versioned configuration promotion; never copy dev test data. The owner should not need separate manual deployments for these layers. Read-only Wrangler inspection confirms production still has the legacy schema and lacks the development platform tables. This capability is required, not implemented or approved for production execution yet. Existing CI/build blockers remain separate from the resolved screenshot blocker.

### 2026-11-12 — First shared Kumo primitives

PR #7 merged; #4/#6 documentation consolidated on the primitives branch. Typed Button/IconButton/TextInput and development-only gallery implemented. Strict typecheck, 22 frontend tests, production build and 69.0 KiB gzip gate pass. Screenshots and measured shell remain open; no Story 00 acceptance box closed.

### 2026-11-12 — Story 00b fixture navigator

PR #8 merged into development with all five checks passing, including #4/#6 docs and first Kumo primitives. Next bounded slice adds fixture navigation, filtering, callbacks and keyboard interactions. Frontend check passes: 26 tests, TypeScript, build and 69.0 KiB gzip budget. No backend/database changes. Story 00 remains open; responsive fixture shell and browser/reference validation follow.

### 2026-11-12 — Responsive fixture shell and faster delivery workflow

PR #9 merged. Added application/theme menus, responsive modal navigation, page regions and three browser scenarios; 26 existing frontend tests and build/69.1 KiB gate pass. Detailed evidence and open acceptance remain in Story 00. Simplified HANDOFF and recorded cohesive slices, targeted iteration tests and concise linked docs per owner direction. Next: table/search/column controls.

### 2026-11-12 — Story 00b table fixture

PR #10 merged. Added shared table/search/sort/column controls, cursor navigation, row actions and states, with cancellable debounced loading and stale-response protection. Frontend: 32 unit/component tests, four browser scenarios, TypeScript and 69.1 KiB build gate. Detailed evidence and remaining acceptance are in Story 00. Next: shell context menu and remaining primitives.

2026-11-13: Started shell-owned context-menu prototype after PR #11 merged. See Story 00 evidence; interaction/lifecycle review remains open.

2026-11-13: Finished context-menu focus/lifecycle guards and input parity coverage in PR #12. Validation is batched per cohesive slice; detailed evidence lives in Story 00. Next: remaining shared overlays/states.

2026-11-13: Merged PR #12; consolidated all feature work into development, verified branch ancestry, removed redundant branches and closed already-incorporated Admin Studio PR #1 without changing main. Owner directs future work straight on development with essential batched validation (Decision C10).

2026-11-13: Documentation navigation consolidated; stale PR/screenshot/tooling guidance corrected. Architecture/contracts and historical acceptance evidence preserved.

2026-11-13: Added reusable confirmation dialog with asynchronous action/error handling; 33 component/unit tests and targeted browser validation pass. Story 00 evidence records scope and limitations.

2026-11-13: Shared side panel and toast gallery fixtures validated with four targeted browser scenarios; Story 00 state coverage, calibration and runtime integration remain open.

2026-11-13: Shared resource states now used by tables and gallery; overlay/state batch passes 33 tests and all 12 browser scenarios. Next: visual calibration and acceptance before runtime integration.
