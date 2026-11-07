# Story 03 — Page Builder and Component Registry

**Priority:** P0 · **Depends on:** Stories 01–02  
**Goal:** Render pages from metadata using a fixed, versioned component registry and stable data-binding contracts.

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
- [ ] Keyboard and mobile interaction remain usable.
- [ ] Existing Imam Mobile pages remain functional during migration.

## Tests

Component registry validation; unknown component version; invalid config; missing data binding; permission-aware rendering; responsive layout; legacy page regression.

## Out of scope

Freeform canvas, arbitrary React injection, third-party marketplace and unreviewed runtime plug-ins.
