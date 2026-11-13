# Imam Mobile frontend

React + Vite interface for the Imam Mobile shop management project. Current project status: **Under development**.

## Run locally

Requires Node.js 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
npm run build
```

Build output: `frontend/dist`.

## Deploy on Cloudflare Pages

Connect this repository to Cloudflare Pages and set:
- Repository: `ImamSaahib/imam_mobile`
- Branch: `main`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

The existing root-level Worker files are not changed.

## Current preview features

- Dashboard stock counts for Pack/New and Used phones, including Available and Booked devices.
- Stock investment total based on purchase cost of in-stock devices.
- Customer positive ledger balance and overdue customer summary.
- Global hide/show control for dashboard financial values.
- Inventory filters and sorting; purchase cost is concealed in the list and uses press-and-hold reveal.
- Device, customer and ledger forms open in modals.
- Customer ledger entries include an optional due date.
- Sale workflow supports multiple Available or Booked devices, editable sale prices, walk-in or customer credit sales, stock status updates and printable receipt.
- Customer profile includes related ledger entries and a settlement action that creates a balancing entry without deleting history.

## Current limitations

The development frontend uses Worker APIs and persists inventory, customer, ledger and sales records in D1. The example arrays in App.jsx are legacy fixtures, not the current data source. The new metadata-driven shell is still pending, and real authentication and invoice-level payment allocation are not yet implemented. Development uses test data only.

Overdue status is currently an MVP estimate: a customer must have a positive balance under the existing `Total Credit - Total Debit` ledger formula and at least one past-due `Out (-)` entry. It does not yet allocate individual payments against individual invoices. This allocation should be implemented in the D1/API phase before relying on overdue totals for accounting decisions.

## Verification

Run `npm run check` for interaction unit tests, Vite build, and a conservative 300 KiB gzip JavaScript limit. Run `npm run test:browser` for shell browser interactions and screenshot artifacts; first install Chromium with `npx playwright install chromium`. CI runs both checks and retains artifacts for seven days.

## Planned next phase

Finish Story 00b (shell, Kumo wrappers and measured design tokens), then build metadata-driven navigation, lists, forms and configuration. Authentication follows the UI phase.

New platform helpers use TypeScript (D3). `npm test` compiles `src/platform` with strict checking into ignored `.test-build/` and runs the interaction tests against that output. `npm run typecheck` checks without emitting files. Rendered components and browser behavior have separate test suites.

Component tests: `npm run test:components` runs Vitest with Testing Library and jsdom against fixture-only requests. `npm test` runs helper and component suites. Use Node 22.22.2+, 24.15.0+ or 26+ (jsdom requirement). These DOM tests do not replace browser screenshots or responsive/accessibility verification.

Shared UI wrappers live in `src/platform/ui`; screens must use wrappers rather than importing Kumo. During `npm run dev`, open `/__ui` for the functional primitive gallery and theme switch. It is removed from production builds. The gallery is not yet a measured visual reference or complete component catalog.

Browser tests use only the `/__ui` fixture, block API calls and service workers, and save screenshots/traces under ignored `test-results/`. To use an installed browser locally, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable; CI uses pinned Playwright Chromium. Screenshots are review artifacts, not approved pixel baselines.

### Built published-navigation preview

`npm run build:platform-preview` explicitly includes the published shell at
`/__platform` and `/app/:applicationId/module/:moduleId`. `/` remains the existing
application. Set `VITE_API_BASE` to the verified development Worker before building.
The normal `npm run build` excludes this preview. This mode is for development
validation; it does not make the unfinished page bodies production-ready.

Run `npm run test:built-preview` after the preview build. It serves `dist` locally,
intercepts bootstrap with test metadata, and verifies direct routes and the ten-request
first-load budget. CI checks both the normal build and this preview mode. The imam-mobile-dev Pages project builds the development branch with this command and an explicit Dev API URL (configured 2026-11-14). The main-backed project remains unchanged.
