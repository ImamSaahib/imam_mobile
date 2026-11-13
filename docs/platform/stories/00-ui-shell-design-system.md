# Story 00 — UI Shell and Design System

**Status:** In progress (00b fixture shell, navigation, table and context menu implemented; toast, side panel and shared resource states implemented; measured tokens recorded and applied to shell, navigator and table; primitive-state acceptance, dark-theme calibration and runtime integration open)
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

Dated evidence below is historical. Start with the consolidated status and latest context-menu section; earlier screenshot/build blockers are resolved. Acceptance criteria above remain the completion gate.

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
- **Design tokens (scope item 1): measured 2026-11-13, see the entry below.** Originally not measured: The reference screenshot is not stored in the repository because it shows account details. The original image was received privately on 2026-11-12. Measure colors, row heights, sidebar width and spacing in slice 00b, accounting for screenshot scale; the token file is still pending.
- Frontend test tooling (Vitest with Testing Library) for component and screenshot tests, shared with Story 01.
- Slice 00b: shell, remaining primitives, our context-menu service, gallery and screenshot tests.

### Slice 00b-preflight — interaction tests and CI (2026-11-12)

**Built:** Reusable keyboard shortcuts, context-menu positioning and long-press input helpers; working ⌘K/Ctrl+K focus on existing search; 12 dependency-free Node tests; and CI test/build/300 KiB gzip JS gate. Updated outdated frontend README. No backend, D1 or production changes. Resource cost: zero D1 reads/writes.

**Verification:** `cd frontend && npm run check` (run by Development CI). This is a prerequisite, not completed Story 00b. Full Kumo wrappers, visual tokens and shell, central context menu, gallery, Vitest/Testing Library, screenshot and browser request tests remain pending. The screenshot is not in GitHub, so exact visual values were not guessed.

### Preflight review follow-up (2026-11-12)

PR #3 remains unmerged. Its GitHub Actions run 43098394510 is completed/failure, while both jobs report queued with no runner or steps; the downloaded log archive is empty. Both Pages previews succeeded. The development Worker build 37f3fc81-bedb-429a-b90e-50a0f4f59e6c failed, but its error is not included in GitHub checks; Cloudflare dashboard access currently requires sign-in. No deployment configuration fix is justified without that log. PR #4 was reviewed: its distinction between unmerged work and the development baseline is accurate; its historical CI observations remain applicable. Neither PR is cleared for merge by this review.

D3 correction: new UI interaction helpers now use TypeScript with strict compilation before the existing Node tests; Vite consumes the same source. Legacy screens are not converted in this slice. Validation on Node 26: frontend 12/12 tests, production build, total JavaScript 69.0 KiB gzip; backend type check and 283/283 tests in 18 files. CI uses Node 22 and must still pass independently. No browser regression, screenshot or first-load request-count claim is made. Context-menu helpers remain unconnected to a shared shell, and the shortcut currently focuses legacy record search, not the future navigator filter. All remaining Story 00 acceptance boxes stay open.

No migrations or backend changes; this slice adds zero D1 reads/writes. Recovery: revert the TypeScript conversion and tooling commit. Next: obtain the Worker log and build settings, resolve the CI scheduling failure, then add frontend component tests and Kumo wrappers; exact tokens still require the private reference screenshot.

### Slice 00b component-test baseline — 2026-11-12

Adopted Vitest 4.1.12, Testing Library React 16.3.3/user-event 14.6.10 and jsdom 31.0.0 for rendered component regressions (D10). The existing Node helper tests remain. npm run check now executes both suites before the production build and size gate. Tests render the actual legacy App with only in-memory fixtures, reject unexpected requests, and cover Ctrl+K/Command+K focus, inventory navigation/filtering and listener cleanup. No deployed API or business data is used. Dependencies are development-only; production assets are unchanged.

Validation: 12 helper tests and 4 rendered tests passed; production build and 69.0 KiB total gzip JS gate passed on Node 26. jsdom requires Node 22.22.2+, 24.15.0+ or 26+; CI selects current Node 22. CI verification for this slice remains pending. Backend code and schema are unchanged; previous backend validation remains 283 passing tests. No migration, D1 reads/writes or manual deployment. Recovery: revert this test-only slice.

