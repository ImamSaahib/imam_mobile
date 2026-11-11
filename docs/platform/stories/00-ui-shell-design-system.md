# Story 00 — UI Shell and Design System

**Status:** In progress (slice 00a: evaluation done; tokens and shell remaining)  
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
- [x] Kumo evaluation and icon-set licence are recorded. *(Slice 00a, see notes.)*
- [ ] No Cloudflare logo, wordmark or copied asset is present.
- [ ] Existing Imam Mobile screens still work.
- [ ] No hard-coded left/right positioning in new styles.
- [ ] Initial JavaScript is at most 300 KB gzipped and first load makes at most 10 requests (Contracts §9). The size is checked in CI, and the Kumo and icon-set evaluations record their size cost.

## Tests

Screenshot comparison per primitive and theme; keyboard navigation; focus order; context menu parity (mouse, keyboard, touch); responsive breakpoints; reduced motion; build size check.

## Out of scope

Right-panel content, charts, grid virtualization, translations, metadata-driven rendering.

## Implementation notes

### Slice 00a — Kumo and icon-set evaluation (2026-11-09)

**Method.** Installed `@cloudflare/kumo` 2.17.0 in a scratch project that matches the frontend (React 18.3, Vite 6), read its component documentation with its own CLI (`npx @cloudflare/kumo doc <Component>`), measured the gzip size of each component with production builds, and rendered a demo page in light and dark mode with Playwright. Evidence is in [`../evidence/`](../evidence/): `00a-kumo-demo-light.png`, `00a-kumo-demo-dark.png` and `00a-kumo-demo.jsx`.

**Findings**
- **Licence:** MIT. The package is published by Cloudflare. Phosphor Icons (`@phosphor-icons/react` 2.1.10) is MIT. The frontend's current `lucide-react` is ISC.
- **Components present:** Sidebar (groups with labels, collapsible menus, badges, icon-only collapse, mobile sheet), Table (header, body, footer, checkbox cells, sticky columns, resize handle), Pagination (full or simple controls, page size, and a mode for an unknown total with `hasNextPage`, which suits our cursor pagination), Input and InputGroup, Button, DropdownMenu, Popover, Dialog, Tooltip, Toast, Badge, Tabs, Command palette, Banner, Empty state, Loader, Select, Checkbox, Switch, Breadcrumbs, Date picker, Chart. A context menu is available as a Base UI primitive (`@cloudflare/kumo/primitives/context-menu`). This corrects [UI Reference §1](../UI-REFERENCE.md), which said table and sidebar components were unconfirmed.
- **Do not use:** the `cloudflare-logo` component, and any Cloudflare mark. Rule unchanged.
- **Styling:** a standalone CSS build (`@cloudflare/kumo/styles/standalone`) works without Tailwind. Dark mode uses the `data-mode="dark"` attribute on the root element. About 230 semantic tokens use `light-dark()`, so a theme can be changed by overriding variables. The default brand color is orange (`#f6821f`) and the primary button rendered blue in the demo, so brand tokens will be set by us.
- **Peer dependencies:** `react`, `react-dom` and `@phosphor-icons/react` are required. `zod` and `echarts` are optional. The package also depends on `motion`, `shiki`, `d3-geo`, `react-day-picker` and Base UI, but granular imports tree-shake what is unused.
- **Accessibility:** built on Base UI primitives, which provide keyboard handling and ARIA roles. Our accessibility tests in this story still have to verify this for the pieces we use.
- **Visual match:** the demo (sidebar group with active item and badge, search field with a refresh button, bordered table with a settings gear and row action, "Showing 1-2 of 2" with first/previous/next/last) matches the reference layout described in UI Reference §2–§3 closely. No console errors in either theme. Exact colors, sizes and spacing still need to be checked against the reference image.

**Bundle cost (gzip, production build, granular imports; React 18 alone is 46.1 kB)**

| Added alone | Total JS | Added over React |
|---|---|---|
| Button | 94.7 kB | 48.6 kB |
| Input | 102.6 kB | 56.5 kB |
| Table | 108.0 kB | 61.9 kB |
| Sidebar | 107.9 kB | 61.8 kB |
| Pagination | 132.1 kB | 86.0 kB |
| DropdownMenu | 114.5 kB | 68.4 kB |
| Popover | 101.0 kB | 54.9 kB |
| Dialog | 82.9 kB | 36.8 kB |
| Tooltip | 92.1 kB | 46.0 kB |
| Toast | 75.2 kB | 29.1 kB |
| Context menu primitive | 98.5 kB | 52.4 kB |

Shared code is counted in each row, so the rows do not add up. All of Button, Input, Table, Sidebar, Pagination, DropdownMenu, Popover, Dialog, Tooltip, Badge, Tabs, Toast and the context menu together: **188.2 kB gzip JS (about 142 kB over React) plus 23.2 kB gzip CSS**. Without Pagination: 173.2 kB. The demo page (Sidebar, Table, Input, Button, Badge, Pagination): 157.5 kB JS.

The current application is about 78 kB gzip in total (JS 62.8, Admin Studio chunk 7.7, CSS 7.7), including React. Replacing its hand-written primitives with the full Kumo set would give an estimated **240–250 kB gzip**, under the 300 KB budget but leaving about 50 kB of room. Mitigations: granular imports only, load the dialog, toast, date and chart pieces lazily, and run the size check in CI from the first Kumo import.

**Decision (D20, see [Decisions](../DECISIONS.md))**
1. Adopt Kumo for primitives: Button, Input, Table, Sidebar, Pagination, DropdownMenu, Popover, Dialog, Tooltip, Toast, Badge, Tabs, and the context menu primitive.
2. Wrap each Kumo piece in our own thin component under a single folder, so screens never import Kumo directly and a piece can be replaced without touching them.
3. Use Phosphor icons for all new UI, because Kumo requires it and shipping a second icon set costs size. Keep `lucide-react` only for legacy screens until they move to the new shell, then remove it.
4. Start our design tokens as aliases of Kumo's semantic tokens, with our brand color overrides. Do not guess numeric values.
5. Re-check the budget when the shell is built (slice 00b) and again at the Story 07 phase review.

**Open**
- **Design tokens (scope item 1) are not measured yet.** The reference screenshot is not stored in the repository because it shows account details. The original image was received privately on 2026-11-12. Measure colors, row heights, sidebar width and spacing in slice 00b, accounting for screenshot scale; the token file is still pending.
- Frontend test tooling (Vitest with Testing Library) for component and screenshot tests, shared with Story 01.
- Slice 00b: shell, remaining primitives, our context-menu service, gallery and screenshot tests.

### Original reference received — 2026-11-12

The owner supplied the original Cloudflare D1 dashboard screenshot privately. The missing-image dependency is resolved; measurement and acceptance verification remain open. Follow UI-REFERENCE, prioritize application navigation and table/search controls, exclude the right panel, and keep the original out of Git. No visual acceptance box is marked complete by receipt alone.
