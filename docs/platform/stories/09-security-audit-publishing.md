# Story 09 — Permissions, Audit, and Publishing Governance

**Priority:** P0 before real multi-user use · **Depends on:** Stories 01 and 07; integrate across all stories  
**Goal:** Ensure configuration and record access are enforced by the backend and every sensitive change is traceable.

## User story

As a workspace owner, I want to assign roles and permissions and inspect important changes so that users can only access the applications, modules, tables, records, and configuration they are allowed to use.

## Security baseline

The existing shared `ADMIN_CONFIG_TOKEN` mechanism is a temporary development bridge only. A token embedded in browser code or shared across users is not production authentication. Do not ship a secret in Vite variables or static assets.

## Scope

1. Implement a proper authentication/session approach supported by the chosen provider; assess Cloudflare Access or an established identity provider before custom password storage.
2. Workspace-scoped users, roles, role assignments, and permission rules.
3. Permission actions: platform.configure, application.read/manage, module.read/manage, table.read/create/update/delete, record-level restrictions only if a concrete need is established.
4. Initial roles: Admin, Manager, User, mapped to permissions rather than hardcoded UI checks.
5. Enforce every permission in Worker routes and data-source query services.
6. Audit configuration changes, schema changes, publish/restore, role changes, and destructive data changes.
7. Protect sensitive properties (e.g. purchase price) at API response and query layers, not only in UI.
8. Add rate limits or abuse controls where exposed endpoints need them; avoid building a custom security framework unnecessarily.

## Audit event contract

Record actor, workspace, action, entity type/ID, timestamp, request ID, and a minimized before/after diff. Never store passwords, session tokens, admin secrets, or unnecessary personal data in audit JSON. Audit rows are append-only to normal application roles.

## Acceptance criteria

- [ ] No authentication secret is shipped in frontend bundle.
- [ ] Every API route has an explicit authentication/authorization policy.
- [ ] Admin, Manager, User permissions match the approved matrix.
- [ ] Direct API calls cannot bypass hidden UI controls.
- [ ] Sensitive fields are omitted or masked server-side based on permission.
- [ ] Configuration and schema changes include actor and audit event.
- [ ] Unauthorized access returns consistent 401/403 responses.
- [ ] Session expiry and logout work.
- [ ] Existing development/production secrets remain separate.

## Tests

Role/action matrix; direct API authorization; property-level field access; session expiry; CSRF/CORS policy as applicable; audit immutability; secret scan/build artifact scan.

## Out of scope

Enterprise SSO catalog, complex ACL scripting, row-level policy language, external identity federation beyond selected provider.
