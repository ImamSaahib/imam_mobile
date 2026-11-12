# Deployment manifest

A non-secret description of one installation: environment name, Worker and Pages project names, and the permission mode. Added in Story 10. Secrets live only in Cloudflare secrets and are never committed.

Today the development Worker sets `ENVIRONMENT=development` and `AUTH_MODE=dev-open` in `backend/wrangler.toml`. Open access is valid only there (Decisions D7, D8). Do not copy these values to a Worker that serves real data.

## Development PR previews

Cloudflare runs `npx wrangler preview` for feature branches. `backend/wrangler.toml` explicitly defines `previews.vars` and `previews.d1_databases`, sharing only `imam-mobile-dev-db`. Previews can change shared test data; they must never bind production. `cd backend && npm run check:preview` validates the target using Wrangler. No preview migration command is added: schema changes require their documented deployment plan and existing development migration process.

## Required delivery workflow (C9)

Main will be the stable client fork baseline after approved Phase 1 promotion. Story 10 must provide a coordinated manifest-driven install/upgrade workflow covering target validation, migrations, versioned configuration/seed promotion, Worker/Pages deployment and smoke checks. Preserve target records and customizations; never clone the development database into production. Initial client account authorization, secrets and resource identifiers are required inputs. This workflow is not implemented yet; do not treat merging development into main as sufficient to transfer D1 state. See Story 10 for acceptance and recovery requirements.
