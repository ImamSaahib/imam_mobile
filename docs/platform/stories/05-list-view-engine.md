# Story 05 — Lists, Views and Safe Query Engine

**Priority:** P1 · **Depends on:** Stories 03 and 04  
**Goal:** Provide reusable, bounded list and table views over approved relational data sources.

## User story

As an application user, I want searchable tables with saved views, filters and sorting so different applications can present the same records in different ways without duplicating data.

## Scope

1. Server-side paginated table/list renderer.
2. Search over configured searchable properties.
3. Multiple named views over one data source.
4. Visible columns, column order, typed filters, ordered sorts and one initial group-by field.
5. Stable deterministic sorting with primary-key tie-breaker.
6. Safe query compiler accepting a typed query model, never SQL fragments.
7. Query complexity limits: maximum page size, filter depth, sort count, search length and result size.
8. Authorization-aware property selection and record queries.
9. Keep generic query language narrow; complex domain queries use developer-defined approved query services.

## View contract

A view stores data-source ID, layout, visible property IDs, column order, filter tree, sort rules, group field, page size, searchable properties and row-open behavior. Views reference records; they never copy records.

## UI behavior

Every table includes a search field unless configuration explicitly disables it. Provide distinct loading, empty, error and no-results states. Search should debounce and ignore stale responses. Filters/operators must be type-specific. The first release is deliberately limited to visible columns, simple typed filters combined with AND, one or two sorts, server pagination and search. Nested filter groups, grouping, aggregates/calculations, row modes and advanced saved-view collaboration are deferred.

## Acceptance criteria

- [ ] Lists are driven by data-source/property metadata.
- [ ] Search is server-side and bounded.
- [ ] Multiple views can show the same records with different settings.
- [ ] Typed filters and deterministic sorting work.
- [ ] Pagination is server-side and bounded.
- [ ] Invalid property IDs/operators are rejected.
- [ ] Query compiler uses prepared values and allowlisted identifiers.
- [ ] Property sensitivity is represented in metadata for enforcement by the later security phase; do not claim protected-field enforcement is complete in this story.
- [ ] Existing inventory/customer lists retain their business behavior.

## Tests

Query compiler unit tests; injection cases; type/operator matrix; pagination; stable ordering; basic view isolation; stale search response behavior. Authorization and sensitive-field tests are completed in the security phase.

## Out of scope

Nested filter groups, OR logic, multiple grouping levels, group calculations, formula/rollup, collaborative views, advanced board/calendar/gallery, row-mode variants and arbitrary query builder. Revisit these only after the MVP is measured.
