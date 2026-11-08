# Configurable Business Application Baseline

This directory is the source of truth for the product boundary, architecture, deployment model, and implementation backlog.

## Product direction

Build a reusable baseline for **related, small-to-medium internal operations applications with conventional relational data and known workflows**. Imam Mobile is the first reference application, not the permanent product boundary.

The baseline uses a **client-owned fork-and-deploy model**:
- The maintainer owns the upstream baseline repository.
- Each client forks it into an account they control.
- Each client owns their Cloudflare account, Pages project, Worker, D1 database, secrets and deployment.
- Client-specific differences are handled through configuration first, then isolated code extensions when needed.
- Clients adopt upstream releases on their own schedule.

This is not a multi-tenant SaaS design or a universal no-code platform.

## Design references

- ServiceNow: application navigator, modules, records, lists, forms and configuration.
- Notion: typed properties, database views, filters, sorting, grouping and relations.
- Cloudflare: restrained responsive interface and lightweight operations.

These are interaction references, not instructions to copy proprietary assets or code.

## Read in this order

1. [Architecture](ARCHITECTURE.md)
2. [Implementation Contracts](IMPLEMENTATION-CONTRACTS.md)
3. Story 01 — Platform foundation, design system and application identity
4. Story 02 — Application navigator and authorization integration
5. Story 03 — Page builder and component registry
6. Story 04 — Data model, properties and schema compatibility
7. Story 05 — Lists, views and safe query engine (MVP subset)
8. Story 06 — Forms, records and domain service extensions (MVP subset)
9. Story 07 — Configuration, validation and publishing
10. Story 08 — Reports, metrics and registered actions (post-MVP)
11. Story 09 — Authentication, authorization, audit and release compatibility
12. Story 10 — Client deployment, upgrades and release readiness

## Developer workflow

For each story:
1. Inspect the actual development branch and current implementation.
2. Read this architecture and the complete story.
3. Verify dependencies and existing business behavior.
4. Propose the smallest implementation plan.
5. Implement only the selected story on `development`.
6. Run build, migration, API, authorization and regression checks.
7. Deploy and verify only in development.
8. Record commit, evidence, migrations, limitations and recovery notes.

A story is not complete because its UI renders. Persistence, validation, failure handling, tests and development deployment evidence must pass. Authentication/authorization are deliberately implemented after the UI/UX phase in Story 09; no real multi-user production use is allowed before that release gate passes.

## Non-negotiable delivery rules

- All platform development starts on `development`.
- Do not change production branch `main` or production Cloudflare resources without explicit approval.
- Never run development migrations against production.
- Never edit an applied migration; add a new migration.
- Never commit credentials, API tokens, passwords, private keys or client secrets.
- Never embed secrets in Vite variables or browser bundles.
- Never store executable JavaScript, arbitrary SQL or expressions in configuration.
- Runtime users consume published configuration only.
- Physical database schema changes are controlled developer/deployment migrations, not ordinary live admin edits.
- Prefer configuration for client variation; use documented extension points for new behavior; avoid editing shared core for one client.
- Every story includes tests, migration impact, compatibility considerations and rollback/forward-fix notes.

## MVP sequencing and scope

**UI/UX and reusable runtime MVP:** Stories 01–07, delivered incrementally. Story 01 establishes the shared visual system. Story 03 introduces edit mode and the shared inspector early; Story 07 completes draft persistence, validation and publishing. Stories 05–06 initially deliver only conventional list/search/basic filters/sort/pagination and standard CRUD/forms/domain actions. Story 08 is post-MVP except for a small number of fixed KPIs needed to prove the first app. Story 09 is a mandatory release gate after the UI/UX phase and before real multi-user or production use. Story 10's quality, environment safety and recovery practices apply throughout.

**Early reuse checkpoint:** After Stories 01–04, configure a small second application using a separate seed, a distinct table and the same shell/page/component/property model. This is an early falsification test of the metadata model, not the final reuse proof. The full measurable proof remains after Stories 01–06 as defined in Implementation Contracts.

## Definition of success

The baseline is proven reusable when a developer can create a second, distinct related application using the same runtime and shared components, with navigation, data sources, typed properties, lists and forms defined primarily through a separate configuration/seed package. Code requirements must be isolated behind documented extension contracts.

See [Architecture](ARCHITECTURE.md) for deployment, schema, extension and upgrade contracts.
