# UI Reference — Interface Specification

**Status:** Target interface for the UI/UX phase  
**Source:** A screenshot of the Cloudflare dashboard D1 database page, supplied by the product owner. The screenshot is not stored in this repository because it shows account details. Keep any cropped reference images in a private location.

This document defines the layout, components and behavior the runtime interface must reproduce. Colors, sizes and spacing are not guessed here. Story 00 measures them from the reference and records them as design tokens.

## 1. Rules of use

- Reproduce the layout, proportions, spacing, component structure and interaction behavior of the reference.
- Do not use Cloudflare logos, wordmarks, icons, source code or other assets. The product uses its own name, mark and an open-source icon set.
- Cloudflare publishes an MIT-licensed React component library, Kumo (`@cloudflare/kumo`, built on Base UI). Story 00 evaluates it for primitives such as Button, Input and Dialog. Version 2.17.0 includes Sidebar, Table, Pagination, DropdownMenu, Dialog, Popover, Tooltip, Toast and a context menu primitive (Story 00 notes, 2026-11-09). It does not state that the Cloudflare dashboard uses it. Never use its Cloudflare logo component.
- The right-hand panel in the reference (usage figures and changelog) is out of scope. Reserve an empty, hidden region for it.
- Every element must work in a light theme (default) and a dark theme, and should use CSS logical properties instead of hard-coded left/right positions. Release 1 is single-language, and right-to-left testing is out of scope.

## 2. Layout regions

### 2.1 Left navigator

- Fixed width, full height. Collapses into a drawer on narrow screens.
- Top: application switcher showing the current application name with a chevron.
- Below it: a quick search field with a keyboard hint (⌘K on macOS, Ctrl+K elsewhere). It filters application menus and modules. Searching records across data sources is a later extension.
- Items show an icon, a label and, for groups, a chevron.
- An application menu is a collection of modules. It renders either as an expandable group with indented children, or as a section label above always-visible items. This is a menu setting.
- The selected module has a filled background. Hover and keyboard focus states are distinct from the selected state.
- Modules may show a small badge (for example "New" or "Beta"). Badge text is module metadata.

### 2.2 Top bar

- Right-aligned utilities: an optional help link and the **Super Menu** (user icon).
- The Super Menu contains the lock/edit toggle, theme selection, release information and, later, account actions.

### 2.3 Page area

Each module is a page. A page starts with a **page header**:

- Title (H1).
- Optional small outlined pill link beside the title (for example "View docs").
- Optional description line below the title.
- Optional primary action button aligned to the right (filled, brand color).

Components follow the header in the page layout.

### 2.4 Reserved right panel

Not built initially. The layout keeps room for it so adding it later does not change the page structure.

## 3. Table component

### 3.1 Toolbar

- A search field inside a bordered container: magnifier icon, placeholder text, and a refresh icon button at the end of the container.
- Search is part of every table. Configuration may disable it explicitly.
- Search is debounced and ignores stale responses.

### 3.2 Table body

- Bordered container with rounded corners.
- Header row with column labels. Sortable columns show a sort icon; clicking cycles ascending, descending and none.
- The last header cell holds a column settings control (gear). It opens a popover to show, hide and reorder columns.
- Cell styles: first column as a link-styled name that opens the record; identifiers in a monospace style that truncates with an ellipsis; numbers; plain text.
- A row action button ("…") at the end of each row opens a row menu (open, edit, duplicate, archive and registered actions, depending on configuration).

### 3.3 Footer

- Left: result summary in the form "Showing 1–2 of 2".
- Right: pagination controls: first, previous, current page, next, last. Disabled controls are visibly dimmed. Pagination is cursor-based ([Contracts §10.3](IMPLEMENTATION-CONTRACTS.md)), so the current page number is approximate and jumping to an arbitrary page is not offered.
- A discreet banner above the table appears only when the resource governor is in the Essential or Limit state, with plain text and the reset time. It never shows an error code.

### 3.4 States

Loading, empty, no results for the current search or filters, error with retry, and (in the security phase) permission denied. Each has distinct text and layout.

## 4. Buttons and inputs

| Element | Appearance |
|---|---|
| Primary button | Filled with the brand color, used once per page header for the main action |
| Secondary pill button | Outlined, small, rounded; used for links such as "View docs" |
| Icon button | Square or round, icon only, tooltip and accessible label required (refresh, row actions, column settings) |
| Pagination button | Icon buttons with disabled state |
| Text input | Bordered, with leading icon variant for search |

All buttons define default, hover, focus-visible, active, disabled and loading states.

## 5. Behavior requirements

- Keyboard: ⌘K / Ctrl+K focuses quick search; arrow keys move through navigator items; Enter on a sortable header sorts; the context-menu key or Shift+F10 opens the context menu.
- Touch: long press opens the context menu in edit mode; targets are at least 44 px.
- Accessibility: visible focus, correct roles for navigation, menu, table and dialog, sufficient contrast, reduced-motion support.
- Responsive: the navigator becomes a drawer; tables scroll horizontally inside their container; the page header wraps.

## 6. Mapping to platform concepts

| Reference element | Platform concept |
|---|---|
| Sidebar group or section | Application menu |
| Sidebar item | Module (a page) |
| Page header | Page header component |
| Bordered table with toolbar and footer | Table (list) component bound to a data source and a view |
| Column settings gear | View column visibility and order |
| Row action menu | Row actions: record operations and registered action keys |
| Primary header button | Action button component bound to a registered action or form |
| User icon in the top bar | Super Menu |

## 7. Edit-mode appearance

When the lock/edit toggle is unlocked (see [Architecture §5.2](ARCHITECTURE.md)):

- Configurable elements show an outline on hover.
- The navigator shows controls to add, rename, reorder and remove menus and modules.
- A draft bar appears with the number of unpublished changes and the actions Validate, Publish and Discard.
- Right-click (or the keyboard and touch equivalents) opens the context menu for the element under the pointer.
- Table column headers expose property configuration in addition to view operations.

## 8. Design tokens to record in Story 00

Colors (background, surface, border, text, muted text, brand, danger, focus ring) for both themes; font family, sizes and weights; spacing scale; border radius; border widths; sidebar width; top bar height; table row and header height; control heights; shadow and elevation; z-index layers; breakpoints. Store them as CSS variables.
