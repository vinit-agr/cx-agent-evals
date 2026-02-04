import type { ExperimentConfig, ExperimentResult } from "./types.js";
import type { ChunkId } from "../types/primitives.js";
import type { CharacterSpan, PositionAwareChunk } from "../types/index.js";
import { positionAwareChunkToSpan } from "../types/chunks.js";
import { generateChunkId } from "../utils/hashing.js";
import { evaluateChunkLevel, evaluateTokenLevel } from "../evaluation/evaluator.js";
import { chunkRecall, chunkPrecision, chunkF1 } from "../evaluation/metrics/chunk-level/index.js";
import { spanRecall, spanPrecision, spanIoU } from "../evaluation/metrics/token-level/index.js";

const DEFAULT_CHUNK_METRICS = [chunkRecall, chunkPrecision, chunkF1];
const DEFAULT_TOKEN_METRICS = [spanRecall, spanPrecision, spanIoU];

function paChunkToChunkId(chunk: PositionAwareChunk): ChunkId {
  return generateChunkId(chunk.content);
}

function paChunkToSpan(chunk: PositionAwareChunk): CharacterSpan {
  return positionAwareChunkToSpan(chunk);
}

export async function runExperiment(config: ExperimentConfig): Promise<ExperimentResult> {
  const { name, corpus, retriever, k } = config;
  const startTime = Date.now();

  await retriever.init(corpus);

  try {
    if (config.evaluationType === "chunk-level") {
      const metrics = config.metrics ?? DEFAULT_CHUNK_METRICS;
      const groundTruth = config.groundTruth;
      const results: Array<{ retrieved: ChunkId[]; groundTruth: ChunkId[] }> = [];

      for (const gt of groundTruth) {
        const retrieved = await retriever.retrieve(String(gt.query.text), k);
        results.push({
          retrieved: retrieved.map(paChunkToChunkId),
          groundTruth: [...gt.relevantChunkIds],
        });
      }

      const scores = evaluateChunkLevel({ results, metrics: [...metrics] });

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
    }

    if (config.evaluationType === "token-level") {
      const metrics = config.metrics ?? DEFAULT_TOKEN_METRICS;
      const groundTruth = config.groundTruth;
      const results: Array<{ retrieved: CharacterSpan[]; groundTruth: CharacterSpan[] }> = [];

      for (const gt of groundTruth) {
        const retrieved = await retriever.retrieve(String(gt.query.text), k);
        results.push({
          retrieved: retrieved.map(paChunkToSpan),
          groundTruth: [...gt.relevantSpans],
        });
      }

      const scores = evaluateTokenLevel({ results, metrics: [...metrics] });

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
    }

    // Exhaustiveness check
    const _exhaustive: never = config;
    throw new Error(`Unknown evaluation type: ${(_exhaustive as ExperimentConfig).evaluationType}`);
  } finally {
    await retriever.cleanup();
  }
}
