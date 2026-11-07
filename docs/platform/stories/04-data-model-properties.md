# Story 04 — Data Model and Property Engine

**Priority:** P0 · **Depends on:** Story 01  
**Goal:** Make database tables and their fields first-class platform objects with typed, validated metadata.

## User story

As an administrator, I want to create data sources and configure properties (fields) so lists, forms, filters, and reports all use the same authoritative field definitions.

## Core decision

Use physical SQLite tables for records and normalized metadata for table/column definitions. Do not move all records into a generic EAV store. Existing tables (mobile_devices, customers, sales, customer_entries, sale_items) are registered as data sources and introspected/verified against metadata.

## Initial property types

text/title, long_text, integer, decimal, currency, select, multi_select, date, datetime, checkbox, email, phone, url, relation, created_time, updated_time. Formula/rollup and arbitrary expressions are deferred.

For every type define storage mapping, editor, renderer, validators, filter operators, sort behavior, and migration strategy. Choices are metadata with stable IDs, labels, colors, and order. Select stores one option key. Multi-select uses a normalized join table where filtering/reporting requires it; do not rely on opaque JSON strings by default. Relation metadata defines target data source, cardinality, and delete policy.

## Scope

1. Data-source registry CRUD and schema inspection.
2. Property metadata CRUD: label, key, type, required, unique, default, help text, visibility, validation, choices, relation, and order.
3. Server-side validation for property values on record create/update.
4. Read-only schema introspection endpoint.
5. Additive physical column/table migrations for new sources/properties.
6. Safe type-change workflow: preview impact, conversion rules, validation, explicit confirmation, migration, metadata update, audit.
7. Protect system-managed fields and existing primary/foreign keys.
8. Expose schema metadata to the frontend so editors and displays share one source.

## API

- `GET /api/data-sources`
- `POST /api/data-sources`
- `GET /api/data-sources/:id/schema`
- `POST /api/data-sources/:id/properties`
- `PATCH /api/properties/:id`
- `DELETE /api/properties/:id` (only if nullable/no dependencies or after explicit migration plan)
- `POST /api/properties/:id/validate-change`
- `POST /api/properties/:id/apply-change`

The API accepts typed JSON values and returns field-specific validation errors. SQL identifiers must come from validated metadata and be quoted; values must be bound parameters. Never expose arbitrary SQL execution through the API.

## Type change safety

A type change is not a label edit. The UI must show:
- current and target type;
- number of affected records;
- sample conversion failures;
- null/default behavior;
- dependent views/forms/reports/components;
- whether the operation is reversible.

Reject destructive or ambiguous conversions. For the first release, allow only safe conversions with deterministic migration. For unsupported conversion, instruct the admin to create a new property and migrate values manually. Do not drop a column as part of normal property deletion; deprecate/hide first.

## Acceptance criteria

- [ ] Existing business columns appear as properties with correct type and constraints.
- [ ] One property definition drives list display, form editor, filtering and server validation.
- [ ] Admin can add text, number, date, checkbox, select, and relation properties where supported.
- [ ] Select choices can be added, renamed, reordered, disabled, and removed with usage checks.
- [ ] Invalid values are rejected server-side even if the browser is bypassed.
- [ ] Required/unique/default/validation behavior works.
- [ ] Physical schema changes are represented by new migration files and schema history.
- [ ] Unsafe type changes and deletion of referenced fields are blocked.
- [ ] Existing records and business APIs remain compatible.

## Tests

Type-to-storage mapping; validation per type; choice lifecycle; foreign key/relation behavior; schema introspection parity; migration apply; type conversion fixtures; SQL identifier injection tests.

## Out of scope

Formula language, rollups, arbitrary computed SQL, database triggers created by users.
