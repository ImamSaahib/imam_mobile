# Story 02 — Authentication, Authorization and Deployment Boundary

**Priority:** P0 · **Depends on:** Story 01 · **Security rules apply to every subsequent story**  
**Goal:** Establish an explicit security policy and independent client-installation boundary before building editors and data access.

## User story

As a client application owner, I need users and API operations to be authenticated and authorized within my deployment so one client's credentials or data can never be shared with another client deployment.

## Scope

1. Inspect current authentication and temporary admin-token behavior.
2. Select a supported authentication/session approach suitable for a client-owned Cloudflare deployment. Evaluate Cloudflare Access or a maintained identity provider before implementing custom password storage.
3. Define a permission matrix for Admin, Manager and User presets.
4. Enforce authorization in Worker middleware/service boundaries, not only in React.
5. Define policies for bootstrap, metadata reads, configuration writes, record CRUD, domain actions, publishing, migrations and health endpoints.
6. Ensure each deployment uses independent identity configuration, secrets, sessions and allowed origins.
7. Remove any assumption that a frontend lock/edit toggle or hidden control grants security.
8. Document client setup inputs required for authentication and CORS.

## Permission baseline

Role names are presets, not authorization logic. Map roles to capabilities such as:
- platform.configure;
- application.read/manage;
- module.read/manage;
- table.read/create/update/delete;
- configuration.validate/publish;
- action.execute by action key.

Initial behavior:
- Admin: full approved application administration.
- Manager: read/create/update within assigned scope; no unrestricted destructive/configuration operations.
- User: read-only.

The exact matrix must be recorded and tested before production multi-user use.

## Security constraints

- Never embed secrets in Vite variables, static assets, repository files or client-side code.
- Temporary development tokens are not production authentication.
- Every Worker route must declare authentication and authorization requirements.
- Sensitive properties must be protected in API responses and query services.
- Use explicit CORS allowlists for each client environment; do not use wildcard origins with credentials.
- Avoid building a custom enterprise ACL language.

## Acceptance criteria

- [ ] Authentication provider and session strategy are documented and configured for the client deployment.
- [ ] Every API route has an explicit policy, including intentionally public health/bootstrap routes.
- [ ] Admin/Manager/User permissions are enforced server-side.
- [ ] Direct API calls cannot bypass UI restrictions.
- [ ] No secret is present in the frontend bundle or repository.
- [ ] Development and production auth secrets/origins are independent.
- [ ] Session expiry/logout and unauthorized responses behave consistently.
- [ ] Sensitive fields cannot be retrieved by users lacking permission.
- [ ] Audit hooks exist for sensitive operations, even if full audit UI is deferred.

## Tests

Role/action matrix; unauthenticated calls; direct API bypass attempts; sensitive property access; CORS; session expiry; secret scan; route-policy coverage.

## Out of scope

Enterprise SSO catalog, arbitrary ACL scripting, cross-client identity federation and multi-tenant identity management.
