"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type {
  PipelineConfig,
  QueryConfig,
  HydeQueryConfig,
  MultiQueryConfig,
  StepBackQueryConfig,
  RewriteQueryConfig,
} from "rag-evaluation-system";
import { createLLMClient } from "rag-evaluation-system/llm";
import { getAuthContext } from "../lib/auth";

// ---------------------------------------------------------------------------
// LLM helper
// ---------------------------------------------------------------------------

const QUERY_MODEL = "gpt-4o-mini";

async function llmComplete(prompt: string, temperature = 0.7): Promise<string> {
  const client = createLLMClient();
  const result = await client.complete({
    model: QUERY_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return result;
}

// ---------------------------------------------------------------------------
// Default prompts (mirrored from eval-lib — not exported via sub-path)
// ---------------------------------------------------------------------------

const DEFAULT_HYDE_PROMPT =
  "Write a short passage (100-200 words) that would answer the following question. Do not include the question itself, just the answer passage.\n\nQuestion: ";

const DEFAULT_MULTI_QUERY_PROMPT =
  "Generate {n} different search queries that would help find information to answer the following question. Return one query per line, no numbering.\n\nQuestion: ";

const DEFAULT_STEP_BACK_PROMPT =
  "Given the following question, generate a more general, abstract version that would retrieve broader background knowledge. Return only the abstract question.\n\nOriginal question: ";

const DEFAULT_REWRITE_PROMPT =
  "Rewrite the following question to be more precise and optimized for document retrieval. Return only the rewritten question.\n\nOriginal question: ";

// ---------------------------------------------------------------------------
// Strategy executors
// ---------------------------------------------------------------------------

interface RewriteResult {
  readonly strategy: string;
  readonly original: string;
  readonly rewrittenQueries: string[];
  readonly hypotheticalAnswer?: string;
  readonly latencyMs: number;
}

async function executeIdentity(query: string): Promise<RewriteResult> {
  return {
    strategy: "identity",
    original: query,
    rewrittenQueries: [query],
    latencyMs: 0,
  };
}

async function executeMultiQuery(
  query: string,
  config: MultiQueryConfig,
): Promise<RewriteResult> {
  const n = config.numQueries ?? 3;
  const prompt = (config.generationPrompt ?? DEFAULT_MULTI_QUERY_PROMPT)
    .replace("{n}", String(n));

  const start = performance.now();
  const raw = await llmComplete(prompt + query);
  const latencyMs = Math.round(performance.now() - start);

  const queries = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    strategy: "multi-query",
    original: query,
    rewrittenQueries: queries,
    latencyMs,
  };
}

async function executeHyde(
  query: string,
  config: HydeQueryConfig,
): Promise<RewriteResult> {
  const prompt = config.hydePrompt ?? DEFAULT_HYDE_PROMPT;

  const start = performance.now();
  const hypotheticalAnswer = await llmComplete(prompt + query);
  const latencyMs = Math.round(performance.now() - start);

  return {
    strategy: "hyde",
    original: query,
    rewrittenQueries: [hypotheticalAnswer],
    hypotheticalAnswer,
    latencyMs,
  };
}

async function executeStepBack(
  query: string,
  config: StepBackQueryConfig,
): Promise<RewriteResult> {
  const prompt = config.stepBackPrompt ?? DEFAULT_STEP_BACK_PROMPT;
  const includeOriginal = config.includeOriginal ?? true;

  const start = performance.now();
  const stepBackQuery = (await llmComplete(prompt + query)).trim();
  const latencyMs = Math.round(performance.now() - start);

  const rewrittenQueries = includeOriginal
    ? [query, stepBackQuery]
    : [stepBackQuery];

  return {
    strategy: "step-back",
    original: query,
    rewrittenQueries,
    latencyMs,
  };
}

async function executeRewrite(
  query: string,
  config: RewriteQueryConfig,
): Promise<RewriteResult> {
  const prompt = config.rewritePrompt ?? DEFAULT_REWRITE_PROMPT;

  const start = performance.now();
  const rewritten = (await llmComplete(prompt + query)).trim();
  const latencyMs = Math.round(performance.now() - start);

  return {
    strategy: "rewrite",
    original: query,
    rewrittenQueries: [rewritten],
    latencyMs,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function dispatchQueryStrategy(
  query: string,
  queryConfig: QueryConfig | undefined,
): Promise<RewriteResult> {
  if (!queryConfig || queryConfig.strategy === "identity") {
    return executeIdentity(query);
  }

  switch (queryConfig.strategy) {
    case "multi-query":
      return executeMultiQuery(query, queryConfig);
    case "hyde":
      return executeHyde(query, queryConfig);
    case "step-back":
      return executeStepBack(query, queryConfig);
    case "rewrite":
      return executeRewrite(query, queryConfig);
    default: {
      // Exhaustive check — TypeScript will error if a strategy is unhandled
      const _exhaustive: never = queryConfig;
      return executeIdentity(query);
    }
  }
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

/**
 * Rewrite a query according to a retriever's query strategy configuration.
 *
 * Takes a retriever ID and raw query string, loads the retriever's pipeline
 * config, and executes the configured query rewriting strategy (identity,
 * multi-query, HyDE, step-back, or rewrite).
 *
 * Returns the strategy name, original query, rewritten queries, and latency.
 */
export const rewriteQuery = action({
  args: {
    retrieverId: v.id("retrievers"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await getAuthContext(ctx);

    const retriever = await ctx.runQuery(
      internal.crud.retrievers.getInternal,
      { id: args.retrieverId },
    );

    if (retriever.orgId !== orgId) {
      throw new Error("Retriever not found");
    }

    if (retriever.status !== "ready") {
      throw new Error(
        `Retriever is not ready (status: ${retriever.status}). Index the KB first.`,
      );
    }

    const config = retriever.retrieverConfig as PipelineConfig;
    const queryConfig = config.query as QueryConfig | undefined;

    const result = await dispatchQueryStrategy(args.query, queryConfig);

    return result;
  },
});
