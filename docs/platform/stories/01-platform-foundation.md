# Story 01 — Platform Foundation, Design System and Application Identity

**Priority:** P0 · **Depends on:** none · **Unlocks:** Stories 02–10  
**Goal:** Establish the persistent metadata foundation, stable application identity, shared visual design system, seed contract and runtime boundaries.

## User story

As a maintainer, I need a minimal metadata foundation so the same runtime can load different application seed packages without hardcoded Imam Mobile navigation or labels.

## Scope

1. Inspect current D1 schema, Worker routes and existing Imam Mobile workflows before changing anything.
2. Define stable IDs and a minimal metadata catalog for application identity, menus/modules, pages/components, data sources/properties, views/forms and configuration releases.
3. Separate deployment identity from in-app application identity. A client fork/deployment is an installation boundary; the seeded business application is configuration inside that installation.
4. Add a bootstrap API returning the active published application shell and supported platform/configuration versions.
5. Seed current Imam Mobile experience as metadata without replacing business records or domain endpoints.
6. Define repeatable, versioned seed packages. Initial seed and upgrade seed are distinct operations.
7. Add metadata-to-physical-schema compatibility inspection.
8. Establish the shared visual design system and reusable UI primitives before feature screens are built.
9. Define security integration points and route-policy inventory only; implement authentication and authorization after the UI/UX foundation is complete.
10. Document which metadata is shared runtime core and which is application-specific.

## Design constraints

- Start with the minimum catalog needed for the first real workflow.
- Do not create a large cross-client workspace/tenant subsystem; each fork/deployment is its own installation boundary.
- Use stable opaque IDs; labels, slugs and routes are not identity.
- Do not put business records in generic EAV storage.
- Do not store executable scripts or arbitrary SQL in metadata.
- Seed reruns must not duplicate rows or overwrite client edits/data.
- Physical schema changes require developer-controlled migrations.

## Visual design system ownership

Story 01 owns the platform-wide design system. Define documented design tokens and reusable primitives before feature UI work: typography scale, spacing scale, page/container widths, grid and responsive breakpoints, surface/background/border/text/status colors, radii, elevation, focus/hover/disabled states, and light/dark themes. The visual direction is inspired by Cloudflare Dashboard: restrained, high-contrast, information-dense, consistent and responsive; do not copy proprietary assets. Establish shared patterns for application shell, page headers, buttons, inputs, selects, dialogs, side panels, tabs, badges, empty/loading/error states, and data tables. Stories 02–08 must use these primitives rather than inventing local styles. Document accessibility requirements, keyboard focus, touch targets and mobile behavior.

This story defines and implements the shared tokens/primitives only. Feature-specific page composition belongs to the owning story.

## API and persistence

Define Worker repository/service boundaries. At minimum provide bootstrap/read access and a controlled seed mechanism. Exact SQL names may be finalized after inspecting existing migrations, but logical entities and ownership boundaries in Architecture are required.

Every metadata record must have an explicit application/global scope. Include version fields and timestamps where needed. Existing migrations are immutable; add new numbered migrations.

## Acceptance criteria

- [ ] Existing Imam Mobile records and workflows remain intact.
- [ ] Bootstrap loads the application shell from published metadata, not hardcoded React arrays.
- [ ] Application identity is distinct from deployment/client identity.
- [ ] Stable IDs are independent of display names and route labels.
- [ ] Seed package can be applied twice without duplicate rows or data loss.
- [ ] Seed package declares version and minimum supported platform/configuration version.
- [ ] Schema compatibility check reports missing/incompatible mapped tables and columns.
- [ ] Incompatible metadata is not silently accepted.
- [ ] API routes and services expose clear policy integration points, but no production authentication/authorization implementation is required in this UI/UX phase.
- [ ] Shared design tokens and core primitives are documented and used by the shell.
- [ ] Worker metadata SQL is behind service/repository boundaries.
- [ ] Development migration and tests pass; production remains untouched.

## Tests

Empty-database migration; repeatable seed; bootstrap response; stable IDs; legacy data regression; schema mismatch fixtures; invalid metadata; route-policy inventory; migration ordering.

## Out of scope

Authentication/authorization implementation (scheduled after UI/UX stories); full visual editor, arbitrary table/column creation, multi-tenant shared hosting, marketplace, workflow engine and advanced reports.

## Seed ownership and upgrade contract

Every seeded configuration item must carry a stable seed key, package owner, ownership state, last-applied upstream version and baseline value/hash. Business records are never seed-managed. Initial install and repeated application must be idempotent. Upgrades use a three-way comparison (previous upstream, new upstream, current installed value): apply upstream changes only when the client has not changed that item; preserve client-owned values; and flag simultaneous changes as conflicts without overwriting them. Preview additions, updates, conflicts, deprecated items and incompatible references before applying. Resolve conflicts per item and audit the actor/choice. Mark removed items deprecated rather than hard-deleting referenced configuration. Never overwrite client data, secrets or extensions.

## Additional acceptance criteria

- [ ] Seed items have stable keys and explicit seed/client ownership.
- [ ] Upgrade preview and three-way conflict detection are defined before upgrade automation is considered complete.
- [ ] Repeated install and interrupted/retried application are safe.
- [ ] Client-owned items and business records are never overwritten by upstream seed updates.
- [ ] Seed reset-to-upstream-default is an explicit, auditable operation.
