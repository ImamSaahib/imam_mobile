# Story 02 — Application Navigator and Navigation Security

**Priority:** P0 · **Depends on:** Story 01  
**Goal:** Render application navigation from metadata and ensure every navigation target is permission-checked by the backend.

## User story

As an application user, I want a configurable navigator with stable routes so different client applications can organize their modules without changing shared React code.

## Scope

1. Build left application navigator from published application/menu/module metadata.
2. Support multiple menus, ordered modules, icons, visibility and stable route keys.
3. Keep route identity independent from display title, slug and icon.
4. Support add, rename, reorder, disable and remove through metadata services, subject to authorization.
5. Ensure menus and modules shown to a user reflect their permissions.
6. Define route-level access behavior: direct URL navigation must not bypass API authorization.
7. Preserve current visual direction: white default, dark theme support, responsive navigation, clean top bar and Super Menu.
8. Define how routes remain stable across client configuration variants and upstream releases.

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
- [ ] Users see only modules they are allowed to access.
- [ ] Direct URL/API access is denied when permission is absent.
- [ ] Unknown and disabled routes show safe not-found/unavailable states.
- [ ] Keyboard and mobile navigation are usable.
- [ ] Existing Imam Mobile routes remain reachable during migration.
- [ ] Client configuration can change menu labels/order without changing route identity.

## Tests

Navigator ordering; route stability; role visibility; direct URL authorization; disabled module; missing module; responsive navigation; bootstrap regression.

## Out of scope

Freeform navigation designer, arbitrary route handlers and cross-client navigation.
