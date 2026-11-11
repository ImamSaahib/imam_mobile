# Decisions Record

**Status:** Proposed on 2026-11-08 from an architecture review. The product owner reviews each decision. A decision marked *Confirmed* was stated by the product owner. All others are recommendations until confirmed.

Each decision names the stories that rely on it. If one changes, update those stories.

## Confirmed by the product owner

**C1. Edit mode terminology.** The lock/edit toggle in the Super Menu has two states. *Locked* shows the published release and offers no configuration. *Unlocked* (lock disabled, editing enabled) is **configure mode**. All changes to menus, modules, components, properties and views are made only in configure mode, from the Configure option of the element.

**C2. Authentication and authorization come after the UI/UX phase.** Until then the application runs with a placeholder policy (D7) and holds test data only (D8).

**C3. The interface follows the reference screenshot** (layout, table, search bar, buttons) in the Cloudflare-style look. The right-hand panel is out of scope for now. See [UI Reference](UI-REFERENCE.md).

**C4. No real data in production today.** The shop's `main` deployment holds no real data. The legacy migration (D2) therefore has no production data to preserve.

**C5. Authentication is application-managed.** The owner will build the authentication layer on top of the application with a custom user management system. Admins create users and assign roles. Cloudflare Access is not the chosen method. See D18.

**C6. Single language in release 1.** No translation and no right-to-left support is required yet. See D19.

**C7. Data growth.** About 10 devices are added per day. Customer and sales counts are not yet known (see Open questions).

**C8. Delivery direction (owner-confirmed, 2026-11-12).** Product Phase 1 includes all twelve existing stories, 00–11. They are the application's primary functionality, not its complete future scope. Deliver them as quickly as practical with quality, following the existing dependency order and acceptance criteria. The owner will test the integrated application after Phase 1 development is complete, then define new stories for Product Phase 2. Developer tests, regression checks and development deployment verification continue throughout; owner testing is not a substitute for these checks. Keep story progress, acceptance evidence, TIMELINE and HANDOFF current in each implementation slice. Defer optional improvements, unrelated refactoring and side work that do not deliver an existing requirement, remove a blocker or satisfy a required quality/safety gate. Make routine reversible decisions autonomously and request owner input only for missing required resources, consequential difficult-to-reverse decisions or explicit authorization. Production promotion still requires explicit owner approval. *Applies to: Stories 00–11 and future planning.*

**C9. Visual reference and release/distribution direction (owner-confirmed, 2026-11-12).** The original Cloudflare D1 screenshot was supplied in chat as "Screenshot 2026-11-07 at 5.04.38 PM.png". Use its look and feel, especially application navigation, table, search/refresh and sorting/column controls. Exclude the right-hand usage/changelog section. Filters follow the platform view contract; do not claim unseen filter states are measured from this image. Kumo demo renders are evaluation evidence, not the original reference. Keep the private original out of Git.

Complete Product Phase 1 in development, then promote the tested release to main through an explicitly approved PR. Main is the stable baseline clients fork, customize through the non-secret manifest and deploy into their own Pages, Worker and D1 resources. The owner expects one coordinated release/install workflow, not separate manual schema, metadata and application deployments. Story 10 must automate target validation, migrations, versioned configuration/seed installation or upgrade, compatible Worker/Pages deployment and post-deploy verification with recovery evidence. Preserve target records and client configuration; promote approved configuration packages, never copy the development database or test data. A Git merge alone does not move database state. Initial account authorization/secrets/resource identifiers remain explicit setup inputs. This direction is a delivery requirement, not authorization to deploy production now. *Applies to: Stories 00, 02, 05, 07, 10, 11.*

## Recommended decisions

**D1. Configuration storage.** Normalized records are the authoritative editable configuration. Each published release stores an immutable JSON snapshot. The snapshot is derived from the records and is never a second source of truth. Seed ownership and three-way merge work on item-level records. *Relied on by: Stories 01, 07, 10.*

**D2. Legacy admin code and `custom_field_values`.** Story 01 inventories the existing Admin Studio, its admin endpoints (including the live add-column and add-index routes) and the `custom_field_values` table. The old table does not become the property system. Existing custom fields migrate to real columns through the schema change service, then the table is retired. The old admin endpoints stay only until configure mode replaces them (Story 07), then are removed. The inventory and removal checklist are in [legacy-inventory.md](legacy-inventory.md) (recorded 2026-11-09). *Relied on by: Stories 01, 04, 07.*

