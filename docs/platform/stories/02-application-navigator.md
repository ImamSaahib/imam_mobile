# Story 02 — Applications, Menus, and Modules

**Priority:** P0 · **Depends on:** Story 01  
**Goal:** Make the left navigator data-driven and configurable.

## User story

As an administrator, I want to create applications, group modules into application menus, and rename, reorder, hide, or remove those items so the left navigator reflects the application I am building.

## Domain rules

- An application belongs to a workspace.
- An application menu belongs to an application and is a collection of modules.
- A module belongs to exactly one application and optionally one menu; it points to a page.
- Menu and module labels, icons, order, visibility, and route are metadata.
- A module is not a data table. A module opens a page.
- Deleting a menu must require an explicit policy: move its modules to an ungrouped section, reassign them, or delete them only after confirmation. Never cascade-delete pages/records accidentally.
- Route identifiers remain stable when a title is renamed.

## Scope

1. Replace hardcoded sidebar arrays with the Story 01 bootstrap hierarchy.
2. Build navigator rendering for applications, collapsible menus, modules, active states, icons, ordering, and responsive mobile navigation.
3. Add configuration CRUD for application menus and modules.
4. Support create, rename, reorder, enable/disable, and delete with reference checks.
5. Add an application switcher only if more than one application exists; do not fabricate empty applications.
6. Preserve direct URL navigation and unknown-route handling.

## API

- `GET /api/applications`
- `POST /api/applications`
- `PATCH /api/applications/:id`
- `POST /api/applications/:id/menus`
- `PATCH /api/menus/:id`
- `DELETE /api/menus/:id`
- `POST /api/menus/:id/modules`
- `PATCH /api/modules/:id`
- `DELETE /api/modules/:id`
- `POST /api/navigator/reorder` accepting an ordered list of IDs and parent scope.

All mutation endpoints require configuration permission, validate same-application ownership, and write audit events. Reordering should be one transaction/batch where practical.

## UI requirements

- Left side resembles a compact ServiceNow-style application navigator.
- Application menus are section headers/collections; modules are links beneath them.
- Search filters applications, menu names, and module labels without mutating the saved hierarchy.
- Provide clear empty state, no-results state, active module state, and keyboard navigation.
- In normal mode, navigator is used for navigation. In configuration mode, provide add/edit/reorder controls without making normal navigation difficult.
- Rename is inline or in a focused dialog; avoid browser prompt dialogs.

## Acceptance criteria

- [ ] Navigator is rendered entirely from published metadata.
- [ ] Admin can add, rename, reorder, hide/show, and remove a menu.
- [ ] Admin can add, rename, reorder, hide/show, and remove a module.
- [ ] Renaming a module does not change its route or break bookmarks.
- [ ] A module cannot reference a page from another application/workspace.
- [ ] Removing a menu cannot silently delete modules or pages.
- [ ] Search is immediate and case-insensitive.
- [ ] Normal users cannot see draft-only changes.
- [ ] Mobile navigation remains usable.
- [ ] Existing Imam Mobile modules are migrated/seeded and still open correctly.

## Tests

Test menu/module CRUD, reorder validation, deletion constraints, duplicate route/slug handling, workspace isolation, search, active route, and permission failures.

## Out of scope

Page composition, component editors, and role administration.
