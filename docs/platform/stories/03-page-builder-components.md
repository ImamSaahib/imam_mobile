# Story 03 — Application Navigator and Page Composition

**Priority:** P0 · **Depends on:** Stories 01–02  
**Goal:** Render application navigation and pages from metadata using a fixed, versioned component registry.

## User story

As an application administrator, I want to organize modules and compose pages from supported components so a related application can use the same runtime without custom navigation/page code.

## Scope

1. Build the left application navigator from published application/menu/module metadata.
2. Support multiple menus, ordered modules, icons, visibility and stable route keys.
3. Keep route identity independent from display title, slug and icon.
4. Render module pages from page/component metadata.
5. Implement a fixed component registry with versioned schemas and renderers.
6. Initial component types: heading/text, layout/container, list placeholder bound to a data source/view, form placeholder, KPI placeholder and registered action button placeholder.
7. Unknown component types or unsupported schema versions fail visibly and safely.
8. Preserve current visual direction: white default, dark theme support, responsive navigation, clean top bar and Super Menu.

## Dependency contracts

Lists/forms must bind through stable data-source/property identifiers, not guessed column labels. Their full behavior is implemented in Stories 05–06. Define the component data-binding contract here, but do not build an independent query or form engine.

## Acceptance criteria

- [ ] Navigator is loaded from published metadata.
- [ ] Applications, menus and modules are not hardcoded to Imam Mobile names.
- [ ] Route identity remains stable when a title is renamed.
- [ ] Modules can be reordered through metadata.
- [ ] Pages render registered components using validated configuration.
- [ ] Unsupported component types/schema versions produce a safe diagnostic state.
- [ ] Component configuration contains no executable JavaScript or SQL.
- [ ] Keyboard and mobile navigation are usable.
- [ ] Existing Imam Mobile routes remain reachable during migration.

## Tests

Navigator ordering; route stability; missing module; component registry validation; unknown component version; responsive navigation; bootstrap regression.

## Out of scope

Freeform canvas, arbitrary React injection, third-party component marketplace and advanced drag-and-drop editor.
