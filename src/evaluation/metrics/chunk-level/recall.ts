import type { ChunkId } from "../../../types/primitives.js";
import type { ChunkLevelMetric } from "../base.js";

export const chunkRecall: ChunkLevelMetric = {
  name: "chunk_recall" as const,
  calculate(retrieved: readonly ChunkId[], groundTruth: readonly ChunkId[]): number {
    if (groundTruth.length === 0) return 1.0;
    const retrievedSet = new Set(retrieved);
    const hits = groundTruth.filter((id) => retrievedSet.has(id));
    return hits.length / groundTruth.length;
  },
};
