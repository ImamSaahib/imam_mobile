# Story 10 — Client Deployment, Upgrades, Testing and Release Readiness

**Priority:** P0 · **Practices apply from Story 01** · **Depends on:** platform contracts from Stories 01–09  
**Goal:** Make a client-owned fork reproducibly installable, configurable, upgradeable and recoverable without maintainer-owned Cloudflare credentials.

## User story

As a client or implementation developer, I want to fork the baseline, enter client-specific resource names before the first build, provision my own Cloudflare resources, deploy the application and adopt future baseline releases safely.

## Part A — First installation

1. Fork the upstream repository into the client's GitHub account/organization.
2. Edit the non-secret client/environment manifest before first deployment.
3. Create or select the client's Cloudflare account.
4. Create the D1 database and record its ID in the correct environment configuration.
5. Connect the client fork to Cloudflare Pages and set build command/output directory.
6. Configure Worker name, D1 binding, API origin/CORS and public non-secret frontend variables.
7. Set secrets through Cloudflare dashboard/secret management; never commit them.
8. Apply migrations to the explicitly selected database.
9. Apply the application seed package.
10. Deploy Worker and Pages.
11. Run health, bootstrap, authentication, schema compatibility and core workflow smoke tests.

The process must be documented and should be automated with safe preparation/validation scripts where practical. It must not require the maintainer's Cloudflare account or API token.

## Part B — Deployment configuration

Provide an editable manifest such as `deployment/client.config.json` and environment-specific configuration. The manifest is the source for validating/generating provider settings; do not duplicate resource names in unrelated source files.

Validate client name/slug, Pages project, Worker name, D1 name/ID, environment identifier, frontend API URL, allowed origins, required build variables and required secret names (not secret values).

Explain which resources must be created in Cloudflare and which names are selected at resource creation. Editing a manifest does not rename an existing resource.

## Part C — Environment safety

A client may have development and production environments with separate branches/deployment refs, Pages projects, Worker names, D1 databases/IDs, secrets and allowed origins.

Before migration/deployment, clearly identify selected environment, Worker and database. Require explicit environment selection. Never infer target database solely from branch name. Production requires explicit approval.

## Part D — Upstream baseline updates

1. Tag upstream baseline releases with semantic version and release notes.
2. Document how a client fork adds upstream and reviews updates.
3. Keep client configuration and extensions isolated from shared core.
4. Client merges/cherry-picks upstream changes on a maintenance branch.
5. Check platform/configuration/component/action compatibility.
6. Apply migrations in client development first.
7. Run build, security, smoke and business regression tests.
8. Promote to client production only after client approval.
9. Record baseline version, client extension version, migrations and deployment commit.

Forks do not automatically receive upstream commits. Conflicts require review; do not promise automatic conflict-free updates.

## Part E — Customization and patch policy

- Prefer application configuration for labels, navigation, forms, views and component arrangement.
- Prefer isolated client extension modules for new domain behavior.
- Do not modify shared core for a one-client requirement unless the behavior is genuinely reusable.
- Patches to shared files are exceptional. Record base release, reason, affected files, tests and future rebase plan.
- Never put secrets or client production data in Git.

## Part F — Quality checks

- Vite production build and Worker syntax/build checks.
- Migration from an empty database and upgrade from prior supported schema.
- Repeatable seed/import checks.
- Schema compatibility validation.
- API authorization and sensitive-field tests.
- Core inventory/customer/sales/ledger regression tests for Imam Mobile.
- Health/bootstrap/list/form/action smoke tests.
- Secret scan and environment-target verification.
- Documented recovery/forward-fix notes.

## Acceptance criteria

- [ ] A clean client fork can be prepared without editing scattered source files.
- [ ] Client Pages, Worker and D1 names are configurable before first deployment.
- [ ] D1 ID and Worker binding are validated.
- [ ] No maintainer Cloudflare credentials are required.
- [ ] Secrets remain in the client's Cloudflare account.
- [ ] Development and production resources are isolated.
- [ ] Migration/deploy target is explicit and visible.
- [ ] Application seed can be installed/upgraded without overwriting client records.
- [ ] A second distinct application can be seeded primarily through configuration using the same runtime.
- [ ] Client extensions are isolated from shared core and have documented contracts.
- [ ] Upstream release adoption is documented and tested in client development.
- [ ] Production release requires explicit approval.
- [ ] Recovery/forward-fix process is documented and rehearsed.

## Definition of done

A developer can fork the repository into a separate account, configure client-specific Pages/Worker/D1 identifiers before first deployment, deploy using the client's own Cloudflare account, seed a working application and later adopt an upstream baseline release without overwriting client data or silently breaking configuration.

## Out of scope

One-click provisioning across arbitrary Cloudflare accounts using maintainer credentials, multi-tenant hosting, automatic conflict resolution and guaranteed zero-downtime migrations.

## Second-application proof and maintenance policy

After Stories 01–06, build one small, distinct operational application using the same runtime. Its identity, navigation, data sources, properties, standard lists, forms and views must be supplied by its own seed/configuration package. Ordinary CRUD must not require shared-core edits. At least one application-specific operation must use the documented extension contract. Install it into a clean development database, rerun its seed, and pass schema, authorization and workflow tests. Record configuration files, extension files, shared-core files (target zero for ordinary setup), migrations, tests, deployment result, implementation time and any blocker requiring a platform change. Use this evidence to decide whether Stories 07–08 need expansion.

Support the latest tagged stable baseline as the primary supported line. Publish release notes, migration notes and compatibility requirements. Older-version backports are not promised unless announced. A client fork is unverified until it reviews upstream changes, resolves conflicts, applies migrations in its own development environment, passes build/security/schema/business regression tests and records baseline/extension versions. No automatic conflict-free merges, indefinite old-version support, SLA or automatic production updates are promised. Production promotion requires explicit client approval.

## CI contract

CI targets pull requests into development and pushes to development. It must not deploy or migrate production. Add gates incrementally as each story introduces runnable checks: frontend production build, Worker build/typecheck, unit tests, empty-database migrations, seed idempotency, schema compatibility, API authorization/sensitive-field tests, and Imam Mobile regression tests. Do not claim checks that do not yet exist. Use npm ci only after the relevant lockfile is committed; until then use the currently supported install command and track lockfile creation as a gap. Any development deployment must identify its dev resources explicitly.

## Additional acceptance criteria

- [ ] A second distinct application passes the measurable reuse proof in Implementation Contracts.
- [ ] CI runs on development PRs and development pushes, not a stale feature branch trigger.
- [ ] CI never targets production resources.
- [ ] Lockfiles are committed before switching CI to npm ci.
- [ ] Baseline/extension versions and migration evidence are recorded for client upgrades.
