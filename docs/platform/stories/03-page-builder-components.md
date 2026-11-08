# Story 03 — Page Builder and Component Registry

**Priority:** P0 · **Depends on:** Stories 01–02  
**Goal:** Render metadata-driven pages and introduce the platform's core in-app configuration experience from the first component implementation.

## User story

As an application administrator, I want to compose pages from supported components so related applications can reuse the same runtime without custom page code.

## Scope

1. Render module pages from page/component metadata.
2. Implement a fixed component registry with versioned configuration schemas.
3. Initial component types: heading/text, layout/container, list, form, KPI/count and registered action button.
4. Define stable data-source, view, form and action references using IDs/keys rather than labels or raw SQL.
5. Validate component configuration before publish and at runtime.
6. Provide safe diagnostics for unknown component types or unsupported schema versions.
7. Preserve responsive design, white default theme and dark mode support.
8. Keep client-specific component implementations in isolated extension modules, not shared core modifications where avoidable.
9. Introduce the global lock/edit mode and contextual Configure interaction for supported components.
10. Configure actions open one shared inspector/configuration panel with component-specific fields; do not create separate editors for each component.
11. Provide keyboard and touch equivalents to right-click/context-menu actions.

## Configuration interaction contract

Normal mode is the default and renders the published configuration. An administrator can enter edit mode through the Super Menu lock/edit toggle. In edit mode, selecting a component exposes contextual actions such as Configure, Move, Duplicate, Disable and Remove where supported. Right-click/context menu is an enhancement only; every action must also be available through visible controls and keyboard/touch interaction. Configure opens a single reusable inspector panel whose content is driven by the selected component's registered configuration schema. The panel is the shared editing surface; components do not implement unrelated bespoke editors. Draft persistence, validation and publishing lifecycle are completed in Story 07, but the component selection, edit affordances, panel contract and local draft interaction must be demonstrated here. The toggle is a UI mode, not an authorization boundary.

## Dependency contracts

Lists and forms bind through stable data-source/property identifiers. Their query and CRUD behavior is implemented in Stories 05–06. This story defines the renderer/binding contract, not separate list or form engines.

A component type has a stable type key, schema version, validated config shape and renderer implementation version. A configuration cannot reference a component version absent from deployed code.

## Acceptance criteria

- [ ] Pages render registered components from published metadata.
- [ ] Component types and configuration schemas are versioned.
- [ ] Component bindings use stable IDs/keys.
- [ ] Unsupported component types/schema versions fail visibly and safely.
- [ ] Configuration contains no executable JavaScript or SQL.
- [ ] Component registration cannot bypass authorization or data-source policies.
- [ ] Client-specific additions have an isolated extension contract.
- [ ] Edit mode can be entered and exited from the Super Menu.
- [ ] Configure on different component types opens the same inspector shell with schema-specific controls.
- [ ] Context actions have keyboard-accessible and touch-accessible alternatives.
- [ ] Edit mode does not expose executable code, SQL or unrestricted styling.
- [ ] Keyboard and mobile interaction remain usable.
- [ ] Existing Imam Mobile pages remain functional during migration.

## Tests

Component registry validation; unknown component version; invalid config; missing data binding; permission-aware rendering; responsive layout; legacy page regression.

## Out of scope

Full draft versioning/publish lifecycle (Story 07); freeform canvas, arbitrary React injection, third-party marketplace and unreviewed runtime plug-ins.
