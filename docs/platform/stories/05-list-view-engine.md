# Story 05 — Lists, Views and Safe Query Engine

**Status:** In progress (backend page read for devices; no published list UI yet)  
**Priority:** P0 · **Depends on:** Stories 00, 02 and 04  
**Goal:** Provide reusable, bounded table views over approved relational data sources, with Notion-style table capabilities in the Cloudflare-style layout of [UI Reference](../UI-REFERENCE.md).

## User story

As an application user, I want searchable tables with saved views, filters and sorting so different applications can present the same records in different ways without duplicating data.

## Scope

1. Server-side paginated table component with the toolbar, header, row actions and footer defined in UI Reference §3.
2. Embedded search over configured searchable properties.
3. Multiple named views per data source, shown as view tabs. Views can be renamed and duplicated.
4. Per view: visible columns, column order and width, freeze up to a column, wrap cells.
5. Click-to-sort column headers, with multiple ordered sorts.
6. Typed filters: simple filters, and advanced AND/OR filter groups nested up to three levels.
7. Group by one property. Sub-groups are deferred.
8. Footer calculations as bounded server-side aggregates: count, count values, empty, not empty, percent empty, sum, average, min, max.
9. Server-side pagination with the summary "Showing x–y of z" and first/previous/next/last controls.
10. Row open mode per view: side panel (default), center dialog or full page.
11. Row action menu (the "…" control). Entries come from view configuration and registered actions.
12. Column settings control (gear) to show, hide and reorder columns.
13. Refresh control in the toolbar.
14. View settings can be saved for everyone (shared view, edit mode only) or kept personal. Until accounts exist, personal settings are stored in the browser.
15. Stable deterministic sorting with a primary-key tie-breaker.
16. Safe query compiler accepting a typed query model, never SQL fragments.
17. Query complexity limits: maximum page size, filter depth, sort count, search length and result size.
18. Property-level authorization in queries is deferred to the security phase. The query model must carry the sensitivity of each property so enforcement can be added without redesign.
19. Keep the generic query language narrow; complex domain queries use developer-defined approved query services.
20. Register a configure descriptor for the table component and for views (Implementation Contracts §7).
21. Meet the query budgets in [Contracts §9](../IMPLEMENTATION-CONTRACTS.md): minimum 2 characters before search runs, prefix search on indexed columns by default, contains-search only on small tables or flagged properties, and a filtered total capped at 1,001 counted rows, shown as "1,000+" beyond that (unfiltered totals come from counters, item 27).
22. Run footer calculations and counts on request, not on every page load, with the same row cap.
23. Show a clear message with the reset time when the daily limit is reached.
24. Use FTS5 full-text search for large text tables (D1 supports FTS5; triggers are unconfirmed, so update the FTS table by code in the same batch as the write), and indexed prefix search elsewhere. Record the threshold between them. The devices table passes 5,000 rows in about 17 months, so plan for FTS5 there.
25. Keyset pagination ([Contracts §10.3](../IMPLEMENTATION-CONTRACTS.md)): cursor is the sort values plus the primary key. No `OFFSET`. The footer offers first, previous, next and last, and arbitrary page jumps are not supported. Update [UI Reference §3.3](../UI-REFERENCE.md) accordingly.
26. Return `ETag` values made of the release and data source versions and honor `If-None-Match` ([Contracts §10.2](../IMPLEMENTATION-CONTRACTS.md)).
27. Take unfiltered totals from counters ([Contracts §10.4](../IMPLEMENTATION-CONTRACTS.md)) and select only visible columns.
28. Obey the governor state ([Contracts §10.7](../IMPLEMENTATION-CONTRACTS.md)): in Conserve restrict search to indexed prefix and pause footer calculations; in Essential and Limit serve lists from cache with a discreet banner.
29. No polling or background refresh. Refresh is manual, and the app does one version check when the tab regains focus.

## View contract

A view stores data-source ID, layout, visible property IDs, column order and widths, frozen column, wrap setting, filter tree, sort rules, group field, calculations, page size, searchable properties, row-open behavior and row action entries. Views reference records; they never copy records.

## UI behavior

