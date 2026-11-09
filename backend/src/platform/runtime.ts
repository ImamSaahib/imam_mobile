// Per-instance runtime state (governor, rate limiter, bootstrap cache). Tests reset it before every test.

import { governor, rateLimiter } from "./governor";
import { invalidateBootstrapCache } from "./config/bootstrap";

export function resetRuntimeState() {
  governor.reset();
  rateLimiter.reset();
  invalidateBootstrapCache();
}
