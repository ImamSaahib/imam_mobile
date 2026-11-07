# Story 07 — Configuration, Validation and Publishing

**Priority:** P1 after core runtime contracts · **Depends on:** Stories 01–06  
**Goal:** Provide a controlled administrator experience for supported metadata changes without treating configuration as a substitute for migrations or code deployments.

## User story

As an authorized application administrator, I want to edit supported application configuration in a draft, preview and validate it, then publish a compatible immutable release.

## Interaction model

- Normal mode is default.
- Top-right Super Menu contains the lock/edit toggle.
- Unlock is permission-gated; it is not a security boundary.
- Context menus/right-click may expose Configure, Duplicate, Move, Disable and Remove where supported.
- Keyboard-accessible and touch alternatives are mandatory.
- Admin Studio is not a normal navigator module.
- A global configuration workspace may be opened from the Super Menu.
- Draft edits are isolated from normal runtime users.

## Scope

1. Configure supported menus, modules, pages, component arrangements, labels, approved property presentation, forms and views.
2. Draft save, preview, validation, publish and release history.
3. Classify changes as configuration-only, migration-required or code-required.
4. Validate metadata references, component/property schema versions, action registrations, permissions and physical schema compatibility.
5. Record minimum platform version and required migration level on each release.
6. Restore a previous configuration by creating a new release; never erase history.
7. Prevent publishing incompatible configuration.

## Compatibility rules

- A release declares minimum supported platform and configuration schema versions.
- Component/property/action contracts must be supported by deployed frontend and Worker.
- A config-only rollback cannot reverse D1 schema migrations.
- If a schema migration is required, deploy compatible code/schema first, then publish metadata that depends on it.
- If runtime code is older than configuration, reject or enter a clear safe maintenance state; never silently render partially.

## Acceptance criteria

- [ ] Admin Studio is absent from normal navigation.
- [ ] Super Menu lock/edit toggle is permission-gated.
- [ ] Contextual and keyboard/touch configuration paths work.
- [ ] Draft changes persist and remain invisible to normal users.
- [ ] Validation detects broken references, unsupported schemas and missing physical columns.
- [ ] Validation identifies whether a change needs configuration only, migration or code.
- [ ] Publish creates an immutable version atomically.
- [ ] Failed publish leaves active release unchanged.
- [ ] Release records platform/config/schema compatibility requirements.
- [ ] Restore creates a new draft/release and does not claim to reverse migrations.

## Tests

Draft/published isolation; authorization; context menu parity; schema mismatch; unsupported component version; atomic publish failure; restore history; old runtime/new config compatibility.

## Out of scope

Real-time collaborative editing, freeform canvas, live admin database DDL and complex approval workflows.
