import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

// Migrations run once per test file against that file's local D1 database.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// D1 data is not rolled back between tests in a file, so each test starts from empty business tables.
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM customer_entries"),
    env.DB.prepare("DELETE FROM sale_items"),
    env.DB.prepare("DELETE FROM sales"),
    env.DB.prepare("DELETE FROM mobile_devices"),
    env.DB.prepare("DELETE FROM customers"),
    env.DB.prepare("DELETE FROM custom_field_values"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM cfg_active_release"),
    env.DB.prepare("DELETE FROM cfg_release"),
    env.DB.prepare("DELETE FROM cfg_seed_item"),
    env.DB.prepare("DELETE FROM cfg_seed_package"),
    env.DB.prepare("DELETE FROM cfg_property"),
    env.DB.prepare("DELETE FROM cfg_data_source"),
    env.DB.prepare("DELETE FROM cfg_component"),
    env.DB.prepare("DELETE FROM cfg_module"),
    env.DB.prepare("DELETE FROM cfg_menu"),
    env.DB.prepare("DELETE FROM cfg_page"),
    env.DB.prepare("DELETE FROM cfg_application")
  ]);
});
