# Imam Mobile frontend

React + Vite starter interface for the Imam Mobile shop management project.

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

## Current status

This is a frontend prototype. Dashboard figures, products, customers and transactions are sample data. Actions that need backend operations show a preview notice and do not create or update records.

Next: choose and connect the database, then add authenticated API endpoints and replace the sample data with live records.
