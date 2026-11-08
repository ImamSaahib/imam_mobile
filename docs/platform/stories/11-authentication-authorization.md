# Story 11 — Authentication and Authorization

**Status:** Planned (waiting on dependencies)  
**Priority:** P1 · scheduled after the UI/UX phase (Stories 00–07) · **Depends on:** Stories 01–07  
**Goal:** Replace the placeholder policy layer with real authentication, roles and server-side enforcement, and complete every authorization criterion deferred from earlier stories.

## User story

As an installation owner, I need people to sign in and see and do only what their role allows, so the application can hold real business data.

## Background

Earlier stories declare the permission each route requires and call a single `authorize(actor, permission)` function ([Decisions D7](../DECISIONS.md)). That function allows requests only in a development environment running `AUTH_MODE=dev-open`. This story replaces it. Routes are not rewritten.

## Scope

1. **Spike first:** measure PBKDF2-SHA256 password hashing on the free plan (10 ms CPU per request) at the iteration counts Workers allows, and record the result ([Decisions D18](../DECISIONS.md)). If it does not fit, choose among the options listed in D18 before building further.
2. Users and roles storage: Admin, Manager, User, mapped to permissions. Roles are configuration; the permission names are defined in code and registered by components and actions.
3. Real `authorize` implementation. Remove `dev-open` from every environment except explicit local development.
4. Session handling with secure cookies or tokens as the chosen method requires. Secrets stay in Cloudflare secrets.
5. Replace the shared admin token and remove its routes.
6. Gate the Super Menu lock/edit toggle and all draft and publish routes by permission.
7. Navigator filtering: users see only modules they may access. Direct URL and API access is denied without permission.
8. Property-level enforcement using the sensitivity values stored since Story 04: hidden fields, no leakage through search, sort, group or aggregates.
9. Populate actor columns, the audit event actor and idempotency records with the real user instead of the placeholder.
10. Audit for permission changes, sign-ins and denied access attempts.
11. Unauthorized-request tests for every route in the route-policy inventory.
12. Application-managed accounts (C5, D18): users table; admins create users and assign roles; no self-registration; the first admin comes from a Cloudflare secret at installation.
13. Sessions: random token stored hashed, HttpOnly Secure SameSite cookie, idle and absolute expiry, one row read per request, permissions cached in memory for at most 60 seconds.
14. Login rate limiting per account and per client, with admin-clearable lockout, and audit of sign-ins.
15. Admin password reset with forced change at next sign-in. No email.
16. The user management module is built on the platform as a platform-owned data source: configure mode cannot expose or edit password hashes, and hashes never leave the Worker or appear in logs.
17. Cached responses and any future local copy must respect roles: sensitive properties are excluded from cached and synced data for roles that cannot read them, and local data is cleared on sign-out.

## Deferred criteria this story completes

- Story 02: modules shown only when permitted; direct access denied.
- Story 03: component registration cannot bypass data-source policies.
- Story 04: sensitive properties not exposed.
- Story 05: sensitive properties cannot leak through search, sort, grouping or aggregates.
- Story 06: action permissions enforced.
- Story 07: toggle permission-gating.
- Story 08: restricted data cannot leak through aggregates.
- Story 09: audit events not editable by normal roles.
- Story 10: authentication and authorization smoke tests.

## Acceptance criteria

- [ ] Every API route enforces its declared permission on the server.
- [ ] `dev-open` cannot be enabled outside local development, and the health check fails if it is.
- [ ] The shared admin token and its routes are removed.
- [ ] Unauthenticated requests are rejected on every protected route.
- [ ] Role permissions are enforced for read, create, update, archive and action routes.
- [ ] The edit-mode toggle and draft routes require the configure permission.
- [ ] Users see only permitted modules, and a direct URL to a hidden module fails.
- [ ] Sensitive properties are excluded from queries a user may not read.
- [ ] Actor columns and audit events record real users.
- [ ] Every deferred criterion listed above passes.
- [ ] The password hashing spike result is recorded and the chosen hashing settings fit the free plan's CPU limit, or an alternative is documented.
- [ ] Admins can create users, assign roles, reset passwords and disable accounts, and users cannot register themselves.
- [ ] Password hashes and session tokens are never returned by any route or written to logs.
- [ ] Sessions expire when idle and in absolute time, and a disabled account loses access within 60 seconds.
- [ ] Repeated failed sign-ins are rate limited and locked out, and an admin can clear the lockout.
- [ ] The first admin is created from a secret, not from source code.
- [ ] The release checklist rule "no real data before authentication" can now be lifted for an environment only after these checks pass in it.

## Tests

Password hashing time on the free plan; session expiry and revocation; lockout and rate limiting; first-admin bootstrap; route-policy inventory coverage; unauthorized and forbidden requests per route; role matrix; session expiry; token removal; sensitive field leakage through search, sort, group and aggregates; toggle gating; audit of denied access; configuration of `dev-open` outside development.

## Out of scope

Enterprise identity federation, SSO provisioning, self-registration, email-based password reset, MFA (later), custom role editing (see the open question in Decisions), complex approval workflows and per-record sharing rules.
