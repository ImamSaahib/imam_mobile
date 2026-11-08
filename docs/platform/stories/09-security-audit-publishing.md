# Story 09 — Audit, Operational Governance and Release Compatibility

**Status:** Planned (waiting on dependencies)  
**Priority:** P1 · the audit event shape and actor columns exist from Story 01; this story completes audit and governance · **Depends on:** Stories 01–08. Items involving real users depend on Story 11.  
**Goal:** Make important operations traceable and define safe compatibility rules across deployed code, configuration and database versions.

## Scope

1. Append-only audit events for configuration edits/publish/restore, schema migration, permission changes and sensitive/destructive business actions.
2. Record actor, timestamp, action, entity, request/correlation ID and minimized before/after diff.
3. Never log passwords, tokens, secrets or unnecessary personal data.
4. Define platform release version, configuration schema version, component/property schema versions, domain action API versions and required DB migration level.
5. Add health/diagnostic output identifying incompatible configuration, missing schema or unsupported component/action versions without exposing sensitive data.
6. Define rollback boundaries: configuration restore, code rollback and database recovery are separate operations.
7. Document backup/restore expectations and client responsibility.
8. Ensure every API route remains covered by a declared permission and the central `authorize` call established in Story 01.
9. Audit schema change service operations (Story 04), including the preview, actor and outcome, in addition to migrations.
10. Diagnostics report the governor state, the estimated daily rows read and written, and the retention status of audit events and release snapshots, without exposing sensitive data.

## Compatibility policy

A deployment must not activate configuration requiring a newer platform/API version or database migration than is installed. Database migration rollback is not assumed safe or automatic. Prefer forward-fix or tested recovery. Destructive schema changes use expand → migrate → switch → contract across releases.

## Acceptance criteria

- [ ] Sensitive operations create audit events.
- [ ] Audit data excludes secrets and unnecessary personal information.
- [ ] Audit events are not editable by normal application roles. *(Deferred to Story 11.)*
- [ ] Schema change service operations create audit events.
- [ ] Runtime reports incompatible platform/config/schema/action versions.
- [ ] Deployment health check fails clearly for required missing migrations.
- [ ] Configuration rollback is not represented as database rollback.
- [ ] Backup and recovery procedure is documented and rehearsed in development.
- [ ] All routes retain a declared permission and the central `authorize` call; enforcement is completed in Story 11.

## Tests

Audit coverage; audit tamper restrictions; secret redaction; compatibility matrix; missing migration; unsupported component/action version; recovery rehearsal; route-policy regression.

## Out of scope

Enterprise SIEM integration, complex compliance workflow and multi-region disaster recovery.

## Seed upgrade governance

Configuration releases and seed package upgrades are separate versioned operations. A seed upgrade must provide a preview and three-way conflict report before applying changes. Conflicts are resolved per item (accept upstream, retain client value, or provide a reviewed merged value) and resolutions are audited. Removed seed items are deprecated first; references prevent hard deletion. Resetting one item to its upstream default is explicit and audited. Seed upgrades never alter business records, secrets or client extension code.

## Additional acceptance criteria

- [ ] Seed upgrade previews additions, updates, unchanged items, client-owned items, conflicts and deprecations.
- [ ] Conflicts are not silently resolved in favor of upstream.
- [ ] Per-item resolutions and resets are audited.
