# Handoff: where the work stands

**Read this first when starting a session with any model or person.** It says what to do next, how to verify the starting state, and which rules apply. [TIMELINE.md](TIMELINE.md) holds the status table and 18-step sequence. The story files hold requirements, acceptance criteria and per-slice implementation notes. This file points to them and does not replace them.

**Last updated:** 2026-11-12 (Story 00b preflight in review, Story 04 still complete with deferred items)

## 1. What the project is

An environment for building, customizing and extending business modules (ServiceNow-style navigator, lists and forms; Notion-style typed properties; Cloudflare look), with Imam Mobile (a mobile-shop app) as the reference application. Stack: React + Vite on Cloudflare Pages, a modular Cloudflare Worker, D1 (SQLite). Very lightweight: about 10 devices added per day, roughly 5 users, about 100 sessions per day, free-tier D1 budgets ([Contracts §9–10](platform/IMPLEMENTATION-CONTRACTS.md)). Read [platform/README.md](platform/README.md) and [ARCHITECTURE.md](platform/ARCHITECTURE.md) for the full picture.

## 2. Rules from the owner (do not break)

1. All development happens on the `development` branch. `main` must not change until testing passes in the dev environment. The GitHub ruleset "Protect main" locks `main` completely.
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
| Story 00 (UI shell, design system) | In progress. 00a done (Kumo, D20); 00b preflight adds interaction helpers, 12 Node tests and frontend quality gate. Tokens and shell await screenshot |
| Story 01 (platform foundation) | Code complete: slices 01a, 01b, 01c, 01d done. Three acceptance boxes stay open until the React shell reads bootstrap (Story 02) and the dev deployment is verified |
| Story 04 (data model, properties) | Complete with deferred items (04a to 04f, 2026-11-12). Review in the Story 04 notes |
| Stories 02, 03, 05–11 | Planned |
| Worker tests | 283 passing in 18 files (`cd backend && npm run check`) |
| Frontend | Builds. Main chunk about 63 KB gzip. Still uses hardcoded navigation and the legacy API. 12 dependency-free frontend tests and bundle gate included in 00b preflight; Vitest/Testing Library and screenshots still pending |
| Dev database | Migrations 0001 to 0009 are applied to `imam-mobile-dev-db` (confirmed 2026-11-12). The seed was installed and upgraded to version 2 (release 2, 61 items, confirmed 2026-11-11). The upgrade to version 3 (65 items) is not confirmed yet; the owner was given the preview and upgrade commands. Counters rebuild reported no drift on 2026-11-12 (1 device, 1 customer, 3 ledger entries, 0 sales). Dev holds test data only |

## 4. Next step

Story 04 is complete with deferred items (slices 04a to 04f, 2026-11-12). The deferred boxes, their reasons and the stories that close them are in the Story 04 review ([stories/04-data-model-properties.md](platform/stories/04-data-model-properties.md)). The developer migration process is in [MIGRATIONS.md](platform/MIGRATIONS.md).

**Blocked on the owner:** the next steps in [TIMELINE.md](TIMELINE.md) (00b, then Story 02 Navigator, Story 03, the reuse checkpoint, Stories 05 and 06) all depend on the UI shell. Story 00b needs the real Cloudflare reference screenshot attached. No other owner decision is open.

**Owner actions still open on dev (not blocking):**
1. Seed upgrade to version 3: `POST /api/platform/seed/preview` (expect `toVersion: 3`, `add: 4`), then `POST /api/platform/seed/upgrade` with the `planHash`.
2. Already confirmed 2026-11-12: migrations 0001 to 0009 applied, and `POST /api/platform/counters/rebuild` with `{}` reports every data source `ok: true`.

Rules for the stories that follow: Stories 05 and 06 must use `countersOnCreate`, `countersOnDelete`, `countersOnGroupChange` and `versionBump` in every data-source write batch. Story 06 replaces the legacy DELETE routes with archive (`archived_at`) and cancellation, and re-measures the sale (budget 30 rows). Story 07 removes the legacy admin schema routes, `schema_changes`, the custom field routes and `custom_field_values` (see [legacy-inventory.md](platform/legacy-inventory.md)).

## 5. After that (from the sequence)

Then 00b (needs the reference screenshot), 02, 03, the early reuse checkpoint, 05, 06, 07, phase review, 11, 08, 09, 10. Details and gates are in [TIMELINE.md](TIMELINE.md).

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

- Real customer and sales counts (needed by 01d's reference dataset).
- Whether Admin, Manager and User are enough as roles (Story 11).
- Password hashing spike (Story 11).
- Real Cloudflare reference screenshot to measure design tokens (Story 00b).
- Frontend test tooling (Vitest and Testing Library) before 00b.
- 15 older commits on `development` show as Unverified on GitHub because they are authored under the owner's noreply address. Fixing that needs a history rewrite and force-push. The owner has not asked for it.

## 10. Updating this file

Update sections 3, 4 and 9 at the end of every slice, in the same commit as the story notes and TIMELINE.
