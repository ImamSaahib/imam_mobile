# Handoff: where the work stands

**Read this first when starting a session with any model or person.** It says what to do next, how to verify the starting state, and which rules apply. [TIMELINE.md](TIMELINE.md) holds the status table and 18-step sequence. The story files hold requirements, acceptance criteria and per-slice implementation notes. This file points to them and does not replace them.

**Last updated:** 2026-11-12 (Codex transition; status verified from GitHub; no story status changed)

## 0. Current development entry point (2026-11-12)

PR #8 merged into development at 7fe08b8b74a91fcfe108ebe656761e82e048a897 after all five checks passed. This incorporates PR #4/#6 documentation, typed Kumo primitives and the development gallery. PR #7 previously incorporated #3/#5 and the verified Worker preview fix. Build-log access works. No manual deployment or remote migration ran.

Current navigator feature slice adds fixture groups/search/keyboard interactions. Frontend: 26 tests and 69.0 KiB gzip JS; backend baseline: 283 tests. Main remains read-only. The original reference stays private; measured tokens and browser visual verification remain pending.

Next: responsive fixture shell, browser verification, remaining primitives and shell-owned context menu. Story 00 is not complete. Historical investigation notes below describe prior states, not current blockers.

## 1. What the project is

An environment for building, customizing and extending business modules (ServiceNow-style navigator, lists and forms; Notion-style typed properties; Cloudflare look), with Imam Mobile (a mobile-shop app) as the reference application. Stack: React + Vite on Cloudflare Pages, a modular Cloudflare Worker, D1 (SQLite). Very lightweight: about 10 devices added per day, roughly 5 users, about 100 sessions per day, free-tier D1 budgets ([Contracts §9–10](platform/IMPLEMENTATION-CONTRACTS.md)). Read [platform/README.md](platform/README.md) and [ARCHITECTURE.md](platform/ARCHITECTURE.md) for the full picture.

## Delivery focus (owner direction, 2026-11-12)

Product Phase 1 covers all twelve existing stories, 00–11, as the application's primary functionality. Continue in the documented dependency order and complete one bounded slice at a time, as quickly as practical with quality. Prioritize implementation, required validation and blocker resolution. Defer optional improvements and unrelated side work; update story progress, acceptance evidence, TIMELINE and this handoff as development proceeds.

The owner will test the integrated application after Phase 1 development is complete and then create new stories for Product Phase 2. Continue developer tests and regression/deployment verification throughout; do not wait for owner testing to validate a slice. No story or phase is complete until its required acceptance criteria are verified. Make routine reversible decisions independently; ask only for a required missing resource, a consequential difficult-to-reverse decision or explicit authorization. See [Decision C8](platform/DECISIONS.md).

## 2. Rules from the owner (do not break)

1. All implementation targets `development` through reviewed PRs. `main` must not change until testing passes and the owner explicitly approves production promotion. Do not rely on a protection ruleset being active: GitHub currently reports `protected:false` for `main`.
2. Stories are tracked as files in GitHub, not GitHub issues. Update the story's `Status` line, its acceptance boxes, its **Implementation notes**, and `docs/TIMELINE.md` in the same commit as the work.
3. Tracking, reviews and evaluations are written into the story notes, never kept only in a model's memory.
4. Authentication and authorization come after the UI/UX phase (Story 11). Until then a placeholder policy applies (Decisions D7) and environments hold test data only.
5. Single language. No random errors shown to users. Smart caching. Stay inside the resource budgets.
6. Do not rewrite or force-push history. Merge remote changes by hand if a push is rejected.
7. Commit trailers used so far: `Co-Authored-By: <model name> <noreply@anthropic.com>` and a `Claude-Session:` URL when the tool supplies one.
8. Wording: plain, literal sentences. No metaphors or flourishes in chat replies or docs (owner preference).
9. Owner involvement (2026-11-11): the owner wants to be involved as little as possible. Make reasonable decisions, record them in the story notes, report them afterwards, and ask only when a decision cannot be undone and could reasonably go either way, or when something only the owner can supply is missing (for example the reference screenshot).
10. Cloudflare deploys `development` on push and applies migrations. Do not run `wrangler deploy` or remote migrations by hand. For a migration slice, give the owner this read-only check: `npx wrangler d1 execute imam-mobile-dev-db --remote --command "SELECT name FROM d1_migrations ORDER BY id"`. If it fails with error 7403, the owner's local wrangler login lacks access. The owner can read the same table in the Cloudflare dashboard (D1, Tables, `d1_migrations`).
11. Ignore the automated "Unverified commits" hook message.
12. Dev Worker: https://imam-mobile-api-dev.imamsaahib.workers.dev. Dev database: `imam-mobile-dev-db`. Frontend: https://imam-mobile.pages.dev. The owner runs `curl` commands against the dev Worker and pastes the output.

