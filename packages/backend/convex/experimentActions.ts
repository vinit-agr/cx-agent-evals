"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { processBatch } from "./lib/batchProcessor";
import { indexSingleDocument } from "./ragActions";
import {
  recall,
  precision,
  iou,
  f1,
  OpenAIEmbedder,
  type Metric,
  type CharacterSpan,
} from "rag-evaluation-system";
import OpenAI from "openai";

// ─── Helpers ───

const METRICS: Record<string, Metric> = { recall, precision, iou, f1 };

function createEmbedder(model?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const openai = new OpenAI({ apiKey });
  return new OpenAIEmbedder({
    model: model ?? "text-embedding-3-small",
    client: openai,
  });
}

// ─── Phase 1: Indexing ───

/**
 * Index the knowledge base for an experiment.
 * Skips if already indexed; otherwise chunks + embeds all documents.
 */
export const runIndexing = internalAction({
  args: {
    jobId: v.id("jobs"),
    experimentId: v.id("experiments"),
    datasetId: v.id("datasets"),
    kbId: v.id("knowledgeBases"),
  },
  handler: async (ctx, args) => {
    // Check if KB is already indexed
    const isIndexed = await ctx.runQuery(internal.rag.isIndexed, {
      kbId: args.kbId,
    });

    if (isIndexed) {
      await ctx.runMutation(internal.jobs.update, {
        jobId: args.jobId,
        status: "running",
        phase: "indexing",
        progress: {
          current: 1,
          total: 1,
          message: "KB already indexed, skipping...",
        },
      });

      // Go directly to evaluation
      await ctx.scheduler.runAfter(
        0,
        internal.experimentActions.runEvaluation,
        {
          jobId: args.jobId,
          experimentId: args.experimentId,
          datasetId: args.datasetId,
          kbId: args.kbId,
        },
      );
      return;
    }

    // Initialize indexing items on first run
    const progress = await ctx.runQuery(internal.jobItems.getProgress, {
      jobId: args.jobId,
      phase: "indexing",
    });

    if (progress.total === 0) {
      const docs = await ctx.runQuery(internal.documents.listByKbInternal, {
        kbId: args.kbId,
      });
      await ctx.runMutation(internal.jobItems.initPhase, {
        jobId: args.jobId,
        phase: "indexing",
        items: docs.map((d: any) => ({ itemKey: d._id })),
      });
    }

    await processBatch(ctx, {
      jobId: args.jobId,
      phase: "indexing",
      batchSize: 10,
      processItem: async (item) => {
        const docId = item.itemKey as Id<"documents">;
        return await indexSingleDocument(ctx, docId, {});
      },
      phaseMessage: "Indexing documents",
      continuationAction: internal.experimentActions.runIndexing,
      continuationArgs: {
        experimentId: args.experimentId,
        datasetId: args.datasetId,
        kbId: args.kbId,
      },
      nextPhaseAction: internal.experimentActions.runEvaluation,
      nextPhaseArgs: {
        experimentId: args.experimentId,
        datasetId: args.datasetId,
        kbId: args.kbId,
      },
    });
  },
});

// ─── Phase 2: Evaluation ───

/**
 * Evaluate each question: retrieve chunks, compute metrics, save results.
 * Phase: "evaluation" — one job item per question.
 */
