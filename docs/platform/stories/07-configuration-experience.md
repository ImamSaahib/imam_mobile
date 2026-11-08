# Story 07 — Edit Mode, Configuration Drafts and Publishing

**Status:** Planned (waiting on dependencies)  
**Priority:** P0 (the edit-mode contract is exercised from Story 03; this story completes the draft and publish workflow) · **Depends on:** Stories 00–06  
**Goal:** Provide edit mode as the way to build and change modules, with draft, validation and publishing, without treating configuration as a substitute for migrations or code deployments.

## User story

As a person building modules, I want to unlock the application, change menus, modules, components, properties and views by right-clicking them, validate the result, and publish a compatible immutable release.

## Interaction model

- Locked is the default. The interface shows the published release.
- The Super Menu at the top right contains the lock/edit toggle. Unlocked (lock disabled, editing enabled) is configure mode, which shows the working draft. All configuration happens only in configure mode ([Decisions C1](../DECISIONS.md)).
- There is no separate Admin Studio module.
- Right-click (and the context-menu key, Shift+F10 and long press) opens the context menu of the element under the pointer, with Configure and the actions that element supports.
- Configurable elements: navigator menus and modules, page components, table columns, views and forms.
- A draft bar shows the number of unpublished changes with Validate, Publish and Discard.
- A panel opened from the Super Menu shows release history, validation results and the schema change log. It contains no configuration editors, so Configure on the element is the only way to change configuration. This resolves the earlier "global configuration workspace" idea in favor of one interface.
- Draft edits are isolated from normal runtime users.
- Unlocking becomes permission-gated in the security phase. The toggle is not a security boundary.

## Scope

1. Navigator editing in edit mode: add, rename, reorder, disable and remove menus and modules.
2. Configure panels for page components, table columns (property configuration from Story 04), views and forms, using the descriptor contract (Implementation Contracts §7).
3. Draft save, preview, validation, publish and release history.
4. Classify each change as configuration-only, schema operation, migration-required or code-required.
5. Validate metadata references, component/property schema versions, action registrations, physical schema compatibility and, in the security phase, permissions.
6. Record minimum platform version and required migration level on each release.
7. Restore a previous configuration by creating a new release; never erase history.
8. Prevent publishing incompatible configuration.
9. Move the capabilities of the existing Admin Studio (`frontend/src/AdminStudio.jsx` and its admin endpoints) into edit mode, migrate stored configuration, then retire it.

## Compatibility rules

- A release declares minimum supported platform and configuration schema versions.
- Component/property/action contracts must be supported by deployed frontend and Worker.
- A config-only rollback cannot reverse D1 schema changes.
- If a schema change is required, apply it (schema change service or migration) before publishing metadata that depends on it.
- If runtime code is older than configuration, reject or enter a clear safe maintenance state; never silently render partially.

## Acceptance criteria

- [ ] There is no Admin Studio entry in the navigator.
- [ ] The Super Menu toggle switches between published view and draft view.
- [ ] Context menus work by mouse, keyboard and touch for every configurable element.
- [ ] Menus and modules can be added, renamed, reordered, disabled and removed in edit mode.
- [ ] Draft changes persist and remain invisible to normal users.
- [ ] The draft bar shows the change count and offers Validate, Publish and Discard.
- [ ] Validation detects broken references, unsupported schemas and missing physical columns.
- [ ] Validation identifies whether a change needs configuration only, a schema operation, a migration or code.
- [ ] Publish creates an immutable version atomically.
- [ ] Failed publish leaves the active release unchanged.
- [ ] Release records platform/config/schema compatibility requirements.
- [ ] Restore creates a new draft/release and does not claim to reverse schema changes.
- [ ] The existing Admin Studio capabilities are available in edit mode before it is retired.
- [ ] Toggle permission-gating is added in the security phase. *(Deferred.)*
- [ ] Publishing writes the snapshot and release rows only, and keeps the last 20 release snapshots ([Contracts §9](../IMPLEMENTATION-CONTRACTS.md)).
- [ ] Normal runtime requests never read draft rows or re-validate the whole configuration.
- [ ] Configure-mode drafts save changed items only, after a pause of at least 2 seconds, and never write per keystroke ([Contracts §10.6](../IMPLEMENTATION-CONTRACTS.md)).
- [ ] Publishing makes the new release version visible to the next request, and browsers holding the old version receive the new snapshot.
- [ ] In the Limit state, configure mode shows the reset time and keeps the unsaved draft in the browser until the write succeeds.

## Tests

Draft/published isolation; context menu parity; navigator editing; schema mismatch; unsupported component version; atomic publish failure; restore history; old runtime/new config compatibility; migration of stored configuration from Admin Studio.

## Out of scope

Real-time collaborative editing, freeform canvas, arbitrary DDL and complex approval workflows.
