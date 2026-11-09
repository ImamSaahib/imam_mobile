# Legacy Inventory and Removal Plan

**Recorded:** 2026-11-09, Story 01 slice 01b · **Decisions:** D2, D8, D13 · **Status:** inventory complete, removal not started

This inventory covers the Admin Studio and the configuration backend that existed before the platform work. It lists what exists, how it behaves today (pinned by `backend/test/legacy-admin.test.ts`), what the platform replaces it with, and when it is removed. Production on `main` holds no real data (Decisions C4), so nothing here needs a data migration for production. The development database must be checked before the old tables are dropped.

## Backend routes

| Route | Guard today | Declared permission | Behavior | Replaced by | Removed in |
|---|---|---|---|---|---|
| `GET /api/configuration` | none, edge-cached `public, max-age=60, s-maxage=300` | `configuration.read` | Returns published configuration JSON and version | Bootstrap release snapshot with version header (Story 01c, D13) | Story 07 cut-over |
| `GET /api/admin/configuration` | shared bearer token | `configuration.configure` | Returns draft, published and version | Draft service (Story 07) | Story 07 |
| `PUT /api/admin/configuration` | token | `configuration.configure` | Saves one JSON blob as the draft, 100,000 character cap | Normalized drafts with validation (Story 07) | Story 07 |
| `POST /api/admin/configuration/publish` | token | `configuration.configure` | Copies the draft to published, version +1, history row | Atomic release publish (Story 07) | Story 07 |
| `GET /api/admin/configuration/versions` | token | `configuration.configure` | Last 20 versions | Release history (Story 07) | Story 07 |
| `POST /api/admin/configuration/restore` | token | `configuration.configure` | Copies a version into the draft | Restore a release as a draft (Story 07) | Story 07 |
| `GET /api/admin/schema` | token | `schema.inspect` | Lists application tables, columns and indexes, last 50 changes | Schema compatibility inspection (Story 01c) and schema service (Story 04) | Story 04 |
| `POST /api/admin/schema/columns` | token | `schema.change` | `ALTER TABLE ADD COLUMN` live, no preview | Schema change service with preview and log (Story 04) | Story 04 |
| `POST /api/admin/schema/add-column` | token | `schema.change` | Older duplicate of the route above | Schema change service (Story 04) | Story 04 |
| `POST /api/admin/schema/indexes` | token | `schema.change` | Creates or drops `idx_*` indexes live | Schema change service (Story 04) | Story 04 |
| `GET /api/custom-field-values` | none | `customFields.read` | Reads metadata values and physical columns for a record | Properties as real columns (Story 04) | Story 04 |
| `POST /api/custom-field-values` | none | `customFields.write` | Writes up to 50 values, to the table column or to `custom_field_values` | Normal record updates (Story 06) | Story 04 |

The shared token is the `ADMIN_CONFIG_TOKEN` Worker secret. Story 11 removes it and every route that depends on it.

## Tables

| Table | Purpose | Plan |
|---|---|---|
| `app_configuration` | One row with draft and published JSON | Replaced by normalized configuration plus immutable release snapshots (D1). Dropped after Story 07 cut-over. |
| `configuration_versions` | Published JSON history | Replaced by release snapshots. Dropped with the table above. |
| `schema_changes` | Log of column and index changes | Replaced by `schema_change_log` (Contracts §8). Copy existing rows as history in Story 04, then drop. |
| `custom_field_values` | Key-value storage for custom fields | Not used for business data (D2, Architecture). Existing values move to real columns through the schema service in Story 04, then the table is dropped. |

Migration `0002_configuration_engine.sql` also seeds a default configuration with six pages (Dashboard, Inventory, Customers, Customer Entries, Sales, Reports) and five components. Story 01c replaces the seed with the Imam Mobile application seed package.

## Frontend

| Item | Where | Notes |
|---|---|---|
| Admin Studio screen | `frontend/src/AdminStudio.jsx` (267 lines, lazy chunk about 30 kB, 7.7 kB gzip) and the "Admin Studio" page in `App.jsx` | Database Studio (tables, columns, indexes), field manager, draft, publish, version history and restore. |
| Admin token | Typed into the screen, held only in component state | Not stored in browser storage. Removed with the token in Story 11. |
| Runtime configuration | `App.jsx` calls `GET /api/configuration` on load and applies pages and fields | Becomes the bootstrap call. |
| Custom fields in forms | `App.jsx` `saveCustomValues` and a lookup in the form component | Replaced by property-driven forms (Stories 04 and 06). |
| API base URL | Was hardcoded to the dev Worker in both files | Now `VITE_API_BASE` with the dev Worker as the default (slice 01b). `frontend/.env.example` documents it. |

## Behavior to carry over into the new features

Admin Studio can: inspect tables and indexes; add a column of a safe SQLite type; create and drop an index; define a custom field stored as a column or as metadata; save a draft; publish it as the next version; list the last 20 versions; restore a version into the draft. The platform keeps the useful parts (add a property, indexes for search, draft and publish, restore) in the new, safer forms and drops metadata storage and the shared token.

## Problems found

1. One shared secret protects all admin routes, and a single request can change the live schema. There is no preview, no operation ID, no actor and no audit.
2. Live `ALTER TABLE` and `CREATE INDEX` run from an HTTP route in the same Worker that serves shop traffic.
3. `custom_field_values` is a key-value store, which the architecture forbids for business data. Values cannot be queried, indexed or constrained.
4. `GET /api/custom-field-values` and `POST /api/custom-field-values` have no guard at all. They are now declared with permissions, and enforced by the placeholder policy layer.
5. The configuration route is cacheable at the edge for 5 minutes, so a publish can stay invisible (conflicts with D13).
6. Configuration is one unvalidated JSON blob with a 100,000 character cap and weak structure checks.
7. The two add-column routes duplicate each other.

## Removal checklist

- [ ] Story 01c: new bootstrap serves the release snapshot with a version header and no multi-minute edge cache. Legacy route stays until the cut-over.
- [ ] Story 04: schema service replaces the schema routes. Copy `schema_changes` into `schema_change_log`. Move any `custom_field_values` data to real columns. Check the development database for existing values before dropping. Remove `custom-field-values` routes and the table.
- [ ] Story 07: configure mode replaces the Admin Studio screen. Remove `AdminStudio.jsx`, the "Admin Studio" page, the six configuration routes and the two configuration tables.
- [ ] Story 11: remove `ADMIN_CONFIG_TOKEN` from code and from the Worker secrets. Remove the matching policy entries.
- [ ] After each removal: delete the matching tests in `backend/test/legacy-admin.test.ts` and the policy entries, and record it in the Story notes and the timeline.
