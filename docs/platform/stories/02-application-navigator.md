# Story 02 — Application Navigator

**Priority:** P0 · **Depends on:** Story 01  
**Goal:** Render a responsive application navigator from metadata, using the shared design system. Security enforcement is scheduled after the UI/UX phase.

## User story

As an application user, I want a configurable navigator with stable routes so different client applications can organize their modules without changing shared React code.

## Scope

1. Build left application navigator from published application/menu/module metadata.
2. Support multiple menus, ordered modules, icons, visibility and stable route keys.
3. Keep route identity independent from display title, slug and icon.
4. Support add, rename, reorder, disable and remove through the configuration interface introduced in Story 03.
5. Render the same navigation shell consistently across desktop, tablet and mobile.
6. Preserve white default theme, dark theme support, top bar, global search placeholder and Super Menu.
7. Define how routes remain stable across client configuration variants and upstream releases.

## Deferred security work

Authentication, authorization, permission filtering and protected direct-route behavior are implemented after the UI/UX phase. Keep stable route IDs and service boundaries so the later security story can enforce access centrally. Do not treat hidden navigation as security. No real multi-user production use is permitted before the security phase is complete.

## Acceptance criteria

- [ ] Navigator is loaded from published metadata.
- [ ] Applications, menus and modules are not hardcoded to Imam Mobile names.
- [ ] Route identity remains stable when a title is renamed.
- [ ] Modules can be reordered through authorized metadata operations.
- [ ] Navigation uses the shared design tokens and responsive shell.
- [ ] Security integration points are documented; authorization behavior is explicitly deferred.
- [ ] Unknown and disabled routes show safe not-found/unavailable states.
- [ ] Keyboard and mobile navigation are usable.
- [ ] Existing Imam Mobile routes remain reachable during migration.
- [ ] Client configuration can change menu labels/order without changing route identity.

## Tests

Navigator ordering; route stability; disabled module; missing module; keyboard navigation; responsive navigation; theme consistency; bootstrap regression.

## Out of scope

Freeform navigation designer, arbitrary route handlers and cross-client navigation.
