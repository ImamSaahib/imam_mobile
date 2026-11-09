# Development Timeline

**Last updated:** 2026-11-10  
**Branch rule:** all development happens on `development`. `main` is locked by the "Protect main" ruleset and changes only after testing passes in the dev environment.  
**Continuing the work:** start with [HANDOFF.md](HANDOFF.md).  
**Source of truth:** the story files in [`platform/stories/`](platform/stories/). This file summarizes them. Update it in the same pull request that changes a story's status.

## Status values

| Status | Meaning |
|---|---|
| Planned | Waiting on dependencies |
| Ready | Dependencies met, no open decision blocks it |
| In progress | Work has started on `development` |
| In review | Pull request open |
| Done | Merged to `development`, acceptance criteria met, evidence recorded |

## Current status

| Story | Title | Priority | Depends on | Status | Evidence |
|---|---|---|---|---|---|
| 00 | UI shell and design system | P0 | none | In progress (00a done) | Slice 00a: Kumo evaluation and decision D20. See Story 00 notes |
| 01 | Platform foundation and application identity | P0 | none | In progress (01a–01d done) | 01a: baseline tests, type check, CI. 01b: policy layer, actors, audit shape, legacy inventory. 01c-1: catalog, seed, release, bootstrap, compatibility. 01c-2: seed upgrade preview, conflicts, reset (117 tests). 01d: row metering, governor, daily-limit mapping, rate limit, bootstrap cache, version counters (139 tests). See Story 01 notes |
| 02 | Application navigator | P0 | 00, 01 | Planned | |
| 03 | Page builder and component registry | P0 | 00, 01, 02 | Planned | |
| 04 | Data model, properties and schema compatibility | P0 | 01 | Planned | |
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

Work is done one slice at a time, each in a pull request into `development`.

| Step | Work | Why this order | Gate before moving on |
|---|---|---|---|
| 1 ✔ | **01a** Test runner, TypeScript build, baseline tests of current workflows | Nothing moves onto metadata until the current behavior is pinned by tests | Baseline tests pass on `development` |
| 2 ✔ | **00a** Kumo evaluation, icon set (done). Design tokens wait for the reference screenshot | Frontend-only, can run beside step 1 | Evaluation and licence recorded |
| 3 ✔ | **01b** Policy placeholder, actor columns, audit shape, legacy inventory | Every later route declares its permission | Route-policy inventory exists |
| 4 | **00b** Shell, primitives, context menu, gallery | Needs the tokens | Gallery and screenshot tests pass, bundle under 300 KB gzip |
| 5 ✔ | **01c** Metadata catalog, release snapshots, bootstrap, seed | Core of the platform | Seed twice without duplicates, bootstrap reads at most 5 rows |
| 6 ✔ | **01d** Measurement helper, caches, `data_source_versions`, resource governor | Budgets must be measurable before features add load | Governor states and limit error mapping tested |
| 7 | **Story 04** Properties, schema compatibility, schema change service | Needs only Story 01, and Stories 05 and 06 depend on it | Add-property works in both modes with preview and log |
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

- Work only on `development`, through pull requests. No changes to `main` until dev testing is done.
- Each pull request updates this file and the story's `Status` line.
- Each pull request reports measured rows read and written for its main operations.
- No real business data in any deployment that runs `AUTH_MODE=dev-open`. No deployment of the placeholder policy to production. Production holds no real data today.
- Tests exist and pass before a story moves to Done.

## Open items

| Item | Needed by |
|---|---|
| Rough customer and sales counts (for the reference dataset) | Step 6 |
| Whether Admin, Manager and User are enough as roles | Step 15 |
| Password hashing spike result | Step 15 |
| Reference screenshot (re-attach) to measure design tokens | Step 4 (00b) |
| Frontend test tooling (Vitest with Testing Library) | Before Story 00b screenshot and component tests |

## Recommended model per step

Opus 5.5 for stories 01, 04, 05, 06, 07, 11 and the reviews. Sonnet 5.5 for the rest, and Haiku 5.5 for mechanical work.

## Change log

| Date | Change |
|---|---|
| 2026-11-08 | Timeline created. Stories 00 and 01 marked Ready. |
| 2026-11-10 | Slice 01d done: request metering with rows read and written, resource governor, `DAILY_LIMIT_REACHED`, rate limit, bootstrap cache, `data_source_versions`, configuration revalidation. 139 Worker tests. Story 01 code complete; final review pending. |
| 2026-11-10 | Slice 01c-2 done: seed upgrade preview and apply with three-way comparison, conflict resolution, client ownership, reset to default, deprecation. 117 Worker tests. Slice 01c complete. |
| 2026-11-10 | Slice 01c-1 done: `cfg_*` catalog, seed package (61 items), release snapshot, bootstrap with ETag, compatibility check. 99 Worker tests. 01c-2 (seed upgrades) remains. |
| 2026-11-09 | Slice 01b done: policy layer with route inventory, actor columns, audit event shape, legacy inventory, folder layout. 71 Worker tests. |
| 2026-11-09 | Slice 00a done: Kumo evaluated and adopted for primitives (D20), Phosphor icons, bundle cost measured. Design tokens wait for the reference screenshot. |
| 2026-11-08 | Slice 01a done: Vitest with the Cloudflare plugin, 35 baseline tests, type checking, lockfiles and CI. Story 01 In progress. |
