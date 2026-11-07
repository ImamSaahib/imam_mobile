# Story 10 — Migrations, Testing, Performance, and Release Readiness

**Priority:** P0 · **Depends on:** all previous stories; practices apply from Story 01  
**Goal:** Make platform changes repeatable, testable, observable, and safe to release.

## User story

As a maintainer, I want automated schema/config migrations, reliable tests, and a repeatable release process so development can evolve without corrupting data or breaking production.

## Scope

1. Migration discipline for D1: sequential SQL files, migration status, development-first application, idempotent seed data, and documented rollback/forward-fix strategy.
2. Build validation on every commit: Vite production build, lint/type checks if configured, Worker syntax/build checks, unit and integration tests.
3. Add a smoke test for bootstrap, navigator, data source schema, list query, form CRUD, configuration draft/validate/publish, and authorization.
4. Add regression fixtures for current Imam Mobile inventory, customer, customer ledger, sales and reports.
5. Add bounded query defaults, indexes for known filters/sorts, and query timing/request IDs.
6. Add error reporting that avoids secrets and sensitive record content.
7. Add backup/recovery and release checklist for production.
8. Document environment variables and verify no development URL/database ID is hardcoded into production configuration.
9. Add deployment health checks and a simple rollback/forward-fix process.

## Migration policy

- Never rewrite an applied migration.
- Every schema change is a new numbered SQL file.
- Development migration first; verify data and application behavior; only later release to production through explicit approval.
- Prefer additive changes. Destructive changes require expand → migrate data → switch reads/writes → contract in a later release.
- D1 schema migration rollback is not assumed to be automatic. Define a tested recovery or forward-fix path.
- Worker deploy command must apply pending migrations to the correct environment. Verify database name/ID before execution.
- Seed scripts must be repeatable and must not create duplicate rows.

## CI and test layers

- Static: Vite build, Worker syntax check, lint, dependency audit where available.
- Unit: metadata validators, type mapping, filter compiler, component config validators.
- Integration: D1 migrations, repositories, CRUD, publish/restore, permissions.
- E2E/smoke: critical browser paths on development.
- Regression: legacy business workflows and calculations.

## Acceptance criteria

- [ ] Every PR/commit path has automated frontend and backend validation.
- [ ] Broken JSX/JavaScript is caught before Cloudflare deployment.
- [ ] Migrations apply to an empty development database in order.
- [ ] Reapplying migration command is safe and reports no pending work.
- [ ] Development smoke tests pass after deploy.
- [ ] Existing business workflows pass regression tests.
- [ ] Production deployment is a separate, explicitly approved action.
- [ ] Recovery procedure is documented and has been rehearsed on development.
- [ ] Performance limits are enforced for pagination, search, filters, and reports.
- [ ] Deployment notes include commit SHA, migrations applied, test evidence, and known limitations.

## Definition of done

A release candidate can be rebuilt from GitHub, migrated from a clean D1 database, deployed to development, smoke-tested, and recovered without relying on undocumented manual steps.

## Out of scope

Large-scale load testing, multi-region architecture, enterprise observability stack, complex disaster recovery automation.
