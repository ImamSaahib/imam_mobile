import type { D1Migration } from "@cloudflare/vitest-plugin";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      ADMIN_CONFIG_TOKEN?: string;
      ENVIRONMENT?: string;
      AUTH_MODE?: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
export {};
