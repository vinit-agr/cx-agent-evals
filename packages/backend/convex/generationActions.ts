"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { processBatch } from "./lib/batchProcessor";
import { createLLMClient } from "./lib/llm";
import {
  SimpleStrategy,
  DimensionDrivenStrategy,
  RealWorldGroundedStrategy,
  GroundTruthAssigner,
  OpenAIEmbedder,
  createCorpusFromDocuments,
  parseDimensions,
} from "rag-evaluation-system";
import OpenAI from "openai";

// ─── Helpers ───

function getModel(strategyConfig: Record<string, unknown>): string {
  return (strategyConfig.model as string) ?? "gpt-4o";
}

async function loadCorpusFromKb(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  kbId: Id<"knowledgeBases">,
) {
  const docs = await ctx.runQuery(internal.documents.listByKbInternal, {
    kbId,
  });
  return {
    corpus: createCorpusFromDocuments(
      docs.map((d: any) => ({ id: d.docId, content: d.content })),
    ),
    docs,
  };
}

/**
 * Insert GeneratedQuery[] into the questions table.
 */
async function insertGeneratedQuestions(
  ctx: { runMutation: (ref: any, args: any) => Promise<any> },
  datasetId: Id<"datasets">,
  queries: Array<{
    query: string;
    targetDocId: string;
    metadata: Record<string, string>;
  }>,
  prefix: string,
) {
  if (queries.length === 0) return;

  // Insert in batches of 100 to avoid oversized mutations
  const BATCH_SIZE = 100;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    await ctx.runMutation(internal.questions.insertBatch, {
      datasetId,
      questions: batch.map((q, idx) => ({
        queryId: `${prefix}_q${i + idx}`,
        queryText: q.query,
        sourceDocId: q.targetDocId,
        relevantSpans: [],
        metadata: q.metadata,
      })),
    });
  }
}

// ─── Simple Strategy ───

/**
 * Simple strategy: generate questions for each document individually.
 * Phase: "generate-questions" — one job item per document.
 */
export const simpleGenerate = internalAction({
  args: {
    jobId: v.id("jobs"),
    datasetId: v.id("datasets"),
    kbId: v.id("knowledgeBases"),
  },
  handler: async (ctx, args) => {
    // Initialize phase items on first run
    const progress = await ctx.runQuery(internal.jobItems.getProgress, {
      jobId: args.jobId,
      phase: "generate-questions",
    });

    if (progress.total === 0) {
      const docs = await ctx.runQuery(internal.documents.listByKbInternal, {
        kbId: args.kbId,
      });
      await ctx.runMutation(internal.jobItems.initPhase, {
        jobId: args.jobId,
        phase: "generate-questions",
        items: docs.map((d: any) => ({ itemKey: d._id })),
      });
    }

    const dataset = await ctx.runQuery(internal.datasets.getInternal, {
      id: args.datasetId,
    });
    const config = dataset.strategyConfig as Record<string, unknown>;
    const queriesPerDoc = (config.queriesPerDoc as number) ?? 5;
    const model = getModel(config);
    const llmClient = createLLMClient();

    await processBatch(ctx, {
      jobId: args.jobId,
      phase: "generate-questions",
      batchSize: 30,
      processItem: async (item) => {
        const docId = item.itemKey as Id<"documents">;
        const doc = await ctx.runQuery(internal.documents.getInternal, {
          id: docId,
        });

        const corpus = createCorpusFromDocuments([
          { id: doc.docId, content: doc.content },
        ]);

        const strategy = new SimpleStrategy({ queriesPerDoc });
        const queries = await strategy.generate({ corpus, llmClient, model });

        if (queries.length > 0) {
          await ctx.runMutation(internal.questions.insertBatch, {
            datasetId: args.datasetId,
            questions: queries.map((q, i) => ({
              queryId: `${doc.docId}_q${i}`,
              queryText: q.query,
              sourceDocId: q.targetDocId,
              relevantSpans: [],
              metadata: q.metadata,
            })),
          });
        }

        return { questionsGenerated: queries.length };
      },
      phaseMessage: "Generating questions",
      continuationAction: internal.generationActions.simpleGenerate,
      continuationArgs: { datasetId: args.datasetId, kbId: args.kbId },
      nextPhaseAction: internal.generationActions.assignGroundTruth,
      nextPhaseArgs: { datasetId: args.datasetId, kbId: args.kbId },
    });
  },
});

