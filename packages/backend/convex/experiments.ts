import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthContext } from "./lib/auth";

export const start = mutation({
  args: {
    datasetId: v.id("datasets"),
    name: v.string(),
    retrieverConfig: v.any(),
    k: v.number(),
    metricNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId, userId } = await getAuthContext(ctx);

    // Verify dataset belongs to org
    const dataset = await ctx.db.get(args.datasetId);
    if (!dataset || dataset.orgId !== orgId) {
      throw new Error("Dataset not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .unique();
    if (!user) throw new Error("User not found");

    const experimentId = await ctx.db.insert("experiments", {
      orgId,
      datasetId: args.datasetId,
      name: args.name,
      retrieverConfig: args.retrieverConfig,
      k: args.k,
      metricNames: args.metricNames,
      status: "pending",
      createdBy: user._id,
      createdAt: Date.now(),
    });

    const jobId = await ctx.db.insert("jobs", {
      orgId,
      type: "experiment",
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    // Schedule the indexing phase
    await ctx.scheduler.runAfter(
      0,
      internal.experimentActions.runIndexing,
      {
        jobId,
        experimentId,
        datasetId: args.datasetId,
        kbId: dataset.kbId,
      },
    );

    return { experimentId, jobId };
  },
});

/**
 * Internal query: get experiment by ID (no auth check).
 */
export const getInternal = internalQuery({
  args: { id: v.id("experiments") },
  handler: async (ctx, args) => {
    const exp = await ctx.db.get(args.id);
    if (!exp) throw new Error("Experiment not found");
    return exp;
  },
});

/**
 * Internal mutation: update experiment status and scores.
 */
export const updateStatus = internalMutation({
  args: {
    experimentId: v.id("experiments"),
    status: v.string(),
    scores: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.scores !== undefined) patch.scores = args.scores;
    if (args.error !== undefined) patch.error = args.error;
    await ctx.db.patch(args.experimentId, patch);
  },
});

export const byDataset = query({
  args: { datasetId: v.id("datasets") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthContext(ctx);

    const dataset = await ctx.db.get(args.datasetId);
    if (!dataset || dataset.orgId !== orgId) {
      throw new Error("Dataset not found");
    }

    return await ctx.db
      .query("experiments")
      .withIndex("by_dataset", (q) => q.eq("datasetId", args.datasetId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("experiments") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthContext(ctx);

    const exp = await ctx.db.get(args.id);
    if (!exp || exp.orgId !== orgId) {
      throw new Error("Experiment not found");
    }
    return exp;
  },
});
