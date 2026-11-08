# Story 00 — UI Shell and Design System

**Status:** Ready for development  
**Priority:** P0 · **Depends on:** none (can run alongside Story 01) · **Unlocks:** Stories 02, 03, 05, 06, 07  
**Goal:** Build the reference interface shell and the shared UI primitives so that every later story reuses one design system.

## User story

As a developer, I need one shell and a set of shared primitives that match the reference interface, so navigator, pages, tables, forms and edit mode are built from the same components and look consistent.

## Reference

[UI Reference](../UI-REFERENCE.md) defines the layout, components and behavior. This story measures the design tokens from the reference and implements the shell and primitives. It uses placeholder content, not metadata.

## Scope

1. Record design tokens as CSS variables for light (default) and dark themes, measured from the reference.
2. Build the shell: left navigator region, top bar with a Super Menu placeholder, page area and a hidden reserved right-panel region. Navigator content comes from a fixed fixture until Story 02.
3. Build primitives:
   - buttons: primary, secondary pill, icon, destructive;
   - text input and search input with leading icon;
   - dropdown menu, popover, tooltip, dialog, side panel, badge, toast;
   - **context menu** that opens by right-click, the context-menu key and Shift+F10, and long press;
   - pagination;
   - table primitives: bordered container, sortable header cell, column settings control, row action cell, footer summary;
   - empty, loading and error states.
4. Evaluate `@cloudflare/kumo` (MIT, built on Base UI) for primitives. Record whether it provides what is needed, its dependencies and bundle size, and decide to adopt it, adopt part of it, or build the primitives. Do not use Cloudflare logos, wordmarks, icons or code from the dashboard.
5. Choose an open-source icon set and record its licence.
6. Accessibility baseline: visible focus, roles for navigation, menu, table and dialog, contrast, reduced motion.
7. Release 1 is single-language ([Decisions D19](../DECISIONS.md)). Use CSS logical properties as a low-cost habit. Right-to-left testing and translation are out of scope.
8. Add a development-only component gallery page and screenshot tests for each primitive in both themes.
9. Keep existing Imam Mobile screens working while styles move to the new tokens.

## Design constraints

- No business logic and no dependency on configuration metadata.
- No secrets in the bundle.
- Components accept data and callbacks through props so later stories can bind them to metadata.
- The context menu is rendered only by the shell service. Components supply actions; they do not render their own right-click menus.

## Acceptance criteria

- [ ] Design tokens are recorded and used by all new components.
- [ ] Shell layout matches the reference regions in light and dark themes.
- [ ] Navigator collapses into a drawer on narrow screens.
- [ ] Every primitive has default, hover, focus-visible, active, disabled and, where relevant, loading states.
- [ ] The context menu opens by mouse, keyboard and touch.
- [ ] ⌘K / Ctrl+K focuses quick search.
- [ ] Component gallery and screenshot tests exist for both themes.
- [ ] Kumo evaluation and icon-set licence are recorded.
- [ ] No Cloudflare logo, wordmark or copied asset is present.
- [ ] Existing Imam Mobile screens still work.
- [ ] No hard-coded left/right positioning in new styles.
- [ ] Initial JavaScript is at most 300 KB gzipped and first load makes at most 10 requests (Contracts §9). The size is checked in CI, and the Kumo and icon-set evaluations record their size cost.

## Tests

Screenshot comparison per primitive and theme; keyboard navigation; focus order; context menu parity (mouse, keyboard, touch); responsive breakpoints; reduced motion; build size check.

## Out of scope

Right-panel content, charts, grid virtualization, translations, metadata-driven rendering.
