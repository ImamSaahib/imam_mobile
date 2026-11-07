# Story 07 — Configuration Mode and Contextual Editors

**Priority:** P0 · **Depends on:** Stories 02–06  
**Goal:** Replace the separate Admin Studio destination with a coherent lock/unlock configuration experience.

## User story

As a platform administrator, I want to unlock configuration mode, right-click platform elements to configure them, and publish reviewed changes without exposing editing controls to normal users.

## Interaction model

- Top-right Super Menu contains a lock/edit toggle.
- Normal mode is the default and shows no editor chrome.
- Unlock is permission-gated; lock state is only a UI mode, never a security control.
- Right-clicking a component opens a contextual menu with Configure, Duplicate, Move, Disable, and Remove actions as supported.
- Right-clicking a table column/property opens Configure property.
- Provide equivalent keyboard-accessible menus and explicit configure buttons for touch devices; context menu cannot be the only access path.
- The editor opens in a side panel or focused modal and preserves the current page context.
- A global configuration workspace is accessible through Super Menu, but Admin Studio is not a normal application module.
- Changes edit a draft. Toolbar shows unsaved/saved draft state and Publish action.
- Publish validation reports errors with links to the affected module/component/property.

## Scope

1. Integrate current Admin Studio capabilities into configuration mode; remove its sidebar module.
2. Implement contextual targeting for menus, modules, pages, components, table columns, and properties.
3. Add editors backed by the metadata schemas from earlier stories.
4. Draft save, validation preview, publish, version history and rollback.
5. Preview draft in a safe isolated preview mode without making it visible to normal users.
6. Prevent accidental exit with unsaved changes; confirm discard.
7. Responsive configuration experience for desktop and tablet; mobile may use explicit menus/panels rather than right-click.

## API

- `GET /api/configuration/draft`
- `PUT /api/configuration/draft`
- `POST /api/configuration/validate`
- `POST /api/configuration/publish`
- `GET /api/configuration/versions`
- `POST /api/configuration/versions/:version/restore` creates a new draft based on that snapshot.

Publishing is server-side and atomic: validate all metadata references and schemas, persist immutable release snapshot, then switch active published version. If any step fails, previous published version remains active.

## Acceptance criteria

- [ ] Admin Studio is not shown as a normal sidebar module.
- [ ] Lock/unlock is visible in the top-right Super Menu.
- [ ] Locked mode does not show configure affordances.
- [ ] Unlocked mode offers contextual configuration for all supported element types.
- [ ] Right-click and keyboard/touch alternatives work.
- [ ] Draft edits survive reload and are not visible to normal users.
- [ ] Validation catches missing pages, broken bindings, invalid property types, and unsupported component config.
- [ ] Publish creates a new immutable version.
- [ ] Failed publish leaves current published version unchanged.
- [ ] Restore creates a new draft/version path; history is not deleted.
- [ ] Authorization is enforced by API regardless of UI lock state.

## Tests

Permission gating; context target resolution; keyboard/touch parity; unsaved-change warning; draft/published isolation; invalid config validation; atomic publish failure; restore history.

## Out of scope

Collaborative real-time editing, visual drag-drop freeform canvas, per-field approval workflows.
