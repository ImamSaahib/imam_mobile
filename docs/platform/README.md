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
- Cloudflare: restrained responsive interface and lightweight operations. The target layout, table and controls are specified in [UI Reference](UI-REFERENCE.md).

These are interaction references, not instructions to copy proprietary assets or code.

The product is an environment for building, customizing and extending modules inside the running application, not one business application. Edit mode (the lock/edit toggle in the Super Menu) is the only place configuration is changed; see [Architecture §5.2](ARCHITECTURE.md) and [Decisions C1](DECISIONS.md).

## Product delivery phases

**Product Phase 1** delivers all twelve existing stories (00–11), the application’s primary functionality. Complete them quickly with quality in the documented dependency order. The owner will test the integrated application after Phase 1 development is complete, then create new stories for **Product Phase 2**. The current stories do not define the full future product scope.

Focus on implementation and required quality checks. Defer optional improvements and unrelated side work unless needed for an existing requirement or blocker. Update story progress, acceptance evidence, TIMELINE and HANDOFF in each implementation slice. Developer testing and development verification continue throughout; owner testing at the phase boundary does not replace them. See [Decision C8](DECISIONS.md).

### Implementation stages within Product Phase 1

1. **UI/UX and platform (Stories 00–07).** The runtime, the interface, edit mode and publishing. Authorization is designed but not enforced: routes declare their required permission and call one placeholder policy function ([Decisions D7](DECISIONS.md)). These environments hold test data only.
2. **Security (Story 11).** Authentication and authorization replace the placeholder. Real data is allowed only after this phase passes.
3. **Operations (Stories 08–10).** Reports, governance and release readiness. Practices from Story 10 apply from Story 01.

## Agent entry point

Start at [HANDOFF](../HANDOFF.md). [Agent workflow](../AGENT-WORKFLOW.md) defines task-specific reading, document ownership and validation checkpoints. Read architecture/decisions/contracts on initial onboarding, then relevant sections and the active story during continuation. [TIMELINE](../TIMELINE.md) owns dependency order; story files own acceptance and progress evidence.

Development runs directly on development under C10. No routine feature branches or PRs. Follow the automatic deployment process; do not manually deploy Workers or apply remote migrations.

## Non-negotiable delivery rules

- All platform development starts on `development`.
- Do not change production branch `main` or production Cloudflare resources without explicit approval.
- Never run development migrations against production.
- Never edit an applied migration; add a new migration. The developer process is in [MIGRATIONS.md](MIGRATIONS.md).
- Never commit credentials, API tokens, passwords, private keys or client secrets.
- Never embed secrets in Vite variables or browser bundles.
- Never store executable JavaScript, arbitrary SQL or expressions in configuration.
- Runtime users consume published configuration only.
- Physical database schema changes go through the platform schema change service (add property, add index, presentation conversions) or developer migrations (new tables, constraints, data-rewriting conversions). Arbitrary DDL and SQL supplied by a person or by configuration are never accepted. See [Architecture §7.3](ARCHITECTURE.md).
- Stay within the resource budget in [Implementation Contracts §9](IMPLEMENTATION-CONTRACTS.md). Each story reports measured rows read and written for its main operations.
- No deployment that runs the placeholder policy (`AUTH_MODE=dev-open`) holds real client data or serves production traffic until Story 11 passes in that environment.
- Prefer configuration for client variation; use documented extension points for new behavior; avoid editing shared core for one client.
- Every story includes tests, migration impact, compatibility considerations and rollback/forward-fix notes.

## MVP sequencing and scope

**UI/UX and reusable runtime MVP:** Stories 01–07, delivered incrementally. Story 00 establishes the shared visual system. Story 03 introduces edit mode and the shared inspector early; Story 07 completes draft persistence, validation and publishing. Stories 05–06 initially deliver only conventional list/search/basic filters/sort/pagination and standard CRUD/forms/domain actions. Story 08 is post-MVP except for a small number of fixed KPIs needed to prove the first app. Story 11 is a mandatory release gate after the UI/UX phase and before real multi-user or production use. Story 10's quality, environment safety and recovery practices apply throughout.

**Early reuse checkpoint:** After Stories 01–04, configure a small second application using a separate seed, a distinct table and the same shell/page/component/property model. This is an early falsification test of the metadata model, not the final reuse proof. The full measurable proof remains after Stories 01–06 as defined in Implementation Contracts.

## Definition of success

The baseline is proven reusable when a developer can create a second, distinct related application using the same runtime and shared components, with navigation, data sources, typed properties, lists and forms defined primarily through a separate configuration/seed package. Code requirements must be isolated behind documented extension contracts.

See [Architecture](ARCHITECTURE.md) for deployment, schema, extension and upgrade contracts.
