import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Initialize job items for a phase.
 * Creates one jobItem per item with status "pending".
 * Idempotent — skips if items already exist for this job+phase.
 */
export const initPhase = internalMutation({
  args: {
    jobId: v.id("jobs"),
    phase: v.string(),
    items: v.array(v.object({ itemKey: v.string() })),
  },
  handler: async (ctx, args) => {
    // Check if items already exist for this phase (idempotent)
    const existing = await ctx.db
      .query("jobItems")
      .withIndex("by_job_phase", (q) =>
        q.eq("jobId", args.jobId).eq("phase", args.phase),
      )
      .first();

    if (existing) return; // Already initialized

    for (const item of args.items) {
      await ctx.db.insert("jobItems", {
        jobId: args.jobId,
        phase: args.phase,
        itemKey: item.itemKey,
        status: "pending",
      });
    }
  },
});

/**
 * Get the next batch of pending items for a job phase.
 */
export const getPending = internalQuery({
  args: {
    jobId: v.id("jobs"),
    phase: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobItems")
      .withIndex("by_job_phase_status", (q) =>
        q
          .eq("jobId", args.jobId)
          .eq("phase", args.phase)
          .eq("status", "pending"),
      )
      .take(args.limit);
  },
});

/**
 * Mark a job item as done with its result.
 */
export const markDone = internalMutation({
  args: {
    itemId: v.id("jobItems"),
    result: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, {
      status: "done",
      result: args.result,
      processedAt: Date.now(),
    });
  },
});

/**
 * Mark a job item as failed with error details.
 */
export const markFailed = internalMutation({
  args: {
    itemId: v.id("jobItems"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, {
      status: "failed",
      error: args.error,
      processedAt: Date.now(),
    });
  },
});

/**
 * Get progress for a job phase: counts of done, failed, pending items.
 */
export const getProgress = internalQuery({
  args: {
    jobId: v.id("jobs"),
    phase: v.string(),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("jobItems")
      .withIndex("by_job_phase", (q) =>
        q.eq("jobId", args.jobId).eq("phase", args.phase),
      )
      .collect();

    let done = 0;
    let failed = 0;
    let pending = 0;
    for (const item of items) {
      if (item.status === "done") done++;
      else if (item.status === "failed") failed++;
      else pending++;
    }

    return { done, failed, pending, total: items.length };
  },
});
