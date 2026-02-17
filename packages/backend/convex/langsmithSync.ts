"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  uploadDataset,
  QueryId,
  QueryText,
  DocumentId,
  type GroundTruth,
  type CharacterSpan,
} from "rag-evaluation-system";

// ─── Dataset Sync ───

/**
 * Sync a dataset to LangSmith.
 * Reads all questions, converts to GroundTruth[], uploads via eval-lib.
 */
export const syncDataset = internalAction({
  args: {
    datasetId: v.id("datasets"),
  },
  handler: async (ctx, args) => {
    // Update sync status to syncing
    await ctx.runMutation(internal.datasets.updateSyncStatus, {
      datasetId: args.datasetId,
      langsmithSyncStatus: "syncing",
    });

    try {
      const dataset = await ctx.runQuery(internal.datasets.getInternal, {
        id: args.datasetId,
      });

      const questions = await ctx.runQuery(
        internal.questions.byDatasetInternal,
        { datasetId: args.datasetId },
      );

      if (questions.length === 0) {
        await ctx.runMutation(internal.datasets.updateSyncStatus, {
          datasetId: args.datasetId,
          langsmithSyncStatus: "skipped",
        });
        return;
      }

      // Convert questions to GroundTruth format
      const groundTruth: GroundTruth[] = questions.map(
        (q: any, i: number) => ({
          query: {
            id: QueryId(q.queryId || `q_${i}`),
            text: QueryText(q.queryText),
            metadata: {
              sourceDoc: q.sourceDocId,
              ...(q.metadata ?? {}),
            },
          },
          relevantSpans: (q.relevantSpans ?? []).map(
            (s: any) =>
              ({
                docId: DocumentId(s.docId),
                start: s.start,
                end: s.end,
                text: s.text,
              }) as CharacterSpan,
          ),
        }),
      );

      // Upload to LangSmith
      const result = await uploadDataset(groundTruth, {
        datasetName: dataset.name,
        description: `RAG evaluation dataset: ${dataset.strategy} strategy, ${questions.length} questions`,
        metadata: {
          strategy: dataset.strategy,
          convexDatasetId: args.datasetId,
        },
      });

      // Update dataset with LangSmith info
      await ctx.runMutation(internal.datasets.updateSyncStatus, {
        datasetId: args.datasetId,
        langsmithDatasetId: result.datasetName,
        langsmithUrl: result.datasetUrl,
        langsmithSyncStatus: "synced",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.datasets.updateSyncStatus, {
        datasetId: args.datasetId,
        langsmithSyncStatus: `failed: ${message}`,
      });
    }
  },
});

// ─── Experiment Sync ───

/**
 * Sync experiment results to LangSmith.
 * Creates a LangSmith experiment with the per-question results.
 */
export const syncExperiment = internalAction({
  args: {
    experimentId: v.id("experiments"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.experiments.updateStatus, {
      experimentId: args.experimentId,
      status: "completed",
    });

    try {
      const experiment = await ctx.runQuery(internal.experiments.getInternal, {
        id: args.experimentId,
      });

      // Ensure dataset is synced first
      const dataset = await ctx.runQuery(internal.datasets.getInternal, {
        id: experiment.datasetId,
      });

      if (!dataset.langsmithDatasetId) {
        // Dataset not synced yet, sync it first
        await syncDatasetDirect(ctx, experiment.datasetId);
      }

      const results = await ctx.runQuery(
        internal.experimentResults.byExperimentInternal,
        { experimentId: args.experimentId },
      );

      if (results.length === 0) return;

      // Use LangSmith SDK to push experiment results
      const { getLangSmithClient } = await import("rag-evaluation-system");
      const client = await getLangSmithClient();

      // Create a project (experiment) in LangSmith
      const projectName = `${experiment.name}-${Date.now()}`;

      // Push each result as a run
      for (const result of results) {
        const question = await ctx.runQuery(internal.questions.getInternal, {
          id: result.questionId,
        });

        await client.createRun({
          name: "retrieval",
          run_type: "chain",
          project_name: projectName,
          inputs: { query: question.queryText },
          outputs: {
            retrievedSpans: result.retrievedSpans,
          },
          extra: {
            metadata: {
              scores: result.scores,
              experimentId: args.experimentId,
            },
          },
        });
      }

      // Update experiment with LangSmith info
      await ctx.runMutation(internal.experiments.updateStatus, {
        experimentId: args.experimentId,
        status: "completed",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      // Don't fail the experiment — sync failure is non-critical
      console.error(`LangSmith experiment sync failed: ${message}`);
    }
  },
});

/**
 * Helper: sync a dataset directly (used when experiment sync needs it).
 */
async function syncDatasetDirect(
  ctx: { runQuery: any; runMutation: any },
  datasetId: any,
) {
  const dataset = await ctx.runQuery(internal.datasets.getInternal, {
    id: datasetId,
  });

  const questions = await ctx.runQuery(
    internal.questions.byDatasetInternal,
    { datasetId },
  );

  if (questions.length === 0) return;

  const groundTruth: GroundTruth[] = questions.map((q: any, i: number) => ({
    query: {
      id: QueryId(q.queryId || `q_${i}`),
      text: QueryText(q.queryText),
      metadata: { sourceDoc: q.sourceDocId, ...(q.metadata ?? {}) },
    },
    relevantSpans: (q.relevantSpans ?? []).map(
      (s: any) =>
        ({
          docId: DocumentId(s.docId),
          start: s.start,
          end: s.end,
          text: s.text,
        }) as CharacterSpan,
    ),
  }));

  const result = await uploadDataset(groundTruth, {
    datasetName: dataset.name,
    metadata: {
      strategy: dataset.strategy,
      convexDatasetId: datasetId,
    },
  });

  await ctx.runMutation(internal.datasets.updateSyncStatus, {
    datasetId,
    langsmithDatasetId: result.datasetName,
    langsmithUrl: result.datasetUrl,
    langsmithSyncStatus: "synced",
  });
}

// Manual retry mutations are in langsmithRetry.ts (mutations can't be in "use node" files)
