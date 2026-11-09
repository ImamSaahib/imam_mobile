# Deployment manifest

A non-secret description of one installation: environment name, Worker and Pages project names, and the permission mode. Added in Story 10. Secrets live only in Cloudflare secrets and are never committed.

Today the development Worker sets `ENVIRONMENT=development` and `AUTH_MODE=dev-open` in `backend/wrangler.toml`. Open access is valid only there (Decisions D7, D8). Do not copy these values to a Worker that serves real data.