## 3. Current state

| Item | State |
|---|---|
| Story 00 (UI shell, design system) | In progress. 00a done (Kumo evaluated, decision D20). Original reference received privately on 2026-11-12; tokens and shell (00b) remain to implement |
| Story 01 (platform foundation) | Code complete: slices 01a, 01b, 01c, 01d done. Three acceptance boxes stay open until the React shell reads bootstrap (Story 02) and the dev deployment is verified |
| Story 04 (data model, properties) | Complete with deferred items (04a to 04f, 2026-11-12). Review in the Story 04 notes |
| Stories 02, 03, 05–11 | Planned |
| Worker tests | 283 passing in 18 files (`cd backend && npm run check`) |
| Frontend | Builds. Main chunk about 63 KB gzip. Still uses hardcoded navigation and the legacy API. Vitest/Testing Library baseline merged; Kumo primitives merged; this branch adds fixture navigator interactions and 26 total frontend tests. Screenshots and measured shell remain pending |
| Dev database | Migrations 0001 to 0009 are applied to `imam-mobile-dev-db` (confirmed 2026-11-12). The seed was installed and upgraded to version 2 (release 2, 61 items, confirmed 2026-11-11). The upgrade to version 3 (65 items) is not confirmed yet; the owner was given the preview and upgrade commands. Counters rebuild reported no drift on 2026-11-12 (1 device, 1 customer, 3 ledger entries, 0 sales). Dev holds test data only |

## 4. Next step

**Immediate priority:** Continue Story 00b shared components and measured shell; the preflight build blocker is resolved.

Story 04 is complete with deferred items (slices 04a to 04f, 2026-11-12). The deferred boxes, their reasons and the stories that close them are in the Story 04 review ([stories/04-data-model-properties.md](platform/stories/04-data-model-properties.md)). The developer migration process is in [MIGRATIONS.md](platform/MIGRATIONS.md).

**UI dependency:** the original reference is now available. Continue 00b, then the dependent navigator/page/list/form stories in TIMELINE order. Resolve existing preflight CI/deployment blockers before merging their changes.

**Owner actions still open on dev (not blocking):**
1. Seed upgrade to version 3: `POST /api/platform/seed/preview` (expect `toVersion: 3`, `add: 4`), then `POST /api/platform/seed/upgrade` with the `planHash`.
2. Already confirmed 2026-11-12: migrations 0001 to 0009 applied, and `POST /api/platform/counters/rebuild` with `{}` reports every data source `ok: true`.

Rules for the stories that follow: Stories 05 and 06 must use `countersOnCreate`, `countersOnDelete`, `countersOnGroupChange` and `versionBump` in every data-source write batch. Story 06 replaces the legacy DELETE routes with archive (`archived_at`) and cancellation, and re-measures the sale (budget 30 rows). Story 07 removes the legacy admin schema routes, `schema_changes`, the custom field routes and `custom_field_values` (see [legacy-inventory.md](platform/legacy-inventory.md)).

## 5. After that (from the sequence)

