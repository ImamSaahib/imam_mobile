# Story 08 — Reports, Metrics and Registered Actions

**Priority:** P1 · **Depends on:** Stories 04–06 and action contract from Story 06  
**Goal:** Add bounded operational summaries and reports only after the reusable data and action contracts are proven.

## User story

As an application builder, I want to place approved KPIs, reports and action buttons on pages so each application can expose relevant operational information without custom dashboard code for every metric.

## Scope

### Metrics
- Count, sum, average, minimum, maximum and distinct count where supported.
- Source, property, typed filters and explicit formatting.
- Server-side authorization must apply to both records and aggregates.

### Reports
- Begin with table summaries and bounded bar/line/donut chart payloads.
- Report definitions reference data sources, metric, grouping property, filters and date range.
- Enforce aggregation and result limits.

### Actions
- Buttons may navigate, open a form/record, refresh a component or invoke a registered domain action.
- Action key and version must be supported by deployed Worker code.
- Inputs are validated against the registered action schema.
- Idempotency is required when duplicate execution could create duplicate transactions.

## Acceptance criteria

- [ ] KPI values are generated from approved data sources.
- [ ] Reports use typed, bounded queries.
- [ ] Restricted data cannot leak through aggregates.
- [ ] Charts expose loading, empty, error and no-data states.
- [ ] Currency/date formatting is explicit and locale-aware.
- [ ] Buttons invoke only registered actions.
- [ ] Unsupported action versions are rejected visibly.
- [ ] Duplicate financial/inventory actions are prevented or idempotent.
- [ ] No arbitrary scripts or SQL are accepted.

## Tests

Aggregation correctness; filter correctness; permission leakage; action authorization; idempotency; query caps; unsupported action version; chart serialization.

## Out of scope

Advanced BI, scheduled report delivery, workflow builder, arbitrary scripting and external webhooks unless a concrete app proves the need.