export const runEvaluation = internalAction({
  args: {
    jobId: v.id("jobs"),
    experimentId: v.id("experiments"),
    datasetId: v.id("datasets"),
    kbId: v.id("knowledgeBases"),
  },
  handler: async (ctx, args) => {
    // Initialize evaluation items on first run
    const progress = await ctx.runQuery(internal.jobItems.getProgress, {
      jobId: args.jobId,
      phase: "evaluation",
    });

    if (progress.total === 0) {
      const questions = await ctx.runQuery(
        internal.questions.byDatasetInternal,
        { datasetId: args.datasetId },
      );
      await ctx.runMutation(internal.jobItems.initPhase, {
        jobId: args.jobId,
        phase: "evaluation",
        items: questions.map((q: any) => ({ itemKey: q._id })),
      });
    }

    // Load experiment config for k and metric names
    const experiment = await ctx.runQuery(internal.experiments.getInternal, {
      id: args.experimentId,
    });
    const k = experiment.k;
    const metricNames = experiment.metricNames;
    const selectedMetrics = metricNames
      .map((name: string) => METRICS[name])
      .filter(Boolean);

    // Create embedder for query embedding
    const retrieverConfig = experiment.retrieverConfig as Record<
      string,
      unknown
    >;
    const embeddingModel =
      (retrieverConfig.embeddingModel as string) ?? "text-embedding-3-small";
    const embedder = createEmbedder(embeddingModel);

    await processBatch(ctx, {
      jobId: args.jobId,
      phase: "evaluation",
      batchSize: 20,
      processItem: async (item) => {
        const questionId = item.itemKey as Id<"questions">;
        const question = await ctx.runQuery(internal.questions.getInternal, {
          id: questionId,
        });

        // Embed query and vector search (vectorSearch only available in actions)
        const queryEmbedding = await embedder.embedQuery(question.queryText);
        const searchResults = await ctx.vectorSearch(
          "documentChunks",
          "by_embedding",
          {
            vector: queryEmbedding,
            limit: k,
            filter: (q: any) => q.eq("kbId", args.kbId),
          },
        );

        // Hydrate chunk records with docId
        const chunks = await ctx.runQuery(internal.rag.fetchChunksWithDocs, {
          ids: searchResults.map((r: any) => r._id),
        });

        // Convert retrieved chunks to CharacterSpan format
        const retrievedSpans = chunks.map((c: any) => ({
          docId: c.docId,
          start: c.start,
          end: c.end,
          text: c.content,
        }));

        // Ground truth spans from the question
        const groundTruthSpans = (question.relevantSpans ?? []) as Array<{
          docId: string;
          start: number;
          end: number;
          text: string;
        }>;

        // Compute metrics
        const scores: Record<string, number> = {};
        for (const metric of selectedMetrics) {
          scores[metric.name] = metric.calculate(
            retrievedSpans as unknown as CharacterSpan[],
            groundTruthSpans as unknown as CharacterSpan[],
          );
        }

        // Save result
        await ctx.runMutation(internal.experimentResults.insert, {
          experimentId: args.experimentId,
          questionId,
          retrievedSpans,
          scores,
          metadata: {},
        });

        return scores;
      },
      phaseMessage: "Evaluating questions",
      continuationAction: internal.experimentActions.runEvaluation,
      continuationArgs: {
        experimentId: args.experimentId,
        datasetId: args.datasetId,
        kbId: args.kbId,
      },
      nextPhaseAction: internal.experimentActions.runAggregation,
      nextPhaseArgs: {
        experimentId: args.experimentId,
      },
    });
  },
});

// ─── Phase 3: Aggregation ───

/**
 * Aggregate per-question scores into experiment-level averages.
 */
export const runAggregation = internalAction({
  args: {
    jobId: v.id("jobs"),
    experimentId: v.id("experiments"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.jobs.update, {
      jobId: args.jobId,
      status: "running",
      phase: "aggregation",
      progress: { current: 0, total: 1, message: "Computing average scores..." },
    });

    // Fetch all results for this experiment
    const experiment = await ctx.runQuery(internal.experiments.getInternal, {
      id: args.experimentId,
    });

    const results = await ctx.runQuery(
      internal.experimentResults.byExperimentInternal,
      { experimentId: args.experimentId },
    );

    if (results.length === 0) {
      await ctx.runMutation(internal.experiments.updateStatus, {
        experimentId: args.experimentId,
        status: "completed",
        scores: {},
      });
      await ctx.runMutation(internal.jobs.update, {
        jobId: args.jobId,
        status: "completed",
        result: { experimentId: args.experimentId, scores: {} },
      });
      return;
    }

    // Average scores across all results
    const metricNames = experiment.metricNames;
    const avgScores: Record<string, number> = {};

    for (const name of metricNames) {
      const values = results
        .map((r: any) => (r.scores as Record<string, number>)[name])
        .filter((v: unknown): v is number => typeof v === "number");

      avgScores[name] =
        values.length > 0
          ? values.reduce((a: number, b: number) => a + b, 0) / values.length
          : 0;
    }

    // Update experiment with final scores
    await ctx.runMutation(internal.experiments.updateStatus, {
      experimentId: args.experimentId,
      status: "completed",
      scores: avgScores,
    });

    await ctx.runMutation(internal.jobs.update, {
      jobId: args.jobId,
      status: "completed",
      result: {
        experimentId: args.experimentId,
        scores: avgScores,
        totalQuestions: results.length,
      },
    });

    // Fire-and-forget LangSmith sync
    await ctx.scheduler.runAfter(
      0,
      internal.langsmithSync.syncExperiment,
      { experimentId: args.experimentId },
    );
  },
});