Deployment investigation: PR #5 GitHub frontend-build and worker-checks passed on commit 753a449; both Pages previews passed. Worker build still failed. Wrangler deployment-history reads succeed, but the documented Cloudflare Builds detail/log API returns HTTP 403/code 12004 with Wrangler OAuth. Owner is arranging Workers CI Read access. No build cause is asserted and PR #3 remains unmerged. The original visual reference was received privately; the screenshot blocker is resolved, measurements remain pending (direction recorded in PR #6).

Acceptance: Story 00 remains in progress. These component tests do not verify screenshot appearance, responsive layout, all legacy workflows or mouse/keyboard/touch context-menu parity. Next bounded slice: shared Kumo wrappers and their interaction tests, followed by measured shell regions; complete deployment diagnostics when access is ready.

### Worker preview build fix — 2026-11-12

Confirmed from Cloudflare build 37f3fc81-bedb-429a-b90e-50a0f4f59e6c: dependency installation succeeded, then npx wrangler preview failed because wrangler.toml lacked previews vars and a D1 binding. Build-log access is now working through a private API credential; no credential is stored in Git.

Added explicit preview development vars and the existing test-only imam-mobile-dev-db binding. Previews share development data; they are isolated from production, not from each other. No new database, remote migration or manual deploy. Schema-changing branches require a separate migration plan. A Wrangler-parsed configuration guard runs in backend check and GitHub CI and pins the approved dev target. Cloudflare’s normal PR build must verify deployment before merge. See https://developers.cloudflare.com/workers/previews/resources/#d1-migrations.

Story 00 acceptance remains open. Recovery is a normal revert of the preview configuration; no database rollback is needed for this configuration-only change.

### Original reference received — 2026-11-12

The owner supplied the original Cloudflare D1 dashboard screenshot privately. The missing-image dependency is resolved; measurement and acceptance verification remain open. Follow UI-REFERENCE, prioritize application navigation and table/search controls, exclude the right panel, and keep the original out of Git. No visual acceptance box is marked complete by receipt alone.

### Slice 00b — first shared Kumo primitives (2026-11-12)

Added typed Button, IconButton and TextInput wrappers under frontend/src/platform/ui using the evaluated Kumo 2.17.0 and Phosphor 2.1.10 versions. Button defaults to type=button to avoid accidental form submits; IconButton requires an accessible label. Added a development-only /__ui gallery with light/dark switching, disabled/loading/destructive examples, controlled input and fixture callbacks. Gallery uses Kumo defaults; no measured shell/token fidelity is claimed. Existing screens retain their components until the shell slice.

Verification: strict TypeScript, 12 input-helper tests plus 10 rendered tests, production build and 69.0 KiB gzip JS gate passed. New tests cover keyboard activation, non-submitting defaults, disabled/loading suppression, icon naming, controlled text and theme/action fixtures. Gallery is removed by the production DEV guard, so this size is not the future Kumo runtime cost; remeasure on integration. Screenshots, responsive behavior, tooltip coverage, reduced motion and full shell acceptance remain pending. No D1 reads/writes or migrations. Recovery: revert this primitive slice.

PR #7 is merged into development, containing the earlier #3/#5 work and verified preview fix. Pending #4/#6 documentation branches were merged into this feature branch with conflicts resolved, preserving owner direction and refreshing the handoff baseline. This slice does not mark Story 00 complete. Next: measured shell regions, navigator fixture and search, then remaining Kumo wrappers and shell-owned context-menu service.

### Slice 00b — fixture navigator interactions (2026-11-12)

Added typed shared Navigator with caller-provided application name, groups/modules, selected module and selection callback. Kumo Sidebar supplies presentation; Phosphor supplies chevrons. Supports expandable groups, section labels, badges, selected-page semantics, case-insensitive menu/module filtering, no results, Escape clearing, Ctrl/Command+K and arrow/Home/End movement. Search reveals collapsed matches and preserves collapse state when cleared. The development gallery exercises fixtures without metadata or API calls.

