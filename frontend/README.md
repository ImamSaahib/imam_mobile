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

## Important limitations

All records are React in-memory preview data. Changes are lost on page reload and are **not** stored in Cloudflare D1. No API, authentication, payment gateway or production-grade accounting allocation has been implemented yet.

Overdue status is currently an MVP estimate: a customer must have a positive balance under the existing `Total Credit - Total Debit` ledger formula and at least one past-due `Out (-)` entry. It does not yet allocate individual payments against individual invoices. This allocation should be implemented in the D1/API phase before relying on overdue totals for accounting decisions.

## Planned next phase

Implement the D1 schema and Worker API, including transactional sale/ledger writes and proper invoice-level payment allocation. Authentication and role-based access follow after the data layer is stable.
