import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { call } from "./helpers";
import { installSeed } from "../src/platform/config/seed";
import { previewUpgrade, applyUpgrade } from "../src/platform/config/seed-upgrade";
import { expandSeed } from "../src/platform/config/seed";
import { imamMobileSeed } from "../../applications/imam-mobile/seed/package";
import { imamMobileSeedV2 } from "./fixtures/seed-v2";

const actor = { id: "dev-placeholder", kind: "placeholder" as const, permissions: ["*"] };

describe("seed version 3 (Story 04, slice 04e)", () => {
  beforeEach(async () => { await installSeed(env.DB, imamMobileSeedV2, actor); });

  it("is version 3 and adds exactly the four properties for the columns of migration 0009", async () => {
    expect(imamMobileSeed.version).toBe(3);
    const v2 = await expandSeed(imamMobileSeedV2), v3 = await expandSeed(imamMobileSeed);
    const ids2 = new Set(v2.items.map((i) => i.itemId));
    expect(v3.items.length).toBe(v2.items.length + 4);
    expect([...ids2].every((id) => v3.items.some((i) => i.itemId === id))).toBe(true);
    expect(v3.items.filter((i) => !ids2.has(i.itemId)).map((i) => i.seedKey).sort()).toEqual(["customers.archived_at", "devices.archived_at", "ledger.updated_at", "sales.updated_at"]);
  });

  it("previews four additions, applies them as release 2, and maps every column of the four tables", async () => {
    const plan = await previewUpgrade(env.DB, imamMobileSeed);
    expect(plan.counts).toMatchObject({ add: 4, update: 0, unchanged: 61, conflict: 0, deprecate: 0 });
    const result = await applyUpgrade(env.DB, imamMobileSeed, { planHash: plan.planHash }, actor);
    expect(result).toMatchObject({ status: "applied", version: 3, releaseVersion: 2 });
    const compat = (await call("GET", "/api/platform/schema-compatibility")).json;
    expect(compat.ok).toBe(true);
    for (const ds of compat.dataSources) expect(ds.unmapped, ds.key).toEqual([]);
    expect((await call("GET", "/api/platform/properties?dataSource=sales")).json.properties.map((p: any) => p.key)).toContain("updated_at");
  });
});