Verification: frontend npm run check passes: strict TypeScript, 12 helper + 14 rendered tests (26 total), production build and 69.0 KiB gzip gate. Tests cover callbacks, selected state, group/module filtering, collapse restoration, empty results, keyboard movement, shortcuts and listener cleanup. jsdom explicitly stubs desktop matchMedia; no responsive/browser evidence is claimed. Legacy App tests pass. No backend/schema changes or D1 operations.

Story 00 remains open. Kumo sizing is provisional, not measured reference fidelity. Next: responsive fixture shell with application switcher/top bar, browser/reference validation, remaining primitives and context-menu service. Navigator remains development-only. Recovery: revert this slice.

### Slice 00b — responsive fixture shell (2026-11-12)

Built a typed Shell with caller-supplied application/module selection, page header/action slot, application switcher, Super Menu theme/release controls, desktop navigator, modal mobile drawer and hidden reserved panel. Configuration is explicitly unavailable until its story. Kumo Dialog provides modal focus containment/restoration; menu portals inherit the shell theme. Button now forwards refs for composed triggers. Gallery styles and service-worker registration are isolated from legacy screens.

Validation: 26 helper/component tests, strict TypeScript, production build and 69.1 KiB gzip JS gate; 3 Playwright Chromium scenarios cover light/dark desktop menus and selection, shortcuts, mobile focus cycling, Escape/search clearing, close/selection focus restoration, reduced-motion mode and viewport resize. Screenshots inspected for light/dark and mobile layout; browser testing caught and fixed centered-dialog translation, clipped header content and missing menu group context. CI now runs the browser suite and retains screenshots/traces for seven days. Artifacts are review evidence, not approved pixel-diff baselines. No backend changes or D1 operations.

Tokens: semantic aliases reference Kumo background, border, text, spacing, typography. Navigator width 256px and breakpoint 768px use documented Kumo defaults; 44px minimum navigation/control targets come from UI-REFERENCE accessibility requirements. Exact screenshot scale and token calibration remain open. Dark states use Kumo semantics. No Cloudflare assets used.

Acceptance remains partial: drawer, shortcut and shell regions are verified in the fixture; production runtime integration, all-primitive states/screenshots, table controls, context-menu parity, request budget and exact visual matching remain open. Next cohesive slice: table/search/column controls with fixture behavior. Recovery: revert this shell slice; no database rollback.

### Slice 00b — controlled table and fixture interactions (2026-11-12)

Added typed DataTable with Kumo table/popover/menu primitives: search/refresh, tri-state sorting with aria-sort, column visibility/reordering (at least one stays visible), link-style names, identifier truncation, row open action, summary and first/previous/next/last controls. Page labels and opaque cursor tokens come from the caller; no arbitrary page jumping. Added distinct loading, error/retry, empty and no-match states. Shared useTableResource debounces and aborts requests and ignores late responses even if a loader ignores cancellation. Callers provide stable loader/request identities.

The gallery loader is an in-memory three-record fixture, with cursor-style callbacks only; it does not implement a runtime database adapter. Runtime loaders must implement Contract 10.3 keyset/reverse queries and derive approximate page labels from the cursor trail. No metadata/API dependency, persisted view settings, filtering language or business writes are introduced.

Evidence: 32 helper/component tests, four Chromium scenarios, strict TypeScript, production build and 69.1 KiB gzip gate. New tests cover sort cycles, search resetting pagination, last/previous navigation, column reorder/hiding, row actions, loading/error/retry/empty states and out-of-order responses. Browser checks cover mobile horizontal containment and dark-mode table interactions; screenshots inspected. Production bundle unchanged because the gallery is development-only. No backend changes, D1 calls, migrations or manual deploys.

Story 00 stays open: exact measured tokens, all-primitive screenshot baselines and states, shell context-menu parity, remaining primitives and runtime integration are pending. Next cohesive slice: central context-menu service and remaining overlay/state primitives. Recovery: revert the table slice; no database rollback.

### 2026-11-13 — Shell context-menu service

The shell renders one Kumo/Base UI menu from target descriptors. Fixture edit mode gates mouse, ContextMenu/Shift+F10 and touch-hold activation. Touch movement cancels opening; disabled actions cannot run. Normal elements and editable inputs retain native context behavior. Closing restores target focus (or shell focus after removal), removing the target closes the menu, and callbacks re-check the latest descriptor and target connection. Base UI handles viewport collision and menu keyboard navigation.

