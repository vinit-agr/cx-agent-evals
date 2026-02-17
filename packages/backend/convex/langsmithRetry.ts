import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthContext } from "./lib/auth";

/**
 * Manually retry a failed LangSmith sync for a dataset.
 */
export const retryDatasetSync = mutation({
  args: { datasetId: v.id("datasets") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthContext(ctx);

    const dataset = await ctx.db.get(args.datasetId);
    if (!dataset || dataset.orgId !== orgId) {
      throw new Error("Dataset not found");
    }

    await ctx.scheduler.runAfter(0, internal.langsmithSync.syncDataset, {
      datasetId: args.datasetId,
    });
  },
});

/**
 * Manually retry a failed LangSmith sync for an experiment.
 */
export const retryExperimentSync = mutation({
  args: { experimentId: v.id("experiments") },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthContext(ctx);

    const experiment = await ctx.db.get(args.experimentId);
    if (!experiment || experiment.orgId !== orgId) {
      throw new Error("Experiment not found");
    }

    await ctx.scheduler.runAfter(
      0,
      internal.langsmithSync.syncExperiment,
      { experimentId: args.experimentId },
    );
  },
});