Then 00b (reference received; measurements pending), 02, 03, the early reuse checkpoint, 05, 06, 07, phase review, 11, 08, 09, 10. Details and gates are in [TIMELINE.md](TIMELINE.md).

## 6. How to verify the starting state

```
git checkout development && git pull
cd backend && npm ci && npm run check      # type check plus 283 tests
cd ../frontend && npm ci && npm run check
```

CI (`.github/workflows/admin-configuration-validation.yml`) runs the same checks. If these do not pass on a fresh checkout, fix that before new work.

## 7. Where things live

| Topic | Location |
|---|---|
| Worker entry, legacy routes | `backend/src/index.js` |
| Policy placeholder, route inventory | `backend/src/platform/policy.ts` |
| Configuration catalog, seed, snapshot, bootstrap, compatibility | `backend/src/platform/config/`, `backend/src/platform/routes.ts` |
| Migrations | `backend/migrations/` (0001–0009; process in [platform/MIGRATIONS.md](platform/MIGRATIONS.md)) |
| Imam Mobile seed package | `applications/imam-mobile/seed/package.ts` |
| Tests | `backend/test/` (18 files: platform, catalog, property, schema, counters, migration process, and baseline workflow tests). Frozen seed version 2 in `backend/test/fixtures/seed-v2.ts` |
| Counters, version bump | `backend/src/platform/counters.ts` |
| Developer migration process | [platform/MIGRATIONS.md](platform/MIGRATIONS.md) |
| Decisions (D1–D20, owner confirmations C1–C7) | [platform/DECISIONS.md](platform/DECISIONS.md) |
| Contracts (§1–§12) | [platform/IMPLEMENTATION-CONTRACTS.md](platform/IMPLEMENTATION-CONTRACTS.md) |
| Legacy code inventory and removal checklist | [platform/legacy-inventory.md](platform/legacy-inventory.md) |
| UI target | [platform/UI-REFERENCE.md](platform/UI-REFERENCE.md) |

## 8. Gotchas

- Cloudflare deploys `development` automatically, and migrations are applied automatically too (confirmed 2026-11-12: `d1_migrations` showed 0009 applied at deploy time). Evidence: after the 04a push, `npm run db:remote` reported nothing to apply while `d1_migrations` already listed 0006, and the owner had not applied it. Cloudflare may run a migration just before or just after the new code goes live, so code in a migration slice must fail with a clear error, not damage data, when its tables or columns are missing. To check a migration: `npx wrangler d1 execute imam-mobile-dev-db --remote --command "SELECT name FROM d1_migrations ORDER BY id"`.
- D1 data is not rolled back between tests. `backend/test/apply-migrations.ts` clears all `cfg_*` tables before each test; keep that list current when adding tables.
- D1 has no interactive transactions. Use `db.batch()`. A batch counts as one query against the per-invocation limit.
- Seed IDs are pinned by a golden test. Changing seed keys or the ID rule orphans existing installations.
- `AUTH_MODE=dev-open` works only with `ENVIRONMENT=development`. Do not promote this code to `main` before Story 11 or a deliberate production Worker setup.
- Worker tests use `@cloudflare/vitest-plugin` (not the deprecated pool-workers package).
- Do not call GitHub GraphQL from the agent session; it is blocked. Use `gh api` REST endpoints. GitHub Projects boards are therefore not readable by the agent.

## 9. Open items