Validation: 32 unit/component tests, strict TypeScript, build/69.1 KiB gate and seven Chromium scenarios. Context scenarios cover mouse/keyboard activation, Escape/focus restoration, locking, disabled actions, synthetic touch hold/movement cancellation, ordinary/editable targets, bottom-edge collision and target removal. Synthetic touch coverage is not a physical-device validation claim. Existing shell/table browser regressions remain covered.

PR #12 targets development. Story 00 remains open: exact visual calibration, full primitive states/screenshot baselines, remaining overlays and runtime integration. No backend/schema/data changes. Recovery: revert the context-menu slice. Next: remaining shared overlay/state primitives as one cohesive slice.

### Consolidated status — 2026-11-13

All completed slices through context-menu lifecycle handling are merged into development. Implemented: Kumo/Phosphor evaluation, typed primitives, responsive fixture shell/navigation, application/theme menus, table/search/sort/columns/cursor controls and states, shell-owned context menu. Validation baseline: 32 unit/component tests, seven browser scenarios, TypeScript/build and 69.1 KiB gzip gate; last feature commit passed all five remote checks. Still open: remaining shared overlay/state primitives, exact measured visual tokens, full primitive states/screenshot baselines, physical touch validation, runtime integration and first-load request budget. Story is not complete; continue directly on development under C10.

### 2026-11-13 — Shared confirmation dialog

Added a typed Kumo confirmation dialog with caller-supplied action, pending-state duplicate/dismissal prevention, plain failure feedback and retry. Gallery reset action exercises it without business writes. Validation: 33 unit/component tests, TypeScript, build and unchanged 69.1 KiB budget pass; targeted Chromium scenario verifies cancel/focus restoration and confirmation in dark mode. Existing unrelated browser cases are left to the final CI gate rather than rerun locally. No backend/schema changes. Recovery: revert this slice. Story 00 remains open; next shared pieces are toast/side-panel/state coverage, followed by visual calibration and runtime integration.

### 2026-11-13 — Shared side panel

Verified Development CI run 43305943027 succeeded for 8639b3a. Added a typed Kumo modal side panel with caller-owned content, theme inheritance, logical positioning and narrow-screen containment; the gallery exercises an editable field. Validation: TypeScript, 33 helper/component tests, build and 69.1 KiB gzip gate passed; two Chromium scenarios passed for light/dark mobile containment, Escape and close-button focus restoration. No backend, schema or D1 impact. Recovery: revert this slice. Toast/shared state coverage, visual calibration and runtime integration remain open.

### 2026-11-13 — Toast notifications

Added a typed notification provider/hook around Kumo, with portals inside the themed boundary and a gallery example. Frontend check passed: TypeScript, 33 helper/component tests, build and unchanged 69.1 KiB gzip gate. Four targeted Chromium scenarios passed for toast appearance/focus preservation/expiry and side-panel dismissal/containment in both themes. No backend, migration or D1 impact. Recovery: revert this overlay slice. Shared state coverage, screenshot acceptance and calibration remain open; these components are not yet integrated into the deployed runtime.

### 2026-11-13 — Shared resource states and overlay batch validation

Extracted loading, empty, no-results and error/retry presentation into ResourceState and reused it in DataTable and the gallery. Existing component tests verify state transitions, stale-row removal and retry callbacks. Final batch validation: TypeScript, 33 helper/component tests, all 12 Chromium scenarios, production build and 69.1 KiB gzip gate passed. Includes the side-panel and notification changes above. No backend/schema/D1 impact. Recovery: revert the shared overlay/state batch. Exact visual calibration, approved screenshot baselines, complete primitive-state acceptance and runtime integration remain open.

### 2026-11-13 — Reference structure refinement

Moved the navigator search icon and keyboard hint into the search field. Reduced table cell vertical padding while preserving 44px controls, and replaced alternating row fills with surface backgrounds and row separators to follow the original reference structure. Uses existing semantic/spacing tokens; no exact screenshot-to-CSS scale claim. Validation: TypeScript, 33 tests, build/69.1 KiB gate and four affected Chromium scenarios passed; light/dark screenshots inspected. Prior overlay/state commit 5f278d0 passed Development CI run 43389402873. No backend/schema/D1 impact. Recovery: revert this styling slice. Full measured-token and primitive-state acceptance remains open.

