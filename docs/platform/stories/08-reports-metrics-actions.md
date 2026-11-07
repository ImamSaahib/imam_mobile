# Story 08 — Reports, Metrics, and Actions

**Priority:** P1 · **Depends on:** Stories 03–06  
**Goal:** Turn the component platform into useful operational applications through safe summaries, reports, and reusable actions.

## User story

As an application builder, I want to place KPI counts, charts, and buttons on pages and bind them to approved data sources so a module can support operational decisions and actions.

## Scope

### KPI/count components
- Count, sum, average, min, max, distinct count.
- Configurable title, source, property, filter, number/currency/date formatting.
- Permission-aware aggregation; restricted fields must not leak through aggregates.

### Reports/charts
- Start with table summary and bar/line/donut charts where data shape is bounded.
- Report definition references a data source, metric, grouping property, filters, and time range.
- All grouping/metric fields are validated against property types.
- Enforce result limits and aggregation query limits.

### Buttons/actions
- Action types are fixed registry entries, not arbitrary scripts.
- Initial actions: navigate to module, open create form, open record, refresh component, and invoke an approved domain action.
- Domain actions (e.g. sell device) are server endpoints with transaction and permission checks.
- Button visibility and enabled state may be configured using safe declarative conditions only; no eval.

## API

- `GET /api/reports/:id/data`
- `GET /api/metrics` or component-specific metric endpoint.
- `POST /api/actions/:actionKey/execute` for registered actions.
- All report/action requests are authorized and bounded. Action requests require idempotency protection where duplicate execution could create duplicate transactions.

## Acceptance criteria

- [ ] KPI count/sum/average renders from an approved source.
- [ ] A report can group and aggregate records with typed filters.
- [ ] Charts show loading, empty, error and no-data states.
- [ ] Currency and date formatting follow explicit configuration and locale.
- [ ] Buttons invoke only registered actions.
- [ ] Duplicate financial actions are prevented or safely idempotent.
- [ ] Restricted source fields and aggregates are protected by server-side policy.
- [ ] Reports do not fetch unbounded result sets.

## Tests

Aggregation correctness; filter correctness; permission leakage tests; action authorization; idempotency; large-result caps; chart serialization.

## Out of scope

Arbitrary scripting, scheduled report delivery, workflow builder, external webhooks, advanced BI.
