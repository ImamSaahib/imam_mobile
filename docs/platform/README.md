# Configurable Business Application Baseline

This directory is the source of truth for the product boundary, architecture, deployment model, and implementation backlog.

## Product direction

Build a reusable baseline for **related, small-to-medium internal operations applications with conventional relational data and known workflows**. Imam Mobile is the first reference application, not the permanent product boundary.

The baseline is distributed using a **client-owned fork-and-deploy model**:

- The maintainer owns the upstream baseline repository.
- Each client forks the repository into an account they control.
- Each client owns their Cloudflare account, Pages project, Worker, D1 database, secrets, and deployment.
- Client-specific differences are handled through configuration first, then isolated code extensions when necessary.
- Clients can adopt upstream releases on their own schedule.

This is not a multi-tenant SaaS design and does not promise universal no-code customization.

## Design references

- ServiceNow: application navigator, modules, records, lists, forms, and configuration experience.
- Notion: typed properties, database views, filters, sorting, grouping, and relations.
- Cloudflare: restrained responsive interface and lightweight operations.

These are interaction references, not instructions to copy proprietary assets or code.

## Read in this order

1. [Architecture](ARCHITECTURE.md)
2. Story 01 — Platform foundation and application identity
3. Story 02 — Authentication, authorization and tenant boundary
4. Story 03 — Application navigator and page composition
5. Story 04 — Data model, properties and schema compatibility
6. Story 05 — Lists, views and safe query engine
7. Story 06 — Forms, records and domain service extensions
8. Story 07 — Configuration, validation and publishing
9. Story 08 — Reports, metrics and registered actions
10. Story 09 — Client deployment and baseline distribution
11. Story 10 — Quality, migrations, upgrades and release readiness

## Developer workflow

For each story:
1. Inspect the actual development branch and current implementation.
2. Read this architecture and the complete story.
3. Verify dependencies and existing business behavior.
4. Propose the smallest implementation plan.
5. Implement only the selected story on `development`.
6. Run build, migration, API, authorization and regression checks relevant to the change.
7. Deploy and verify only in the development environment.
8. Record commit, evidence, migrations, limitations and recovery notes.

A story is not complete because its UI renders. Persistence, authorization, validation, failure handling, tests and deployment evidence must pass.

## Non-negotiable delivery rules

- All platform development starts on `development`.
- Do not change production branch `main` or production Cloudflare resources without explicit approval.
- Never run development migrations against production.
- Never edit a migration already applied to an environment; add a new migration.
- Never commit credentials, API tokens, passwords, private keys or client secrets.
- Never embed secrets in Vite variables or browser bundles.
- Never store executable JavaScript, arbitrary SQL or expressions in application configuration.
- Runtime users consume published configuration only.
- Physical database schema changes are controlled developer/deployment migrations, not ordinary live admin edits.
- Prefer configuration for client variation; use documented extension points for new behavior; avoid editing shared core for one client.
- Every story includes tests, migration impact, compatibility considerations and rollback/forward-fix notes.

## Definition of success

The baseline is proven reusable when a developer can create a second, distinct related application using the same runtime and shared components, with its navigation, data sources, typed properties, lists and forms defined primarily through a separate configuration/seed package. Any code required must be isolated behind a documented extension contract.

See [Architecture](ARCHITECTURE.md) for the deployment, schema, extension and upgrade contracts.