### 2026-11-13 — Icon tooltip and primitive accessibility evidence

Shared IconButton now supplies a Kumo tooltip from its required accessible label, with a themed portal. Added light/dark reduced-motion browser scenarios for visible tooltip, disabled controls, side-panel focus cycling/restoration and resource error semantics, plus primitive/panel screenshot captures. TypeScript, 33 tests, build/69.1 KiB gate passed; 12 existing browser scenarios passed and both new scenarios passed after correcting the test to inspect Kumo’s visible popup rather than assuming a separate tooltip role. Screenshots are evidence, not approved baselines. No backend/schema/D1 impact. Recovery: revert this slice.

### 2026-11-13 — Measured design tokens (light theme)

Measured the private reference (3566x1632 px at 2x scale, so a 1783x816 CSS px viewport; 1 CSS px borders measure 2 device px; error about 1 CSS px) by scanning pixel boundaries and glyph heights, then rendered the gallery at the same viewport and compared with the same scans. The screenshot is not committed. Tokens are in `frontend/src/platform/ui/tokens.css`, each with its source value; shell, navigator, page header, search field and table styles consume them.

| Token | Measured | Before (Kumo default) |
|---|---|---|
| Navigator width | 251 px (250 + border) | 260 px |
| Top bar height | 49 px | 77 px |
| Page padding | 32 px | 32 px (kept) |
| Search field / primary button height | 38 px | 44 px |
| Table header and body row | 44 px | 52 px |
| Toolbar container | 8 px wider than the table per side, 26 px above the table | 16 px gap, not wider |
| Radii | table and field 8, toolbar 12, button 6, quick search 8 (measured 7, 11, 6, 7) | 12 |
| Title | 20 px, cap height 14.5 px (equal to the reference) | 24 px |
| Light colors | background #fbfbfb, surface #ffffff, border #e3e3e3, field border #d6d6d6, selected item #f3f3f3, text #171717, muted #737373, placeholder #a1a1a1 | Kumo values |
| Primary button | #277aff fill, #045ede border; Kumo's default already matches, no override | same |

Changes: search is now one bordered field with the leading icon and the refresh button inside it (as in the reference), inside the wider toolbar container. The top bar, rows, controls and navigator width use the tokens. Touch-first contexts (`pointer: coarse` or narrow screens) keep 44 px targets through `--im-touch-target`, so fine pointers use the reference sizes (UI-REFERENCE section 5 is preserved). Dark theme has no reference, so dark values stay on Kumo semantics and are validated visually only. Font family cannot be measured from pixels and stays on Kumo's. Kumo sets the sidebar width on its own wrapper, so the token is passed through the provider `style`.

Validation: TypeScript, 12 helper and 29 component tests, build and 69.2 KiB gzip gate pass; all 16 Chromium scenarios pass; desktop light and dark and a 390 px touch render were inspected, and measured sizes confirmed (rows 44 px, search 38 px, navigator items 34 px on desktop; search 44 px and rows 45 px on touch). Navigator header (same day): the application switcher is now a borderless 49 px row whose bottom border lines up with the top bar border (measured at the same y as the reference), with the quick search 12 px below at a visible height of 34 px (Kumo's input ring adds 1 px per side, so the token is 32 px). Kumo's extra divider under the search is removed as the reference has none. Navigator item pitch already matched (35 px). The new platform styles contain no hard-coded left/right positioning (grep of `ui/*.css` and `ui/*.tsx`); this is not yet checked in an RTL render, so that acceptance item stays open.

Remaining differences: the reference places the account switcher at the top of the sidebar with a different chevron treatment and quick-search inset (6 px left, 15 px right, which looks like a scrollbar gutter, so it is not copied), pagination button dimensions, icon sizes, exact font metrics and the unmeasured dark theme. Screenshots are evidence, not approved baselines. No backend, schema or D1 impact. Recovery: revert this styling commit.
