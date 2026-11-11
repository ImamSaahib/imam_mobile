import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import { resetRuntimeState } from "../src/platform/runtime";

// Migrations run once per test file against that file's local D1 database.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// D1 data is not rolled back between tests in a file, so each test starts from empty business tables.
beforeEach(async () => {
  resetRuntimeState();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM customer_entries"),
    env.DB.prepare("DELETE FROM sale_items"),
    env.DB.prepare("DELETE FROM sales"),
    env.DB.prepare("DELETE FROM mobile_devices"),
    env.DB.prepare("DELETE FROM customers"),
    env.DB.prepare("DELETE FROM custom_field_values"),
    env.DB.prepare("DELETE FROM schema_change_log"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM usage_daily"),
    env.DB.prepare("UPDATE data_source_versions SET version=1"),
    // Business tables are empty, so counters are zero. This is the state migration 0009 leaves on an empty database.
    env.DB.prepare("DELETE FROM data_source_counters"),
    env.DB.prepare("INSERT INTO data_source_counters (data_source_key, counter_key, value, updated_at) VALUES ('devices','total',0,datetime('now')),('customers','total',0,datetime('now')),('ledger','total',0,datetime('now')),('sales','total',0,datetime('now'))"),
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