Every table includes a search field unless authorized configuration explicitly disables it. Provide distinct loading, empty, error, no-results and (security phase) permission-denied states. Search debounces and ignores stale responses. Filters and operators are type-specific. View operations (sort, filter, search, show or hide columns, reorder) work in locked mode; saving them into a shared view requires edit mode.

## Acceptance criteria

- [ ] Lists are driven by data-source/property metadata.
- [ ] Table layout matches UI Reference §3 in light and dark themes.
- [ ] Search is server-side and bounded.
- [ ] Multiple views can show the same records with different settings.
- [ ] Typed filters work, including nested AND/OR groups up to three levels.
- [ ] Multiple sorts work and are deterministic.
- [ ] Footer calculations return correct bounded aggregates.
- [ ] Pagination is server-side and bounded, with the "Showing x–y of z" summary.
- [ ] Column show/hide, order, width, freeze and wrap persist in a view.
- [ ] Row open modes work: side panel, center dialog and full page.
- [ ] Row action menu opens by mouse, keyboard and touch.
- [ ] Invalid property IDs/operators are rejected.
- [ ] Query compiler uses prepared values and allowlisted identifiers.
- [ ] Sensitive properties cannot leak through search, sort, grouping or aggregates. *(Enforcement is deferred to the security phase; sensitivity is carried in the query model now.)*
- [ ] Existing inventory/customer lists retain their business behavior.
- [ ] A list page load reads at most 50 rows and a search at most 500 on the reference dataset.
- [ ] Search does not run below 2 characters.
- [ ] A filtered total shows "1,000+" beyond the count cap and never scans the whole table.
- [ ] No query on a table over 1,000 rows scans it, except listed exceptions.
- [ ] A reached daily limit shows a clear message, not a blank or broken table.
- [ ] Keyset pagination returns each row exactly once, and reading a later page costs the same as reading the first.
- [ ] A request with a matching `If-None-Match` returns 304 and reads one row.
- [ ] Unfiltered totals come from counters and read one row.
- [ ] In Conserve, Essential and Limit states the table still renders from cache with no raw error text.
- [ ] A simulated day of 100 sessions uses at most 8% of the read budget on the reference dataset (a target to re-measure).

## Tests

Query compiler unit tests; injection cases; type/operator matrix; nested filter groups; pagination; stable ordering; aggregates; view isolation; shared versus personal settings; stale search response behavior; context menu parity; screenshot comparison against UI Reference.

## Out of scope

Board, timeline, calendar, gallery and chart views; sub-groups; sub-items; templates; formula/rollup; collaborative views; arbitrary query builder.

## Progress

### 2026-11-14 — Keyset page read for devices (backend only)

Added `GET /api/devices/page` (permission `devices.read`, declared in `ROUTE_POLICY`). Parameters: `limit` (1 to 50, default 25), `after` (cursor: the id of the last row of the previous page; positive integer), `status` (optional exact match, at most 40 characters). Order is `id DESC`, the same newest-first order as the legacy list; there is no `OFFSET`. Response: `{ items, nextCursor, total }`. `total` is read from the maintained counter (`total` or `status=<value>`, one row), so it is exact and cheap. Invalid `limit`, `after` or `status` return 400. The legacy `GET /api/devices` is unchanged and the legacy workflows at `/` still use it.

Evidence: 5 new backend tests (each row exactly once across pages, empty table, status filter with counter total, invalid parameters, rows-read bound); a probe on a 12-row table measured 4 rows read for a 3-row page against 12 for the legacy list. Backend check passes (289 tests, 18 files). Frontend untouched. No schema or migration change, so nothing to recover.

Decisions and limits of this slice:
- The page reads exactly `limit` rows. `nextCursor` is set when a full page came back, so a last page that is exactly full yields one more request that returns an empty page; the client compares its position with the exact `total` and does not offer Next at the end.
- Not done yet: previous and last (reversed query), search, sorting and filters beyond `status`, `ETag` and `If-None-Match`, cache serving in Essential and Limit states, the `1,000+` filtered-total cap, and the published list UI. Acceptance boxes stay unticked until the full behavior exists.
- Customers, customer entries and sales have no page read yet.
