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

Run `npm run check` for interaction unit tests, Vite build, and a conservative 300 KiB gzip JavaScript limit. Browser and screenshot tests remain pending.

## Planned next phase

Finish Story 00b (shell, Kumo wrappers and measured design tokens), then build metadata-driven navigation, lists, forms and configuration. Authentication follows the UI phase.

New platform helpers use TypeScript (D3). `npm test` compiles `src/platform` with strict checking into ignored `.test-build/` and runs the interaction tests against that output. `npm run typecheck` checks without emitting files. Component and browser tests remain pending.

Component tests: `npm run test:components` runs Vitest with Testing Library and jsdom against fixture-only requests. `npm test` runs helper and component suites. Use Node 22.22.2+, 24.15.0+ or 26+ (jsdom requirement). These DOM tests do not replace browser screenshots or responsive/accessibility verification.
