import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { imamMobileSeed } from "../../applications/imam-mobile/seed/package";
import { isBlockedTable } from "../src/platform/config/compat";

// Story 04, slice 04f. Guards the developer migration process (docs/platform/MIGRATIONS.md).

describe("migration files", () => {
  const names = (env.TEST_MIGRATIONS as { name: string }[]).map((m) => m.name);

  it("are named NNNN_snake_case.sql", () => {
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).toMatch(/^\d{4}_[a-z][a-z0-9_]*\.sql$/);
  });

  it("have unique numbers, in order, starting at 0001 with no gaps", () => {
    const numbers = names.map((n) => Number(n.slice(0, 4)));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it("have unique names", () => {
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("approved data sources", () => {
  it("each map to an existing, approved application table, and no two share a table", async () => {
    const tables = new Set<string>();
    for (const ds of imamMobileSeed.dataSources) {
      expect(isBlockedTable(ds.tableName), `${ds.key} uses a blocked table`).toBe(false);
      const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(ds.tableName).first();
      expect(row, `table ${ds.tableName} of ${ds.key} does not exist`).not.toBeNull();
      expect(tables.has(ds.tableName), `${ds.tableName} is mapped twice`).toBe(false);
      tables.add(ds.tableName);
    }
    expect(tables.size).toBe(imamMobileSeed.dataSources.length);
  });

  it("each have an updated_at column and an index on it (storage rules)", async () => {
    for (const ds of imamMobileSeed.dataSources) {
      const cols = (await env.DB.prepare(`PRAGMA table_info("${ds.tableName}")`).all()).results.map((c) => c.name);
      expect(cols, ds.tableName).toContain("updated_at");
      const idx = (await env.DB.prepare(`PRAGMA index_list("${ds.tableName}")`).all()).results;
      const onUpdated = [];
      for (const i of idx) {
        const info = (await env.DB.prepare(`PRAGMA index_info("${i.name}")`).all()).results.map((c) => c.name);
        if (info[0] === "updated_at") onUpdated.push(i.name);
      }
      expect(onUpdated.length, `${ds.tableName} has no index starting with updated_at`).toBeGreaterThan(0);
    }
  });
});
