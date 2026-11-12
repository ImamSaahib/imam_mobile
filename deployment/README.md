# Deployment manifest

A non-secret description of one installation: environment name, Worker and Pages project names, and the permission mode. Added in Story 10. Secrets live only in Cloudflare secrets and are never committed.

Today the development Worker sets `ENVIRONMENT=development` and `AUTH_MODE=dev-open` in `backend/wrangler.toml`. Open access is valid only there (Decisions D7, D8). Do not copy these values to a Worker that serves real data.

## Development PR previews

Cloudflare runs `npx wrangler preview` for feature branches. `backend/wrangler.toml` explicitly defines `previews.vars` and `previews.d1_databases`, sharing only `imam-mobile-dev-db`. Previews can change shared test data; they must never bind production. `cd backend && npm run check:preview` validates the target using Wrangler. No preview migration command is added: schema changes require their documented deployment plan and existing development migration process.