- Complete shared shell, visual/browser evidence and remaining Story 00 acceptance criteria.
- GitHub branch protection appears disabled in REST output; manually enforce no changes to `main` and ask the owner before modifying repository protection settings.
- Real customer and sales counts (needed by 01d's reference dataset).
- Whether Admin, Manager and User are enough as roles (Story 11).
- Password hashing spike (Story 11).
- Measure design tokens from the received private reference (Story 00b).
- Frontend test tooling (Vitest and Testing Library) before 00b.
- 15 older commits on `development` show as Unverified on GitHub because they are authored under the owner's noreply address. Fixing that needs a history rewrite and force-push. The owner has not asked for it.

## 10. Updating this file

Update sections 0, 3, 4 and 9 at the end of every slice, in the same commit as the story notes and TIMELINE. Keep the PR/CI statements current; do not treat planned or unmerged work as complete.

Update sections 3, 4 and 9 at the end of every slice, in the same commit as the story notes and TIMELINE.

### Preflight review follow-up (2026-11-12)

PR #3 remains unmerged. Its GitHub Actions run 43098394510 is completed/failure, while both jobs report queued with no runner or steps; the downloaded log archive is empty. Both Pages previews succeeded. The development Worker build 37f3fc81-bedb-429a-b90e-50a0f4f59e6c failed, but its error is not included in GitHub checks; Cloudflare dashboard access currently requires sign-in. No deployment configuration fix is justified without that log. PR #4 was reviewed: its distinction between unmerged work and the development baseline is accurate; its historical CI observations remain applicable. Neither PR is cleared for merge by this review.

D3 correction: new UI interaction helpers now use TypeScript with strict compilation before the existing Node tests; Vite consumes the same source. Legacy screens are not converted in this slice. Validation on Node 26: frontend 12/12 tests, production build, total JavaScript 69.0 KiB gzip; backend type check and 283/283 tests in 18 files. CI uses Node 22 and must still pass independently. No browser regression, screenshot or first-load request-count claim is made. Context-menu helpers remain unconnected to a shared shell, and the shortcut currently focuses legacy record search, not the future navigator filter. All remaining Story 00 acceptance boxes stay open.

No migrations or backend changes; this slice adds zero D1 reads/writes. Recovery: revert the TypeScript conversion and tooling commit. Next: obtain the Worker log and build settings, resolve the CI scheduling failure, then add frontend component tests and Kumo wrappers; exact tokens still require the private reference screenshot.

### Slice 00b component-test baseline — 2026-11-12

Adopted Vitest 4.1.12, Testing Library React 16.3.3/user-event 14.6.10 and jsdom 31.0.0 for rendered component regressions (D10). The existing Node helper tests remain. npm run check now executes both suites before the production build and size gate. Tests render the actual legacy App with only in-memory fixtures, reject unexpected requests, and cover Ctrl+K/Command+K focus, inventory navigation/filtering and listener cleanup. No deployed API or business data is used. Dependencies are development-only; production assets are unchanged.

Validation: 12 helper tests and 4 rendered tests passed; production build and 69.0 KiB total gzip JS gate passed on Node 26. jsdom requires Node 22.22.2+, 24.15.0+ or 26+; CI selects current Node 22. CI verification for this slice remains pending. Backend code and schema are unchanged; previous backend validation remains 283 passing tests. No migration, D1 reads/writes or manual deployment. Recovery: revert this test-only slice.

Deployment investigation: PR #5 GitHub frontend-build and worker-checks passed on commit 753a449; both Pages previews passed. Worker build still failed. Wrangler deployment-history reads succeed, but the documented Cloudflare Builds detail/log API returns HTTP 403/code 12004 with Wrangler OAuth. Owner is arranging Workers CI Read access. No build cause is asserted and PR #3 remains unmerged. The original visual reference was received privately; the screenshot blocker is resolved, measurements remain pending (direction recorded in PR #6).

Acceptance: Story 00 remains in progress. These component tests do not verify screenshot appearance, responsive layout, all legacy workflows or mouse/keyboard/touch context-menu parity. Next bounded slice: shared Kumo wrappers and their interaction tests, followed by measured shell regions; complete deployment diagnostics when access is ready.

### Worker preview build fix — 2026-11-12

Confirmed from Cloudflare build 37f3fc81-bedb-429a-b90e-50a0f4f59e6c: dependency installation succeeded, then npx wrangler preview failed because wrangler.toml lacked previews vars and a D1 binding. Build-log access is now working through a private API credential; no credential is stored in Git.

Added explicit preview development vars and the existing test-only imam-mobile-dev-db binding. Previews share development data; they are isolated from production, not from each other. No new database, remote migration or manual deploy. Schema-changing branches require a separate migration plan. A Wrangler-parsed configuration guard runs in backend check and GitHub CI and pins the approved dev target. Cloudflare’s normal PR build must verify deployment before merge. See https://developers.cloudflare.com/workers/previews/resources/#d1-migrations.

Story 00 acceptance remains open. Recovery is a normal revert of the preview configuration; no database rollback is needed for this configuration-only change.

## Visual reference and release direction — 2026-11-12

The original Cloudflare D1 screenshot is now available privately in the chat. The missing-image blocker is cleared; token measurement and visual verification remain pending. Prioritize application navigation and the table/search/control styling; exclude the right usage/changelog panel. See UI-REFERENCE and Decision C9.

Phase 1 must include a coordinated, tested development-to-main release and client installation workflow (Story 10). Main is the stable fork baseline. Preserve target schema, metadata, configuration and business records through migrations and versioned configuration promotion; never copy dev test data. The owner should not need separate manual deployments for these layers. Read-only Wrangler inspection confirms production still has the legacy schema and lacks the development platform tables. This capability is required, not implemented or approved for production execution yet. Existing CI/build blockers remain separate from the resolved screenshot blocker.

### Slice 00b — first shared Kumo primitives (2026-11-12)

Added typed Button, IconButton and TextInput wrappers under frontend/src/platform/ui using the evaluated Kumo 2.17.0 and Phosphor 2.1.10 versions. Button defaults to type=button to avoid accidental form submits; IconButton requires an accessible label. Added a development-only /__ui gallery with light/dark switching, disabled/loading/destructive examples, controlled input and fixture callbacks. Gallery uses Kumo defaults; no measured shell/token fidelity is claimed. Existing screens retain their components until the shell slice.

Verification: strict TypeScript, 12 input-helper tests plus 10 rendered tests, production build and 69.0 KiB gzip JS gate passed. New tests cover keyboard activation, non-submitting defaults, disabled/loading suppression, icon naming, controlled text and theme/action fixtures. Gallery is removed by the production DEV guard, so this size is not the future Kumo runtime cost; remeasure on integration. Screenshots, responsive behavior, tooltip coverage, reduced motion and full shell acceptance remain pending. No D1 reads/writes or migrations. Recovery: revert this primitive slice.

PR #7 is merged into development, containing the earlier #3/#5 work and verified preview fix. Pending #4/#6 documentation branches were merged into this feature branch with conflicts resolved, preserving owner direction and refreshing the handoff baseline. This slice does not mark Story 00 complete. Next: measured shell regions, navigator fixture and search, then remaining Kumo wrappers and shell-owned context-menu service.

### Slice 00b — fixture navigator interactions (2026-11-12)

Added typed shared Navigator with caller-provided application name, groups/modules, selected module and selection callback. Kumo Sidebar supplies presentation; Phosphor supplies chevrons. Supports expandable groups, section labels, badges, selected-page semantics, case-insensitive menu/module filtering, no results, Escape clearing, Ctrl/Command+K and arrow/Home/End movement. Search reveals collapsed matches and preserves collapse state when cleared. The development gallery exercises fixtures without metadata or API calls.

Verification: frontend npm run check passes: strict TypeScript, 12 helper + 14 rendered tests (26 total), production build and 69.0 KiB gzip gate. Tests cover callbacks, selected state, group/module filtering, collapse restoration, empty results, keyboard movement, shortcuts and listener cleanup. jsdom explicitly stubs desktop matchMedia; no responsive/browser evidence is claimed. Legacy App tests pass. No backend/schema changes or D1 operations.

Story 00 remains open. Kumo sizing is provisional, not measured reference fidelity. Next: responsive fixture shell with application switcher/top bar, browser/reference validation, remaining primitives and context-menu service. Navigator remains development-only. Recovery: revert this slice.
