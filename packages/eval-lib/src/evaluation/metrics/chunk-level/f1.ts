import type { ChunkId } from "../../../types/primitives.js";
import type { ChunkLevelMetric } from "../base.js";
import { chunkRecall } from "./recall.js";
import { chunkPrecision } from "./precision.js";

export const chunkF1: ChunkLevelMetric = {
  name: "chunk_f1" as const,
  calculate(retrieved: readonly ChunkId[], groundTruth: readonly ChunkId[]): number {
    const recall = chunkRecall.calculate(retrieved, groundTruth);
    const precision = chunkPrecision.calculate(retrieved, groundTruth);
    if (recall + precision === 0) return 0.0;
    return (2 * precision * recall) / (precision + recall);
  },
};