**D3. TypeScript.** Platform code is TypeScript. New platform modules are written in TypeScript. Existing JavaScript is converted when it is changed, not in one step. Story 01 sets up the build and type checking. *Relied on by: Stories 00, 01.*

**D4. Folder layout.** Keep `frontend/` and `backend/` where they are, so Pages, Wrangler and CI paths stay valid. Add:

    applications/<app-key>/seed/    upstream-owned seed packages
    client/configuration/           fork-owned configuration
    client/extensions/              fork-owned extensions
    deployment/                     non-secret manifest

The reference application's seed lives under `applications/imam-mobile/seed/`. Upstream releases never edit `client/`. *Relied on by: Stories 01, 10.*

**D5. Identifiers.** Configuration items use opaque string IDs. Seed items get fixed IDs derived once from their seed key and never from labels. Items created in configure mode get generated IDs. Business tables keep integer primary keys. *Relied on by: Stories 01, 04.*

**D6. Page embedding.** Not allowed in release 1. A page contains components only. Tabs and sections use the container component. Revisit after the second-application proof. This avoids cycle checks and depth limits for now. *Relied on by: Story 03.*

**D7. Placeholder policy layer.** Every route calls one `authorize(actor, permission)` function and declares the permission it will require. Until Story 11, the function allows requests only when `AUTH_MODE=dev-open` and `ENVIRONMENT=development`. In any other combination it denies. The health check reports failure if `dev-open` is active outside development. Story 11 replaces this function and nothing else. *Relied on by: Stories 01–10, 11.*

**D8. No real data before authentication.** No deployment that runs `dev-open` holds real client data or serves production traffic. Release checklists include this rule. The owner confirmed (C4) that production on `main` holds no real data today; Story 01 records this. *Relied on by: Stories 10, 11.*

**D9. Atomic business actions on D1.** D1 has no interactive transactions. An action that checks then writes (for example selling a device) uses one `batch()` containing a conditional update (`WHERE status = 'Available'`) and the insert, plus a database constraint that rejects a second sale of the same device so the whole batch fails. It also carries an idempotency key. The insert must not rely on the update succeeding. Tests check that the second attempt is rejected and no duplicate rows exist. *Relied on by: Story 06.*

**D10. Test tooling.** Story 01 selects the test runner before other work. Evaluate Vitest with Cloudflare's Workers test integration for the Worker, and Vitest with Testing Library for the frontend. Verify current support before adopting. The baseline workflow tests (D11) cannot be written until this is chosen. *Relied on by: Story 01.*

*Update 2026-11-08:* the Worker side is resolved. Vitest 4.1 with `@cloudflare/vitest-plugin` is adopted, because the older `@cloudflare/vitest-pool-workers` is deprecated. Frontend tooling is still open. Details are in Story 01 notes.

**D20. UI primitives and icons.** Adopt `@cloudflare/kumo` (MIT) for UI primitives, wrapped in our own components so screens never import it directly. Use Phosphor icons for new UI and remove `lucide-react` once legacy screens move to the new shell. Design tokens start as aliases of Kumo's semantic tokens, with our brand color. Measured cost: about 142 kB gzip JS over React plus 23 kB gzip CSS for the full set, within the 300 KB budget with about 50 kB spare. Evidence is in Story 00 notes. *Relied on by: Story 00 and every story that builds interface.*

**D11. Baseline tests first.** Before moving any existing screen onto metadata, Story 01 records what the application does today and adds tests for those workflows. The list is written from the actual routes. The inspection must confirm whether a server-side sale operation exists, since the `sales` and `sale_items` tables appear unused by the Worker. *Relied on by: Stories 01, 06.*

**D12. Early reuse slice.** After Story 04, build a minimal second data source with one list and one form entirely from configuration. Pass criteria: no shared-core edits, no new migration beyond the new table, the list and form render from metadata. If it fails, stop and revise the metadata design before Stories 05–06. The full second-application proof after Story 06 remains. *Relied on by: Contracts §4, Story 10.*

**D13. Configuration caching.** Published configuration is served with a release version identifier and revalidated by the browser. It is not cached at the edge for several minutes. A publish is visible on the next request. The service worker caches static assets only. *Relied on by: Stories 01, 07.*

