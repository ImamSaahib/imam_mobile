// Placeholder policy layer (Decisions D7). Story 11 replaces getActor() and authorize()
// with real authentication and role evaluation. Route code does not change.
//
// Every API route declares the permission it requires in ROUTE_POLICY. The Worker resolves the
// route once, resolves the actor once, and calls authorize(). A test fails if a route in the
// Worker has no entry here.

export type Actor = {
  id: string;
  kind: "placeholder" | "user";
  permissions: string[]; // "*" means every permission (placeholder only)
};

export type RoutePolicy = {
  method: string;
  /** Path pattern. ":id" matches one positive integer segment. */
  pattern: string;
  /** Permission name. "public" means no sign-in is required, now and after Story 11. */
  permission: string;
};

// Permission names are defined here in code. Roles (Story 11) map to these names.
export const PERMISSIONS = {
  public: "public",
  configurationRead: "configuration.read",
  configurationConfigure: "configuration.configure",
  schemaInspect: "schema.inspect",
  schemaChange: "schema.change",
  customFieldsRead: "customFields.read",
  customFieldsWrite: "customFields.write",
  devicesRead: "devices.read",
  devicesCreate: "devices.create",
  devicesUpdate: "devices.update",
  devicesDelete: "devices.delete",
  customersRead: "customers.read",
  customersCreate: "customers.create",
  customersUpdate: "customers.update",
  customersDelete: "customers.delete",
  ledgerRead: "ledger.read",
  ledgerCreate: "ledger.create",
  ledgerUpdate: "ledger.update",
  ledgerDelete: "ledger.delete",
  platformSeed: "platform.seed",
  salesRead: "sales.read",
  salesCreate: "sales.create"
} as const;

const P = PERMISSIONS;

export const ROUTE_POLICY: RoutePolicy[] = [
  { method: "GET", pattern: "/api/health", permission: P.public },
  { method: "GET", pattern: "/api/configuration", permission: P.configurationRead },
  { method: "GET", pattern: "/api/bootstrap", permission: P.configurationRead },
  { method: "POST", pattern: "/api/platform/seed", permission: P.platformSeed },
  { method: "POST", pattern: "/api/platform/seed/preview", permission: P.platformSeed },
  { method: "POST", pattern: "/api/platform/seed/upgrade", permission: P.platformSeed },
  { method: "GET", pattern: "/api/platform/schema-compatibility", permission: P.schemaInspect },

  // Legacy admin routes. The shared bearer token still guards them until Story 07 replaces them
  // and Story 11 removes the token (see docs/platform/legacy-inventory.md).
  { method: "GET", pattern: "/api/admin/configuration", permission: P.configurationConfigure },
  { method: "PUT", pattern: "/api/admin/configuration", permission: P.configurationConfigure },
  { method: "POST", pattern: "/api/admin/configuration/publish", permission: P.configurationConfigure },
  { method: "GET", pattern: "/api/admin/configuration/versions", permission: P.configurationConfigure },
  { method: "POST", pattern: "/api/admin/configuration/restore", permission: P.configurationConfigure },
  { method: "GET", pattern: "/api/admin/schema", permission: P.schemaInspect },
  { method: "POST", pattern: "/api/admin/schema/add-column", permission: P.schemaChange },
  { method: "POST", pattern: "/api/admin/schema/columns", permission: P.schemaChange },
  { method: "POST", pattern: "/api/admin/schema/indexes", permission: P.schemaChange },

  { method: "GET", pattern: "/api/custom-field-values", permission: P.customFieldsRead },
  { method: "POST", pattern: "/api/custom-field-values", permission: P.customFieldsWrite },

  { method: "GET", pattern: "/api/devices", permission: P.devicesRead },
  { method: "POST", pattern: "/api/devices", permission: P.devicesCreate },
  { method: "PATCH", pattern: "/api/devices/:id", permission: P.devicesUpdate },
  { method: "DELETE", pattern: "/api/devices/:id", permission: P.devicesDelete },

  { method: "GET", pattern: "/api/customers", permission: P.customersRead },
  { method: "POST", pattern: "/api/customers", permission: P.customersCreate },
  { method: "PATCH", pattern: "/api/customers/:id", permission: P.customersUpdate },
  { method: "DELETE", pattern: "/api/customers/:id", permission: P.customersDelete },

  { method: "GET", pattern: "/api/customer-entries", permission: P.ledgerRead },
  { method: "POST", pattern: "/api/customer-entries", permission: P.ledgerCreate },
  { method: "PATCH", pattern: "/api/customer-entries/:id", permission: P.ledgerUpdate },
  { method: "DELETE", pattern: "/api/customer-entries/:id", permission: P.ledgerDelete },

  { method: "GET", pattern: "/api/sales", permission: P.salesRead },
  { method: "POST", pattern: "/api/sales", permission: P.salesCreate }
];

function matches(pattern: string, path: string): boolean {
  const want = pattern.split("/").filter(Boolean);
  const have = path.split("/").filter(Boolean);
  if (want.length !== have.length) return false;
  return want.every((segment, i) => (segment === ":id" ? /^\d+$/.test(have[i]) && Number(have[i]) > 0 : segment === have[i]));
}

/** Finds the policy entry for a request, or null when the route is unknown. */
export function matchRoute(method: string, path: string): RoutePolicy | null {
  return ROUTE_POLICY.find((route) => route.method === method && matches(route.pattern, path)) ?? null;
}

export type PolicyEnv = { ENVIRONMENT?: string; AUTH_MODE?: string };

/** True only when open access is explicitly enabled in an explicitly development environment. */
export function devOpenActive(env: PolicyEnv): boolean {
  return env.AUTH_MODE === "dev-open" && env.ENVIRONMENT === "development";
}

/** Resolves who is calling. Placeholder: nobody is authenticated until Story 11. */
export function getActor(_request: Request, env: PolicyEnv): Actor | null {
  if (devOpenActive(env)) return { id: "dev-placeholder", kind: "placeholder", permissions: ["*"] };
  return null;
}

/** Decides whether an actor holds a permission. Story 11 replaces this with role evaluation. */
export function authorize(actor: Actor | null, permission: string): boolean {
  if (permission === PERMISSIONS.public) return true;
  if (!actor) return false;
  return actor.permissions.includes("*") || actor.permissions.includes(permission);
}

export type PolicyHealth = { ok: boolean; mode: "dev-open" | "enforced"; message?: string };

/** The health check fails when open access is requested anywhere except development. */
export function policyHealth(env: PolicyEnv): PolicyHealth {
  if (env.AUTH_MODE === "dev-open" && env.ENVIRONMENT !== "development") {
    return { ok: false, mode: "dev-open", message: "AUTH_MODE=dev-open is only allowed when ENVIRONMENT=development." };
  }
  return { ok: true, mode: devOpenActive(env) ? "dev-open" : "enforced" };
}
