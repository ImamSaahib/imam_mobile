# Story 05 — Database List and View Engine

**Priority:** P0 · **Depends on:** Stories 01 and 04  
**Goal:** Deliver reusable Notion-inspired database views over the same underlying records.

## User story

As a user, I want to search, filter, sort, group, and display records in different saved views without duplicating data or creating separate tables.

## Scope

1. Build a reusable list renderer bound to a data-source ID.
2. Support table layout first, with saved view definitions.
3. Embedded search bar on every list by default; configurable searchable properties and clear-search action.
4. Property visibility and ordering per view.
5. Multi-rule sorting with stable tie-breaker (primary key).
6. Typed filters with AND/OR groups and operators validated by property type.
7. Single-property grouping for select/status initially, with collapsed groups and counts.
8. Pagination (server-side) and configurable page size with a safe maximum.
9. Column resize/freeze where practical; row open action; bulk actions deferred unless permissions and transactional behavior are defined.
10. Save multiple named views over one data source.

## View configuration contract

A saved view contains: id, source_id, name, layout, visible_property_ids, column_order, filters, sorts, group_by, page_size, searchable_property_ids, default_sort, row_open_behavior, and optional per-view display settings. A user can have personal view settings later; initial views are workspace/application shared.

Filter operators are type-specific. Example: text supports contains/equals/starts_with/is_empty; number supports equals/greater_than/less_than/between; date supports before/after/on/between; select supports is/is_not/is_empty; checkbox supports is_true/is_false. Unsupported combinations are rejected.

## API

- `GET /api/data-sources/:id/views`
- `POST /api/data-sources/:id/views`
- `GET /api/views/:id/records?...` or POST query endpoint for complex filter trees.
- `PATCH /api/views/:id`
- `DELETE /api/views/:id`
- `POST /api/views/:id/duplicate`

The server compiles query definitions to parameterized SQL. It validates every field ID, operator, sort direction, group field, and page size against metadata. Never accept SQL fragments from the client.

## UI behavior

- Table header follows the reference: compact search and action toolbar, neutral header, clear sort indicators, aligned rows, restrained borders, and responsive horizontal scrolling.
- Search searches only configured fields and does not issue one request per keystroke; debounce and cancel stale requests.
- Empty, loading, error, no-results, and permission-denied states are distinct.
- View switcher supports create, rename, duplicate, reorder, and delete.
- Changing a view's configuration must not change another view.
- Sorting, filters, and grouping are reflected in URL state only if a stable URL format is implemented.

## Acceptance criteria

- [ ] Every list has a search input unless explicitly disabled by an authorized config.
- [ ] Search uses server-side pagination and configured properties.
- [ ] Multiple sorts work in deterministic order.
- [ ] Filter groups support AND/OR and typed validation.
- [ ] A view can hide/reorder columns without altering the underlying schema.
- [ ] Two views of one source can have different filters and layouts but show the same records.
- [ ] Grouping returns accurate counts and respects filters.
- [ ] Invalid field IDs/operators/page sizes are rejected server-side.
- [ ] Query plans use relevant indexes for core seeded sources.
- [ ] Existing inventory/customer tables retain their current actions and data formatting.

## Tests

Query compiler tests; SQL injection cases; type/operator matrix; pagination boundaries; stable ordering; filter/group counts; view isolation; search debounce and stale-response handling.

## Out of scope

Timeline, gallery, calendar, chart layout and per-user private views unless time remains after table/list/board.
