# Developer Migration Process

**Written:** 2026-11-12, Story 04 slice 04f · **Applies to:** every change to the D1 schema that the platform schema change service does not make.

## Two ways the schema changes

| Change | How | Who |
|---|---|---|
| Add a property column, add or drop an index on an approved table, convert a presentation | Platform schema change service (`POST /api/platform/schema/changes`), in `guided_live` or `migration_controlled` mode | Owner through the application, or a developer |
| New table, constraint, foreign key, `NOT NULL` column, data-rewriting conversion, column removal, any other DDL | Developer migration file in `backend/migrations/` | Developer |

No route, configuration or person supplies SQL text. In `migration_controlled` mode the service returns the migration file name and text; a developer commits it as described below, and a second apply with the same operation ID publishes the configuration after checking the physical change exists.

## Rules

1. One file per change, named `NNNN_snake_case.sql`. The number is the previous highest number plus one. Numbers are unique, ordered and have no gaps. `backend/test/migrations-process.test.ts` fails if they are not.
2. Never edit or rename a migration that has been merged to `development`. Add a new one. Cloudflare records applied names in `d1_migrations`.
3. Use only `development` for new migrations. Never run development migrations against production.
4. The file contains plain SQL, one statement after another. D1 runs each file in one transaction, so a failing statement undoes the whole file.
5. SQLite limits: a new column must be nullable or have a constant default, cannot be `PRIMARY KEY` or `UNIQUE`, and a table can have at most 100 columns (platform limit). Dropping or retyping a column needs a table rebuild: create the new table, copy, drop, rename, recreate indexes. Do that inside one file.

## New table or column checklist

For a new approved data table (an application table the platform maps to a data source):

- Columns `id INTEGER PRIMARY KEY AUTOINCREMENT`, `created_at TEXT NOT NULL DEFAULT (datetime('now'))`, `updated_at TEXT`, `archived_at TEXT` (nullable), and an index on `updated_at`. The test checks that every seed data source has `updated_at` with an index.
- Add the table to the seed package as a data source, and every column as a property, in a new seed version (`applications/imam-mobile/seed/package.ts`). Keep existing item IDs. Keep the previous version as a frozen fixture in `backend/test/fixtures/` if tests depend on it.
- Add a counter definition in `backend/src/platform/counters.ts` (`total`, plus a group column if a screen needs per-value counts). The migration backfills `data_source_counters` with actual counts using `INSERT OR REPLACE ... SELECT`.
- Add a `data_source_versions` row for the data source in the same migration. Write routes must call `countersOnCreate`, `countersOnDelete` or `countersOnGroupChange`, and `versionBump`, in the same `db.batch()` as the write.
- Do not add tables or columns that the platform should not expose to the application builder (for example `cfg_*`, `audit_events`). They are blocked tables; see `isBlockedTable` in `platform/config/compat.ts`.

For a new column on an existing table made by a migration: add the matching property in a new seed version in the same commit. Until the seed upgrade runs, the compatibility report lists the column as unmapped (`unmapped`), which is allowed and does not block anything.

## Order of events on deploy

Cloudflare builds `development` on push, applies new migrations, then deploys the Worker. If the Worker code is live before its migration, routes that use the new schema fail with a database error (platform routes that detect this return `MIGRATION_PENDING`, 503). Write migrations so the previous Worker version still works after the migration (additive changes), and keep new code that needs the migration in the same commit.

After the deploy:

1. Check `SELECT name FROM d1_migrations ORDER BY id` includes the new file.
2. If the seed version changed, call `POST /api/platform/seed/preview`, review the counts, then `POST /api/platform/seed/upgrade` with the `planHash`.
3. If counters changed, call `POST /api/platform/counters/rebuild` with `{}` and expect every report `ok: true`.

## Rollback and forward fix

Migrations have no down files. A wrong migration is fixed by a new migration. Data tables on `development` hold test data only until Story 11, so a database can be rebuilt from the migration files in order. Before real data exists in any environment, this document is extended with a backup and restore procedure (Story 03 and Phase B).
