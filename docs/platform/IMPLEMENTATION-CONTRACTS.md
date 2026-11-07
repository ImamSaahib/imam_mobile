# Implementation Contracts — Version 1

**Status:** Normative implementation guidance for Stories 01–10.

This document makes the architecture's extension, seed, property-type, reuse-test, maintenance and CI expectations implementable. If a story conflicts with this document, update both in the same reviewed change.

## 1. Client extension registration and build contract

### First-release boundary

Extensions are trusted code compiled and deployed with the client's Worker. They are not downloaded or executed dynamically at runtime. There is no marketplace, arbitrary plugin upload, eval, runtime module loading, or extension-provided SQL.

Use a static registration entry point:
- Shared interfaces: backend/src/platform/extensions/contracts.ts.
- Client-owned implementations: backend/src/extensions/.
- Client registration entry point: backend/src/extensions/index.ts.
- Worker startup imports the registration entry point and registers implementations with the platform registry.
- Routes and generic CRUD code must not import individual client implementations.

The exact folders may be adjusted after inspecting the existing backend, but static registration and separation are mandatory.

### Domain action interface

Each action implementation must satisfy a typed interface equivalent to:

    type ActionContext = {
      db: D1Database;
      actor: { id: string; permissions: string[] };
      requestId: string;
      idempotencyKey?: string;
    };

    type ActionDefinition<Input, Output> = {
      key: string;
      version: number;
      inputSchema: JsonSchema;
      outputSchema: JsonSchema;
      requiredPermission: string;
      minimumPlatformVersion: string;
      execute(input: Input, context: ActionContext): Promise<Output>;
    };

Use the repository's actual D1 and schema-validation types; do not add a dependency solely to copy this illustrative type. The platform validates input before execution and validates output in tests. The action implementation must not trust client-supplied actor, permission, database binding or request identity.

The registry rejects duplicate keys/versions and exposes registered action metadata to configuration validation. Each action defines:
- stable namespaced key, such as inventory.sell-device;
- positive integer implementation version;
- input and output schemas;
- required permission;
- minimum platform/API version;
- transaction and idempotency policy;
- audit event policy;
- documented error codes and retryability.

The dispatcher authorizes before execution. It creates/uses an idempotency record for non-repeatable operations and executes related D1 writes atomically where supported. A failed action must not be reported as successful. Never automatically retry a non-idempotent action.

### Dependencies and compatibility

- Extensions may import documented public platform contracts, explicitly public shared utilities, and their own client extension modules.
- Extensions must not import private internal modules or mutate platform registries directly.
- Every extension declares its version and supported platform/API range.
- Configuration references actions only by registered key and compatible version.
- Missing, duplicate or incompatible registrations fail validation clearly.
- Tests register extensions through the same entry point used by Worker startup.
- Client-only actions stay in the client fork. Generally reusable actions may be proposed upstream.
- Custom component renderers, if required, follow the same static registration and public-contract principle. Metadata cannot contain component source.

## 2. Seed ownership and upgrade conflict contract

### Stable ownership identity

Every seed-managed configuration item has a stable item ID, owning package ID, stable seed key, ownership state (seed_managed or client_owned), last applied upstream version, last applied baseline value/hash, and current local value. Seed keys are independent of labels. Business records are never seed-managed.

### Initial installation and upgrades

Initial installation inserts missing seed items and fails on ambiguous identity collisions. Re-running the same package is idempotent.

An upgrade performs a three-way comparison: previous upstream baseline, new upstream baseline, and current installed value.

- If current value still equals the previous baseline, apply the upstream change.
- If upstream did not change the item, preserve the current value.
- If both upstream and client changed the same item, mark a conflict and leave the installed value unchanged.
- If the client explicitly owns an item, upstream does not overwrite it.
- Deleted upstream items are marked deprecated/orphaned first; do not hard-delete an item referenced by client configuration or data.
- Resetting an item to the upstream default is an explicit action after preview.

Upgrade preview reports additions, updates, unchanged items, client-owned items, conflicts, deprecated items and incompatible references. It shows old and proposed values without exposing secrets.

Applying an upgrade requires a validated plan. Conflicts are resolved individually by choosing upstream, retaining client value, or editing a merged value. Record resolution and actor in the audit trail. Apply transactionally where practical; partial failure must be detectable and safe to retry.

Never overwrite business records, credentials, secrets, client extensions or client-owned configuration during seed upgrade.

