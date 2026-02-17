import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthContext } from "./lib/auth";

/**
 * Start question generation for a knowledge base.
 * Creates a dataset, a tracking job, and schedules the first generation phase.
 */
export const start = mutation({
  args: {
    kbId: v.id("knowledgeBases"),
    name: v.string(),
    strategy: v.string(),
    strategyConfig: v.any(),
  },
  handler: async (ctx, args) => {
    const { orgId, userId } = await getAuthContext(ctx);

    const kb = await ctx.db.get(args.kbId);
    if (!kb || kb.orgId !== orgId) {
      throw new Error("Knowledge base not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .unique();
    if (!user) throw new Error("User not found");

    const datasetId = await ctx.db.insert("datasets", {
      orgId,
      kbId: args.kbId,
      name: args.name,
      strategy: args.strategy,
      strategyConfig: args.strategyConfig,
      questionCount: 0,
      metadata: {},
      createdBy: user._id,
      createdAt: Date.now(),
    });

    const jobId = await ctx.db.insert("jobs", {
      orgId,
      type: "generation",
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    const actionArgs = { jobId, datasetId, kbId: args.kbId };

    switch (args.strategy) {
      case "simple":
        await ctx.scheduler.runAfter(
          0,
          internal.generationActions.simpleGenerate,
          actionArgs,
        );
        break;
      case "dimension-driven":
        await ctx.scheduler.runAfter(
          0,
          internal.generationActions.dimensionDrivenGenerate,
          actionArgs,
        );
        break;
      case "real-world-grounded":
        await ctx.scheduler.runAfter(
          0,
          internal.generationActions.realWorldGroundedGenerate,
          actionArgs,
        );
        break;
      default:
        throw new Error(`Unknown strategy: ${args.strategy}`);
    }

    return { datasetId, jobId };
  },
});
