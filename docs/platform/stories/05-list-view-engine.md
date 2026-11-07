# Story 05 — Lists, Views and Safe Query Engine

**Priority:** P0 · **Depends on:** Stories 02 and 04  
**Goal:** Provide reusable, bounded list and table views over approved relational data sources.

## User story

As an application user, I want searchable tables with saved views, filters and sorting so different applications can present the same records in different ways without duplicating data.

## Scope

1. Server-side paginated table/list renderer.
2. Search over configured searchable properties.
3. Multiple named views over one data source.
4. Visible columns, column order, typed filters, ordered sorts and one initial group-by field.
5. Stable deterministic sorting with primary-key tie-breaker.
6. Safe query compiler that accepts a typed query model, never SQL fragments.
7. Query complexity limits: maximum page size, filter depth, sort count, search length and result size.
8. Authorization-aware property selection and record queries.
9. Keep the generic query language narrow; domain-specific complex queries use developer-defined approved query services.

## View contract

A view stores data-source ID, layout, visible property IDs, column order, filter tree, sort rules, group field, page size, searchable properties and row-open behavior. Views reference records; they never copy records.

## UI behavior

Every table includes a search field unless an authorized configuration explicitly disables it. Provide distinct loading, empty, error, no-results and permission-denied states. Search should debounce and ignore stale responses. Filters/operators must be type-specific.

## Acceptance criteria

- [ ] Lists are driven by data-source/property metadata.
- [ ] Search is server-side, bounded and permission-aware.
- [ ] Multiple views can show the same records with different settings.
- [ ] Typed filters and deterministic sorting work.
- [ ] Pagination is server-side and bounded.
- [ ] Invalid property IDs/operators are rejected.
- [ ] Query compiler uses prepared values and allowlisted identifiers.
- [ ] Sensitive properties cannot leak through search, sort, grouping or aggregates.
- [ ] Existing inventory/customer lists retain their business behavior.

## Tests

Query compiler unit tests; injection cases; type/operator matrix; pagination; stable ordering; filter groups; view isolation; property-level authorization; stale search response behavior.

## Out of scope

Full Notion parity, formula/rollup, collaborative views, advanced board/calendar/gallery and arbitrary query builder.
