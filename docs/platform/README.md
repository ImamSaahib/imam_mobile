# Lightweight Configurable Application Platform

This directory is the source of truth for the platform architecture and its implementation backlog.

## Product direction

Imam Mobile is the first application built on the platform, not the platform's permanent product boundary. The platform must let an administrator compose applications from menus, modules (pages), reusable UI components, data tables, typed properties, and saved views without writing application-specific frontend code for each new module.

Design references:
- ServiceNow: application navigator, application/module hierarchy, records, lists, forms, and configuration experiences.
- Notion: typed database properties, reusable data sources, multiple views, filters, sorting, grouping, and relations.
- Cloudflare: compact, restrained, responsive visual design and operational simplicity.

These are references for interaction patterns, not instructions to copy proprietary assets or code.

## Read in this order

1. [Platform architecture](ARCHITECTURE.md)
2. [Story 01 — Platform foundation and metadata catalog](stories/01-platform-foundation.md)
3. [Story 02 — Applications, menus and modules](stories/02-application-navigator.md)
4. [Story 03 — Page builder and component registry](stories/03-page-builder-components.md)
5. [Story 04 — Data model and property engine](stories/04-data-model-properties.md)
6. [Story 05 — Database list and view engine](stories/05-list-view-engine.md)
7. [Story 06 — Form and record engine](stories/06-form-record-engine.md)
8. [Story 07 — Configuration mode and editors](stories/07-configuration-experience.md)
9. [Story 08 — Reports, metrics and actions](stories/08-reports-metrics-actions.md)
10. [Story 09 — Permissions, audit and publishing governance](stories/09-security-audit-publishing.md)
11. [Story 10 — Migration, testing and release readiness](stories/10-migrations-quality-release.md)

## How to use a story in a fresh developer chat

Paste the architecture document and the complete story file into the new chat. Ask the developer to:
1. inspect the current development branch and identify the actual implementation state;
2. compare it with the story's dependencies and acceptance criteria;
3. propose a minimal implementation plan;
4. implement only that story on `development`;
5. run the required checks and report evidence;
6. avoid changing production or silently expanding scope.

A story is not complete because its UI renders. Its acceptance criteria, API behavior, persistence, failure handling, tests, and migration requirements must all pass.

## Delivery rules

- All work starts on GitHub branch `development`.
- Production branch `main` and production Cloudflare resources must remain untouched until an explicitly approved release.
- D1 schema changes are additive, versioned migration files. Never edit an already-applied migration.
- Never store executable JavaScript or arbitrary SQL in platform configuration.
- Configuration changes use draft → validate → publish. Runtime reads published configuration only.
- Every story must include a migration plan, test evidence, and a rollback/mitigation note.
- Prefer the smallest implementation that satisfies the story. Do not introduce additional Cloudflare services without a demonstrated need.
