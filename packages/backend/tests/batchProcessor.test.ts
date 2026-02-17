import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

describe("batch processor", () => {
  it("should process all items successfully", async () => {
    const t = convexTest(schema, modules);

    // Create a job
    const jobId = await t.mutation(internal.testing.createTestJob, {
      type: "test",
      orgId: "org_test",
    });

    // Initialize items
    await t.mutation(internal.jobItems.initPhase, {
      jobId,
      phase: "test",
      items: [
        { itemKey: "1" },
        { itemKey: "2" },
        { itemKey: "3" },
      ],
    });

    // Run the batch action
    await t.action(internal.testing.testBatchAction, { jobId });

    // Check all items are done
    const items = await t.mutation(internal.testing.getTestJobItems, {
      jobId,
      phase: "test",
    });

    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.status).toBe("done");
      expect(item.processedAt).toBeDefined();
    }

    // Verify results
    const item1 = items.find((i: any) => i.itemKey === "1");
    expect(item1?.result).toEqual({ doubled: 2 });
    const item2 = items.find((i: any) => i.itemKey === "2");
    expect(item2?.result).toEqual({ doubled: 4 });
    const item3 = items.find((i: any) => i.itemKey === "3");
    expect(item3?.result).toEqual({ doubled: 6 });

    // Check job is completed (no next phase configured, so it should auto-complete)
    const job = await t.mutation(internal.testing.getTestJob, { jobId });
    expect(job?.status).toBe("completed");
  });

  it("should handle failed items without stopping the batch", async () => {
    const t = convexTest(schema, modules);

    const jobId = await t.mutation(internal.testing.createTestJob, {
      type: "test",
      orgId: "org_test",
    });

    await t.mutation(internal.jobItems.initPhase, {
      jobId,
      phase: "test",
      items: [
        { itemKey: "1" },
        { itemKey: "fail" },
        { itemKey: "3" },
      ],
    });

    await t.action(internal.testing.testBatchAction, { jobId });

    const items = await t.mutation(internal.testing.getTestJobItems, {
      jobId,
      phase: "test",
    });

    // All items should be processed
    expect(items).toHaveLength(3);

    // Item 1 and 3 succeed
    const item1 = items.find((i: any) => i.itemKey === "1");
    expect(item1?.status).toBe("done");
    expect(item1?.result).toEqual({ doubled: 2 });

    const item3 = items.find((i: any) => i.itemKey === "3");
    expect(item3?.status).toBe("done");
    expect(item3?.result).toEqual({ doubled: 6 });

    // Item "fail" should be marked failed
    const failItem = items.find((i: any) => i.itemKey === "fail");
    expect(failItem?.status).toBe("failed");
    expect(failItem?.error).toBe("intentional failure");
  });

  it("should update progress during processing", async () => {
    const t = convexTest(schema, modules);

    const jobId = await t.mutation(internal.testing.createTestJob, {
      type: "test",
      orgId: "org_test",
    });

    await t.mutation(internal.jobItems.initPhase, {
      jobId,
      phase: "test",
      items: [
        { itemKey: "1" },
        { itemKey: "2" },
      ],
    });

    await t.action(internal.testing.testBatchAction, { jobId });

    // After completion, job should have progress info
    const job = await t.mutation(internal.testing.getTestJob, { jobId });
    expect(job?.progress).toBeDefined();
    expect(job?.progress?.total).toBe(2);
    expect(job?.progress?.current).toBe(2);
    expect(job?.progress?.message).toContain("Testing batch");
  });

  it("should handle empty items (no pending items)", async () => {
    const t = convexTest(schema, modules);

    const jobId = await t.mutation(internal.testing.createTestJob, {
      type: "test",
      orgId: "org_test",
    });

    // Don't initialize any items — phase has 0 pending items
    await t.action(internal.testing.testBatchAction, { jobId });

    const job = await t.mutation(internal.testing.getTestJob, { jobId });
    // With no items and no nextPhaseAction, job should be completed
    expect(job?.status).toBe("completed");
  });

  it("should be idempotent for initPhase (skip if already initialized)", async () => {
    const t = convexTest(schema, modules);

    const jobId = await t.mutation(internal.testing.createTestJob, {
      type: "test",
      orgId: "org_test",
    });

    // Initialize items twice
    await t.mutation(internal.jobItems.initPhase, {
      jobId,
      phase: "test",
      items: [{ itemKey: "1" }, { itemKey: "2" }],
    });

    await t.mutation(internal.jobItems.initPhase, {
      jobId,
      phase: "test",
      items: [{ itemKey: "3" }, { itemKey: "4" }],
    });

    // Only the first batch should exist
    const items = await t.mutation(internal.testing.getTestJobItems, {
      jobId,
      phase: "test",
    });
    expect(items).toHaveLength(2);
    expect(items.map((i: any) => i.itemKey).sort()).toEqual(["1", "2"]);
  });
});
