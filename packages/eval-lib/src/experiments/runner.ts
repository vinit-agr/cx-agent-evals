import type { ExperimentConfig, ExperimentResult } from "./types.js";
import type { CharacterSpan, PositionAwareChunk } from "../types/index.js";
import { positionAwareChunkToSpan } from "../types/chunks.js";
import { evaluate } from "../evaluation/evaluator.js";
import { recall, precision, iou } from "../evaluation/metrics/index.js";

const DEFAULT_METRICS = [recall, precision, iou];

function paChunkToSpan(chunk: PositionAwareChunk): CharacterSpan {
  return positionAwareChunkToSpan(chunk);
}

export async function runExperiment(config: ExperimentConfig): Promise<ExperimentResult> {
  const { name, corpus, retriever, k, groundTruth } = config;
  const metrics = config.metrics ?? DEFAULT_METRICS;
  const startTime = Date.now();

  await retriever.init(corpus);

  try {
    const results: Array<{ retrieved: CharacterSpan[]; groundTruth: CharacterSpan[] }> = [];

    for (const gt of groundTruth) {
      const retrieved = await retriever.retrieve(String(gt.query.text), k);
      results.push({
        retrieved: retrieved.map(paChunkToSpan),
        groundTruth: [...gt.relevantSpans],
      });
    }

    const scores = evaluate({ results, metrics: [...metrics] });

    return {
      experimentName: name,
      retrieverName: retriever.name,
      metrics: scores,
      metadata: {
        corpusSize: corpus.documents.length,
        queryCount: groundTruth.length,
        k,
        durationMs: Date.now() - startTime,
      },
    };
  } finally {
    await retriever.cleanup();
  }
}
