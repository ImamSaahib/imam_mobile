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
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

The existing root-level Cloudflare Worker files are not changed.

## Current status: Under development

The current UI includes separate list and form views for:
- Mobile devices (one record per device, unique IMEI, calculated display price)
- Customers (Regular / Account types and calculated ledger balances)
- Customer entries (In (+) / Out (-), customer relation and optional device relation)

The current records are in-memory preview data only. They are not persisted to a database and will reset when the page reloads. The next planned phase is Cloudflare D1 schema and API integration, followed by UI polish and authentication.