**D14. Priorities.** P0 is the minimum reusable runtime and the build experience: Stories 00–07. P1 is Stories 08–10 and 11. Story 11 is scheduled after UI/UX. Within P0, the order is 00 and 01 together, then 02, 03, 04, the early reuse slice (D12), 05, 06, 07. *Relied on by: README.*

**D15. Scope cuts if time runs short.** Cut in this order: calculations in the table footer, sub-groups (already deferred), nested filter groups beyond one level, row open modes other than side panel, data-rewriting type conversion (Story 04 Phase B). Do not cut the context menu, configure panels, search, saved views or add-property.

**D16. Resource budget.** Design against 1,000,000 rows read, 100,000 rows written, 500 MB and 100,000 Worker requests per day for about 5 users and 100 sessions a day. Cloudflare's free plan documents higher read limits (5,000,000 a day), so the design keeps headroom. Budgets are measured in tests and CI, using a reference dataset of 5,000 devices (about 17 months of additions at 10 a day), 2,000 customers and 5,000 sales (both assumptions until real counts are known), plus a growth test at 20,000 devices (about 5.5 years). See [Implementation Contracts §9](IMPLEMENTATION-CONTRACTS.md). *Relied on by: Stories 00, 01, 04, 05, 06, 07, 10.*

**D17. Resource-aware data access.** The application stays far below the daily limits by design and switches to cheaper behavior before a limit is reached, so users do not see limit errors. The design is: cached release snapshot and conditional requests; per-table version counters; keyset pagination instead of `OFFSET`; maintained counters for totals and KPIs; selective columns, indexed prefix search and FTS5 for large text tables; no polling; and a resource governor with Normal, Conserve, Essential and Limit states. Estimated use is about 8% of the read budget without a local copy. A local copy of small tables is deferred and built only if measured reads exceed 30% of the budget. Workers KV is not used, and the Cache API is optional because it is per data center and may not work on every domain type. A hard cap cannot be removed, only made unlikely; the Workers paid plan removes the limits and is an option the owner may take. See [Implementation Contracts §10](IMPLEMENTATION-CONTRACTS.md). *Relied on by: Stories 01, 04, 05, 06, 07, 09, 10, 11.*

**D18. Authentication and user management.** Application-managed accounts (C5), built in Story 11.

- **Users and roles.** A users table; admins create users and assign roles; there is no self-registration. The first roles are Admin, Manager and User, with permissions defined in code (see Open questions on custom roles).
- **Passwords.** Hashed with PBKDF2-SHA256 through Web Crypto, with a random salt per password. This is the only suitable password algorithm I confirmed Workers supports. One author reports that Workers caps PBKDF2 at 100,000 iterations; the documentation does not state a limit. The free plan allows 10 ms of CPU per request, and the cost of a hash at an acceptable iteration count is unknown. **Story 11 begins with a measurement spike.** If hashing does not fit, options are fewer iterations with strong password rules and rate limiting, the Workers paid plan, or delegating sign-in to an external provider.
- **Sessions.** A random token stored hashed in a sessions table, sent in an HttpOnly, Secure, SameSite cookie, with idle and absolute expiry. Validation is one primary-key row read per request, and the resolved role permissions are cached in Worker memory for at most 60 seconds, so a role change or revocation takes up to a minute to apply.
- **Abuse protection.** Login attempts are rate limited per account and per client, with a lockout that an admin can clear. Failed and successful sign-ins are audited.
- **No email.** There is no mail service, so an admin resets a password and the user must change it at next sign-in. Email reset is a later option.
- **First admin.** Created at installation from a value set as a Cloudflare secret, never from source code.
- **Protected data.** The users, roles and sessions data sources are platform-owned. Configure mode cannot expose or edit password hashes, and they never leave the Worker or appear in logs.
- **Deferred.** MFA, self-service password change flows beyond the basics, and SSO.

*Relied on by: Story 11.*

**D19. Language.** Release 1 is single-language. There is no translation and no right-to-left testing. Keep CSS logical properties because it costs little, and keep `default_locale` in the manifest for date and number formatting. Revisit when a second language is needed. *Relied on by: Stories 00, 08.*

## Open questions

- What are the real counts of customers and sales? Devices grow by about 10 a day. (D16)
- Are custom roles needed, or are Admin, Manager and User enough for the first release? (D18)
- Does Story 11's password hashing fit the free plan's CPU limit? This is answered by the spike at the start of Story 11. (D18)
