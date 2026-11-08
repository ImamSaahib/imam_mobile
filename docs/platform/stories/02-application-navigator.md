# Story 02 — Application Navigator and Navigation Security

**Status:** Planned (waiting on dependencies)  
**Priority:** P0 · **Depends on:** Stories 00 and 01  
**Goal:** Render application navigation from metadata and ensure every navigation target is permission-checked by the backend.

## User story

As an application user, I want a configurable navigator with stable routes so different client applications can organize their modules without changing shared React code.

## Scope

1. Build left application navigator from published application/menu/module metadata.
2. Support multiple menus, ordered modules, icons, visibility and stable route keys.
3. Keep route identity independent from display title, slug and icon.
4. Support add, rename, reorder, disable and remove through metadata services. In edit mode these are available from the navigator context menu (Implementation Contracts §7). Authorization is enforced in the security phase.
5. Menus and modules shown to a user reflect their permissions. Until the security phase, every module is shown.
6. Define the permission each route will require, so direct URL navigation cannot bypass API authorization once the security phase enforces it.
7. Render the navigator, quick search and top bar with the Story 00 shell, following [UI Reference](../UI-REFERENCE.md) §2.
8. Define how routes remain stable across client configuration variants and upstream releases.
9. Quick search at the top of the navigator, focused by ⌘K / Ctrl+K, filtering menus and modules by name.
10. Menu presentation setting (expandable group or section label) and optional module badge text.

## Security contract

- The frontend may hide inaccessible navigation entries for usability, but the Worker remains authoritative.
- Every module/data API has an explicit permission requirement.
- Unknown routes and unauthorized routes produce distinct safe states.
- A route key is stable and not derived from a display label.
- No client-specific secret or authorization decision is embedded in the browser bundle.

## Acceptance criteria

- [ ] Navigator is loaded from published metadata.
- [ ] Applications, menus and modules are not hardcoded to Imam Mobile names.
- [ ] Route identity remains stable when a title is renamed.
- [ ] Modules can be reordered through authorized metadata operations.
- [ ] Users see only modules they are allowed to access. *(Deferred to the security phase.)*
- [ ] Direct URL/API access is denied when permission is absent. *(Deferred to the security phase.)*
- [ ] Navigator layout matches UI Reference §2 in light and dark themes.
- [ ] Quick search filters menus and modules and is focused by ⌘K / Ctrl+K.
- [ ] In edit mode, menus and modules can be added, renamed, reordered and removed from the context menu.
- [ ] Unknown and disabled routes show safe not-found/unavailable states.
- [ ] Keyboard and mobile navigation are usable.
- [ ] Existing Imam Mobile routes remain reachable during migration.
- [ ] Client configuration can change menu labels/order without changing route identity.

## Tests

Navigator ordering; route stability; role visibility; direct URL authorization; disabled module; missing module; responsive navigation; bootstrap regression.

## Out of scope

Freeform navigation designer, arbitrary route handlers and cross-client navigation.
