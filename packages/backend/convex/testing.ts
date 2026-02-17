/**
 * Test-only Convex functions for integration testing.
 * These are internal functions not exposed to clients.
 */
import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { processBatch } from "./lib/batchProcessor";
import { Id } from "./_generated/dataModel";

/**
 * Create a job directly (bypasses auth for testing).
 */
export const createTestJob = internalMutation({
  args: {
    type: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    // Create a fake user for testing
    const userId = await ctx.db.insert("users", {
      clerkId: "test_user",
      email: "test@example.com",
      name: "Test User",
      createdAt: Date.now(),
    });

    return await ctx.db.insert("jobs", {
      orgId: args.orgId,
      type: args.type,
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      createdBy: userId,
      createdAt: Date.now(),
    });
  },
});

/**
 * A simple batch action for testing the batch processor.
 * processItem doubles the numeric itemKey value.
 * Items with itemKey "fail" will throw an error.
 */
export const testBatchAction = internalAction({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await processBatch(ctx, {
      jobId: args.jobId,
      phase: "test",
      batchSize: 100,
      processItem: async (item) => {
        if (item.itemKey === "fail") {
          throw new Error("intentional failure");
        }
        // Simple processing: return the item key value doubled
        const num = parseInt(item.itemKey, 10);
        return { doubled: isNaN(num) ? 0 : num * 2 };
      },
      phaseMessage: "Testing batch",
      continuationAction: null as any, // Won't be needed if all items fit in one batch
    });
  },
});

/**
 * A batch action with a next phase configured.
 * Used to test phase transitions.
 */
export const testBatchPhase1 = internalAction({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await processBatch(ctx, {
      jobId: args.jobId,
      phase: "phase1",
      batchSize: 100,
      processItem: async (item) => {
        return { processed: item.itemKey };
      },
      phaseMessage: "Phase 1",
      continuationAction: null as any,
      nextPhaseAction: null as any,
      // Note: nextPhaseAction = null means job completes after phase1
    });
  },
});

/**
 * Get a job directly (bypasses auth for testing).
 */
export const getTestJob = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

/**
 * Get all job items for a job+phase (for assertions).
 */
export const getTestJobItems = internalMutation({
  args: {
    jobId: v.id("jobs"),
    phase: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobItems")
      .withIndex("by_job_phase", (q) =>
        q.eq("jobId", args.jobId).eq("phase", args.phase),
      )
      .collect();
  },
});