// ─── Dimension-Driven Strategy ───

/**
 * Dimension-driven strategy: runs the full multi-phase pipeline in one action.
 * For KBs with < ~50 docs, this completes within the 10-min timeout.
 * For larger KBs, decomposed phased actions would be needed.
 */
export const dimensionDrivenGenerate = internalAction({
  args: {
    jobId: v.id("jobs"),
    datasetId: v.id("datasets"),
    kbId: v.id("knowledgeBases"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.jobs.update, {
      jobId: args.jobId,
      status: "running",
      phase: "generate-questions",
    });

    try {
      const dataset = await ctx.runQuery(internal.datasets.getInternal, {
        id: args.datasetId,
      });
      const config = dataset.strategyConfig as Record<string, unknown>;
      const model = getModel(config);
      const llmClient = createLLMClient();

      const { corpus } = await loadCorpusFromKb(ctx, args.kbId);

      const dimensions = parseDimensions(config.dimensions);
      const totalQuestions = (config.totalQuestions as number) ?? 50;

      const strategy = new DimensionDrivenStrategy({
        dimensions,
        totalQuestions,
        onProgress: (event) => {
          // Fire-and-forget progress update (don't await to avoid slowing pipeline)
          void ctx.runMutation(internal.jobs.update, {
            jobId: args.jobId,
            progress: {
              current: 0,
              total: 1,
              message: `${event.phase}...`,
            },
          });
        },
      });

      const queries = await strategy.generate({ corpus, llmClient, model });

      await insertGeneratedQuestions(
        ctx,
        args.datasetId,
        queries,
        "dd",
      );

      // Schedule ground truth phase
      await ctx.scheduler.runAfter(
        0,
        internal.generationActions.assignGroundTruth,
        {
          jobId: args.jobId,
          datasetId: args.datasetId,
          kbId: args.kbId,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.jobs.update, {
        jobId: args.jobId,
        status: "failed",
        error: message,
      });
    }
  },
});

// ─── Real-World-Grounded Strategy ───

/**
 * Real-world-grounded strategy: embedding, matching, and few-shot generation.
 * Runs the full pipeline in one action.
 */
export const realWorldGroundedGenerate = internalAction({
  args: {
    jobId: v.id("jobs"),
    datasetId: v.id("datasets"),
    kbId: v.id("knowledgeBases"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.jobs.update, {
      jobId: args.jobId,
      status: "running",
      phase: "generate-questions",
    });

    try {
      const dataset = await ctx.runQuery(internal.datasets.getInternal, {
        id: args.datasetId,
      });
      const config = dataset.strategyConfig as Record<string, unknown>;
      const model = getModel(config);
      const llmClient = createLLMClient();

      const { corpus } = await loadCorpusFromKb(ctx, args.kbId);

      // Create embedder
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const embedder = new OpenAIEmbedder({
        model: (config.embeddingModel as string) ?? "text-embedding-3-small",
        client: openai,
      });

      const strategy = new RealWorldGroundedStrategy({
        questions: (config.questions as string[]) ?? [],
        totalSyntheticQuestions:
          (config.totalSyntheticQuestions as number) ?? 50,
        matchThreshold: config.matchThreshold as number | undefined,
        fewShotExamplesPerDoc: config.fewShotExamplesPerDoc as
          | number
          | undefined,
        onProgress: (event) => {
          void ctx.runMutation(internal.jobs.update, {
            jobId: args.jobId,
            progress: {
              current: 0,
              total: 1,
              message: `${event.phase}...`,
            },
          });
        },
      });

      const queries = await strategy.generate({
        corpus,
        llmClient,
        model,
        embedder,
      });

      await insertGeneratedQuestions(
        ctx,
        args.datasetId,
        queries,
        "rwg",
      );

      // Schedule ground truth phase
      await ctx.scheduler.runAfter(
        0,
        internal.generationActions.assignGroundTruth,
        {
          jobId: args.jobId,
          datasetId: args.datasetId,
          kbId: args.kbId,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.jobs.update, {
        jobId: args.jobId,
        status: "failed",
        error: message,
      });
    }
  },
});

// ─── Ground Truth Assignment (shared by all strategies) ───

/**
 * Assign ground truth character spans to each question.
 * Phase: "ground-truth" — one job item per question.
 * Uses eval-lib GroundTruthAssigner to extract exact text excerpts via LLM.
 */
export const assignGroundTruth = internalAction({
  args: {
    jobId: v.id("jobs"),
    datasetId: v.id("datasets"),
    kbId: v.id("knowledgeBases"),
  },
  handler: async (ctx, args) => {
    // Initialize phase items on first run
    const progress = await ctx.runQuery(internal.jobItems.getProgress, {
      jobId: args.jobId,
      phase: "ground-truth",
    });

    if (progress.total === 0) {
      const questions = await ctx.runQuery(
        internal.questions.byDatasetInternal,
        { datasetId: args.datasetId },
      );
      await ctx.runMutation(internal.jobItems.initPhase, {
        jobId: args.jobId,
        phase: "ground-truth",
        items: questions.map((q: any) => ({ itemKey: q._id })),
      });
    }

    // Load full corpus for span position finding
    const { corpus } = await loadCorpusFromKb(ctx, args.kbId);

    const dataset = await ctx.runQuery(internal.datasets.getInternal, {
      id: args.datasetId,
    });
    const config = dataset.strategyConfig as Record<string, unknown>;
    const model = getModel(config);
    const llmClient = createLLMClient();
    const assigner = new GroundTruthAssigner();

    await processBatch(ctx, {
      jobId: args.jobId,
      phase: "ground-truth",
      batchSize: 30,
      processItem: async (item) => {
        const questionId = item.itemKey as Id<"questions">;
        const question = await ctx.runQuery(internal.questions.getInternal, {
          id: questionId,
        });

        const results = await assigner.assign(
          [
            {
              query: question.queryText,
              targetDocId: question.sourceDocId,
              metadata: (question.metadata ?? {}) as Record<string, string>,
            },
          ],
          { corpus, llmClient, model },
        );

        if (results.length > 0 && results[0].relevantSpans.length > 0) {
          const spans = results[0].relevantSpans.map((s) => ({
            docId: String(s.docId),
            start: s.start,
            end: s.end,
            text: s.text,
          }));

          await ctx.runMutation(internal.questions.updateSpans, {
            questionId,
            relevantSpans: spans,
          });

          return { spansFound: spans.length };
        }

        return { spansFound: 0 };
      },
      phaseMessage: "Assigning ground truth",
      continuationAction: internal.generationActions.assignGroundTruth,
      continuationArgs: { datasetId: args.datasetId, kbId: args.kbId },
      nextPhaseAction: internal.generationActions.finalizeGeneration,
      nextPhaseArgs: { datasetId: args.datasetId },
    });
  },
});

// ─── Finalize ───

/**
 * Update dataset question count and mark job complete.
 */
export const finalizeGeneration = internalAction({
  args: {
    jobId: v.id("jobs"),
    datasetId: v.id("datasets"),
  },
  handler: async (ctx, args) => {
    const questions = await ctx.runQuery(
      internal.questions.byDatasetInternal,
      { datasetId: args.datasetId },
    );

    await ctx.runMutation(internal.datasets.updateQuestionCount, {
      datasetId: args.datasetId,
      questionCount: questions.length,
    });

    await ctx.runMutation(internal.jobs.update, {
      jobId: args.jobId,
      status: "completed",
      result: {
        datasetId: args.datasetId,
        questionCount: questions.length,
      },
    });

    // Fire-and-forget LangSmith sync
    await ctx.scheduler.runAfter(
      0,
      internal.langsmithSync.syncDataset,
      { datasetId: args.datasetId },
    );
  },
});
