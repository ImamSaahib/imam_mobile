# Handoff: where the work stands

**Read this first when starting a session with any model or person.** It says what to do next, how to verify the starting state, and which rules apply. [TIMELINE.md](TIMELINE.md) holds the status table and 18-step sequence. The story files hold requirements, acceptance criteria and per-slice implementation notes. This file points to them and does not replace them.

**Last updated:** 2026-11-10 (after slice 01d; Story 04 plan written)

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

## 3. Current state

| Item | State |
|---|---|
| Story 00 (UI shell, design system) | In progress. 00a done (Kumo evaluated, decision D20). Tokens and shell (00b) wait for the real reference screenshot |
| Story 01 (platform foundation) | Code complete: slices 01a, 01b, 01c, 01d done. Three acceptance boxes stay open until the React shell reads bootstrap (Story 02) and the dev deployment is verified |
| Story 04 (data model, properties) | In progress. 04a and 04b done (2026-11-11). Next: 04c |
| Stories 02, 03, 05–11 | Planned |
| Worker tests | 207 passing in 13 files (`cd backend && npm run check`) |
| Frontend | Builds. Main chunk about 63 KB gzip. Still uses hardcoded navigation and the legacy API. No frontend test tooling yet |
| Dev database | Migrations 0001 to 0006 are applied to the dev D1 database `imam-mobile-dev-db`, and the seed has been installed (confirmed 2026-11-10): 1 application, 61 seed items, release 1 at first install, now release 2 after the seed upgrade. On the deployed dev Worker, `GET /api/bootstrap` returns 200 (2 rows read, 0 written, release 1) and `GET /api/platform/schema-compatibility` returns `ok: true` (79 rows read). The report lists `created_by` and `updated_by` as unmapped columns on all four tables. Migration 0006 and the seed version 2 upgrade are applied (confirmed 2026-11-11): `GET /api/platform/properties?dataSource=devices` returns currency (PKR, scale 0, 0 to 100,000,000) on both prices and options on `condition` and `status`, and `GET /api/platform/schema-compatibility` returns `ok: true` |

## 4. Next step: Story 04, slice 04c (schema change service and `add_property`)

Story 00b (shell and tokens) is still blocked until the real Cloudflare reference screenshot is attached. The next unblocked step in [TIMELINE.md](TIMELINE.md) is step 7, Story 04.

Done in Story 04: 04a (migration 0006, type registry, property configuration routes, seed v2, applied on dev) and 04b (no migration; `GET /api/platform/schema?dataSource=`, `POST /api/platform/properties/adopt`, `config/schema-inspect.ts`, `config/release.ts`, `SCHEMA_DRIFT` check, system columns). Details, decisions and measured rows are in the Story 04 notes. The owner reports that Cloudflare deploys the repository automatically on each push, so no manual `wrangler deploy` is needed (check the dev Worker's deployment list if a change does not appear). 04b has no migration.

Slice 04c scope is in the slice table of [stories/04-data-model-properties.md](platform/stories/04-data-model-properties.md): migration 0007 (`schema_change_log`), the closed operation list, preview with generated SQL, apply with operation ID and confirmation, idempotent repeat, the 100-column refusal, and `add_property` in `guided_live` mode. First confirm on the D1 runtime whether an `ALTER TABLE` and metadata inserts in one `batch()` roll back together (plan finding 7). Reuse `releaseStatements`, `assertNoDrift`, `inspectSchema` and `adoptColumn` (the recovery path after a partial failure).

Owner questions: both answered (currency 0 to 100,000,000 PKR at scale 0; a schema change publishes a release immediately while data is development-only).

Stories 05 and 06 must add `bumpVersionStatement` to every data-source write batch.

Gate: see TIMELINE step 7 (add-property works in both modes with preview and log).

## 5. After that (from the sequence)

Then 00b (needs the reference screenshot), Story 04, 02, 03, the early reuse checkpoint, 05, 06, 07, phase review, 11, 08, 09, 10. Details and gates are in [TIMELINE.md](TIMELINE.md).

## 6. How to verify the starting state

```
git checkout development && git pull
cd backend && npm ci && npm run check      # type check plus 207 tests
cd ../frontend && npm ci && npm run build
```

CI (`.github/workflows/admin-configuration-validation.yml`) runs the same checks. If these do not pass on a fresh checkout, fix that before new work.

## 7. Where things live

| Topic | Location |
|---|---|
| Worker entry, legacy routes | `backend/src/index.js` |
| Policy placeholder, route inventory | `backend/src/platform/policy.ts` |
| Configuration catalog, seed, snapshot, bootstrap, compatibility | `backend/src/platform/config/`, `backend/src/platform/routes.ts` |
| Migrations | `backend/migrations/` (0001–0006) |
| Imam Mobile seed package | `applications/imam-mobile/seed/package.ts` |
| Tests | `backend/test/` (`catalog.test.ts`, `policy.test.ts`, baseline workflow tests) |
| Decisions (D1–D20, owner confirmations C1–C7) | [platform/DECISIONS.md](platform/DECISIONS.md) |
| Contracts (§1–§12) | [platform/IMPLEMENTATION-CONTRACTS.md](platform/IMPLEMENTATION-CONTRACTS.md) |
| Legacy code inventory and removal checklist | [platform/legacy-inventory.md](platform/legacy-inventory.md) |
| UI target | [platform/UI-REFERENCE.md](platform/UI-REFERENCE.md) |

## 8. Gotchas

- Cloudflare's automatic deployment ships code only. Migrations are not applied by it. A slice that adds a migration must say so in its final report, and the owner runs `cd backend && npm run db:remote` (targets `imam-mobile-dev-db`). Code from that slice can be live before the migration is applied, so it must fail with a clear error, not damage data, when its tables or columns are missing.
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
