import { expect, describe, it, beforeEach } from "vitest";
import { setupTest, seedUser, testIdentity } from "./helpers";
import { api } from "../convex/_generated/api";

describe("knowledgeBases: create with metadata", () => {
  let t: ReturnType<typeof import("convex-test").convexTest>;
  beforeEach(() => {
    t = setupTest();
  });

  it("creates a KB with industry and company metadata", async () => {
    await seedUser(t);
    const authedT = t.withIdentity(testIdentity);
    const kbId = await authedT.mutation(api.crud.knowledgeBases.create, {
      name: "JPMorgan Chase Support",
      description: "Customer support KB",
      industry: "finance",
      subIndustry: "retail-banking",
      company: "JPMorgan Chase",
      entityType: "company",
      sourceUrl: "https://www.chase.com/support",
      tags: ["fortune-500", "cx", "support"],
    });
    const kb = await t.run(async (ctx) => ctx.db.get(kbId));
    expect(kb!.industry).toBe("finance");
    expect(kb!.company).toBe("JPMorgan Chase");
    expect(kb!.tags).toEqual(["fortune-500", "cx", "support"]);
  });

  it("creates a KB without metadata (backward compatible)", async () => {
    await seedUser(t);
    const authedT = t.withIdentity(testIdentity);
    const kbId = await authedT.mutation(api.crud.knowledgeBases.create, {
      name: "Basic KB",
    });
    const kb = await t.run(async (ctx) => ctx.db.get(kbId));
    expect(kb!.name).toBe("Basic KB");
    expect(kb!.industry).toBeUndefined();
  });
});
