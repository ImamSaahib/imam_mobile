# Story 03 — Page Builder and Component Registry

**Status:** Planned (waiting on dependencies)  
**Priority:** P0 · **Depends on:** Stories 00–02  
**Goal:** Render pages from metadata using a fixed, versioned component registry and stable data-binding contracts.

## User story

As an application administrator, I want to compose pages from supported components so related applications can reuse the same runtime without custom page code.

## Scope

1. Render module pages from page/component metadata.
2. Implement a fixed component registry with versioned configuration schemas.
3. Initial component types: page header (title, optional help pill link, description, optional primary action), heading/text, layout/container, table (list with embedded search), form, KPI/count and registered action button. Reports arrive in Story 08.
4. Define stable data-source, view, form and action references using IDs/keys rather than labels or raw SQL.
5. Validate component configuration before publish and at runtime.
6. Provide safe diagnostics for unknown component types or unsupported schema versions.
7. Preserve responsive design, white default theme and dark mode support.
8. Keep client-specific component implementations in isolated extension modules, not shared core modifications where avoidable.
9. Every component type registers a configure descriptor (Implementation Contracts §7): configuration schema, configure panel and context actions. In edit mode, right-click, the context-menu key, Shift+F10 and long press open the same menu.
10. Configure opens one shared inspector panel driven by each component's registered configuration schema. Components do not implement separate editors. Every context action is also reachable through visible controls, keyboard and touch.
11. A page contains components only and cannot embed another page in release 1 ([Decisions D6](../DECISIONS.md)). Tabs and sections use the container component. Validation rejects a page reference inside a page.

## Configuration interaction contract

Normal mode renders the published release. The Super Menu lock/edit toggle enters configure mode ([Architecture §5.2](../ARCHITECTURE.md)). Selecting a component exposes Configure, Move, Duplicate, Disable and Remove where supported. Right-click is an enhancement: every action is also available through visible controls, keyboard and touch. Draft persistence, validation and publishing are completed in Story 07; component selection, edit affordances, the inspector contract and local draft interaction are demonstrated here. The toggle is a user-interface state, not an authorization boundary.

## Dependency contracts

Lists and forms bind through stable data-source/property identifiers. Their query and CRUD behavior is implemented in Stories 05–06. This story defines the renderer/binding contract, not separate list or form engines.

A component type has a stable type key, schema version, validated config shape and renderer implementation version. A configuration cannot reference a component version absent from deployed code.

## Acceptance criteria

- [ ] Pages render registered components from published metadata.
- [ ] Component types and configuration schemas are versioned.
- [ ] Component bindings use stable IDs/keys.
- [ ] Unsupported component types/schema versions fail visibly and safely.
- [ ] Configuration contains no executable JavaScript or SQL.
- [ ] Component registration cannot bypass authorization or data-source policies. *(Enforcement is deferred to the security phase.)*
- [ ] Every component type has a configure descriptor and its context menu works by mouse, keyboard and touch.
- [ ] The page header component matches UI Reference §2.3.
- [ ] Validation rejects a page embedded inside a page.
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
