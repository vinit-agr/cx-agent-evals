import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthContext } from "./lib/auth";

export const create = mutation({
  args: {
    type: v.string(),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { orgId, userId } = await getAuthContext(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("jobs", {
      orgId,
      type: args.type,
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthContext(ctx);

    const job = await ctx.db.get(args.id);
    if (!job || job.orgId !== orgId) {
      throw new Error("Job not found");
    }
    return job;
  },
});

export const listByOrg = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthContext(ctx);

    if (args.status) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", args.status!),
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("jobs")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
  },
});

/**
 * Internal mutation to update job status/progress.
 * Called from actions during batch processing.
 */
export const update = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.optional(v.string()),
    phase: v.optional(v.string()),
    progress: v.optional(
      v.object({
        current: v.number(),
        total: v.number(),
        message: v.optional(v.string()),
      }),
    ),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    intermediateState: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    const patch: Record<string, unknown> = {};

    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.phase !== undefined) patch.phase = updates.phase;
    if (updates.progress !== undefined) patch.progress = updates.progress;
    if (updates.result !== undefined) patch.result = updates.result;
    if (updates.error !== undefined) patch.error = updates.error;
    if (updates.retryCount !== undefined) patch.retryCount = updates.retryCount;
    if (updates.intermediateState !== undefined)
      patch.intermediateState = updates.intermediateState;

    await ctx.db.patch(jobId, patch);
  },
});

/**
 * Watchdog: detects stalled jobs and re-schedules batch processing.
 * Scheduled by each batch action with an 11-minute delay.
 * If the job hasn't progressed past the expected phase, it's stalled.
 */
export const watchdog = internalMutation({
  args: {
    jobId: v.id("jobs"),
    expectedPhase: v.string(),
    expectedProgress: v.optional(v.number()),
    resumeAction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    // If job has moved past the expected phase or completed, no-op
    if (job.status !== "running") return;
    if (job.phase !== args.expectedPhase) return;

    // Check if progress has changed (if we have an expected value)
    if (
      args.expectedProgress !== undefined &&
      job.progress &&
      job.progress.current > args.expectedProgress
    ) {
      return; // Progress was made, not stalled
    }

    // Job is stalled — log and mark for retry
    // The batch processor framework will handle re-scheduling
    // For now, just update the error so it's visible
    await ctx.db.patch(args.jobId, {
      error: `Watchdog: stalled in phase "${args.expectedPhase}". Will retry.`,
    });
  },
});