## 3. Property type and storage contract

All values are validated on the Worker. SQLite affinity alone is not validation. Physical constraints should reinforce rules where practical.

| Property | Storage | Validation and behavior |
|---|---|---|
| text/title | TEXT | UTF-8 string; configured maximum length; title is a presentation/required variant |
| number | INTEGER for whole values; REAL only for explicitly fractional values | finite value; range/precision rules; reject NaN/infinity |
| currency | INTEGER minor units plus ISO 4217 currency code | never use floating-point arithmetic for money; locale-aware display |
| select | TEXT stable option key | must match an active configured option; labels may change |
| multi-select | normalized junction rows keyed by record and option | validate every option; deduplicate; never store comma-separated values |
| date | TEXT YYYY-MM-DD | calendar-valid date without time-zone conversion |
| timestamp | TEXT UTC ISO-8601 | parse and normalize to UTC; display in user/application locale |
| checkbox | INTEGER constrained to 0 or 1 | API accepts boolean; database stores 0/1 |
| email/phone/URL | TEXT | normalized string plus format/length validation; no claim of external deliverability |
| relation | foreign-key ID using target key's declared storage type | target and record must exist and be readable; delete behavior explicit |
| system actor/timestamps | stable actor ID and UTC timestamp | server-managed; clients cannot mass-assign |

Currency requires a currency code at property or record level. Preserve exact minor-unit storage and reject unsafe integer overflow. Display whole rupees where a business UI requires it, without changing stored precision.

Every property declares supported filter/sort/search operators, nullability, required/unique behavior, limits, default policy, sensitivity and writability. Indexes are added through migrations based on measured query needs. Relation deletion defaults to RESTRICT; cascading business-record deletion is not implicit.

Virtual/computed properties are read-only and implemented by reviewed server code with an explicit output type. Formula strings and SQL expressions in metadata are prohibited.

## 4. Measurable second-application reuse test

The second application must be a distinct operational application with its own seed package, data tables and workflows, not a renamed Imam Mobile.

Acceptance evidence must show:
1. Same platform runtime and shared component registry.
2. Separate application identity, navigation, data-source/property metadata, forms and views supplied through a seed/configuration package.
3. Standard list, search, filters, forms and ordinary CRUD work without shared-core edits.
4. At least one application-specific business operation uses the documented extension interface, not a patch to generic CRUD/list/form code.
5. A clean development database can be migrated and seeded from scratch.
6. Reapplying the seed does not duplicate metadata or alter business records.
7. Authorization, schema compatibility and core workflow tests pass.
8. No shared-core changes are needed for ordinary application setup.

Record configuration-only files changed, extension files changed, shared-core files changed (target: zero for ordinary setup), migrations added, tests/deployment result, implementation time and blockers requiring platform changes.

Build the smallest meaningful proof after Stories 01–06. Use evidence to decide whether Stories 07–08 need expansion.

## 5. Initial upstream maintenance policy

Support the latest tagged stable baseline as the primary supported line. Publish release notes, migration notes, compatibility requirements and known risks for each tag. Security or critical correctness fixes target the latest stable release; backports to older tags are not promised unless announced.

Clients may defer updates, but their fork is unverified until they review upstream changes, resolve source/seed conflicts, apply migrations in their development environment, pass build/authorization/schema/business regression tests, and record deployed baseline and extension versions.

Do not promise automatic conflict-free merges, an SLA, indefinite support for old versions, or automatic production updates. Client production promotion requires explicit client approval. Revisit this policy when actual external clients and support capacity exist.

## 6. Continuous integration contract

Shared baseline CI validates pull requests targeting development and pushes to development. Production branch main is not a development target; production deployment is a separate approval-controlled workflow.

Minimum CI gates:
- frontend dependency install and production build;
- Worker type-check/build or syntax check matching the actual backend toolchain;
- unit tests for changed platform services;
- migration from an empty test database;
- seed idempotency and schema compatibility tests;
- API authorization and sensitive-field tests;
- core Imam Mobile regression tests once the harness exists;
- secret scan and explicit environment-target safety check for deployment jobs.

Do not claim a check is covered until its command exists and runs. Add checks incrementally with each story. Commit lockfiles and use npm ci for reproducible CI once a lockfile is present. Until then, record the missing lockfile as a CI gap and do not use npm ci prematurely.

CI must not deploy or migrate production. Development deployment is separate and uses explicit dev resource configuration without production credentials.
