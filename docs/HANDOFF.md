# Handoff: where the work stands

**Read this first when starting a session with any model or person.** It says what to do next, how to verify the starting state, and which rules apply. [TIMELINE.md](TIMELINE.md) holds the status table and 18-step sequence. The story files hold requirements, acceptance criteria and per-slice implementation notes. This file points to them and does not replace them.

**Last updated:** 2026-11-10 (after slice 01c-2)

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
| Story 01 (platform foundation) | In progress. 01a, 01b, 01c (both parts) done. 01d remaining |
| Stories 02–11 | Planned |
| Worker tests | 117 passing in 9 files (`cd backend && npm run check`) |
| Frontend | Builds. Main chunk about 63 KB gzip. Still uses hardcoded navigation and the legacy API. No frontend test tooling yet |
| Dev database | **Migrations 0003 and 0004 are not known to be applied to the dev D1 database, and `POST /api/platform/seed` has not been called.** Apply and seed before deploying the current Worker code |

## 4. Next step: slice 01d (measurement, caches, governor)

Requirement: [Contracts §9–10](platform/IMPLEMENTATION-CONTRACTS.md), Story 01 acceptance boxes still open, Decisions D13, D16, D17.

Build:
- A measurement helper that records rows read and written per request (D1 result `meta`), exposed in development and tests, and used to verify the bootstrap budget (at most 5 rows read, 1 on a matching ETag) on the reference dataset.
- In-memory snapshot cache in the Worker (at most 60 seconds) and `data_source_versions` counters.
- Resource governor (Normal, Conserve, Essential, Limit; thresholds in §10.7, reset 00:00 UTC), `DAILY_LIMIT_REACHED` mapping for D1 limit errors, governor state in bootstrap and health, and per-client rate limiting.
- Service worker that caches static files only; stop edge-caching `GET /api/configuration` (D13).

Gate: governor states and limit error mapping tested; rows read and written recorded in the Story 01 notes; boxes ticked; TIMELINE and this file updated; pushed to `development`.

Seed upgrade API (done in 01c-2): `POST /api/platform/seed/preview`, then `POST /api/platform/seed/upgrade` with the `planHash`, optional `resolutions` and `reset`. Code in `backend/src/platform/config/seed-upgrade.ts`.

## 5. After that (from the sequence)

Then 00b (needs the reference screenshot), Story 04, 02, 03, the early reuse checkpoint, 05, 06, 07, phase review, 11, 08, 09, 10. Details and gates are in [TIMELINE.md](TIMELINE.md).

## 6. How to verify the starting state

```
git checkout development && git pull
cd backend && npm ci && npm run check      # type check plus 117 tests
cd ../frontend && npm ci && npm run build
```

CI (`.github/workflows/admin-configuration-validation.yml`) runs the same checks. If these do not pass on a fresh checkout, fix that before new work.

## 7. Where things live

| Topic | Location |
|---|---|
| Worker entry, legacy routes | `backend/src/index.js` |
| Policy placeholder, route inventory | `backend/src/platform/policy.ts` |
| Configuration catalog, seed, snapshot, bootstrap, compatibility | `backend/src/platform/config/`, `backend/src/platform/routes.ts` |
| Migrations | `backend/migrations/` (0001–0004) |
| Imam Mobile seed package | `applications/imam-mobile/seed/package.ts` |
| Tests | `backend/test/` (`catalog.test.ts`, `policy.test.ts`, baseline workflow tests) |
| Decisions (D1–D20, owner confirmations C1–C7) | [platform/DECISIONS.md](platform/DECISIONS.md) |
| Contracts (§1–§12) | [platform/IMPLEMENTATION-CONTRACTS.md](platform/IMPLEMENTATION-CONTRACTS.md) |
| Legacy code inventory and removal checklist | [platform/legacy-inventory.md](platform/legacy-inventory.md) |
| UI target | [platform/UI-REFERENCE.md](platform/UI-REFERENCE.md) |

## 8. Gotchas

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
