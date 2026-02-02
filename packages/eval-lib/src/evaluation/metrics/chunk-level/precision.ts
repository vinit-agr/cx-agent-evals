import type { ChunkId } from "../../../types/primitives.js";
import type { ChunkLevelMetric } from "../base.js";

export const chunkPrecision: ChunkLevelMetric = {
  name: "chunk_precision" as const,
  calculate(retrieved: readonly ChunkId[], groundTruth: readonly ChunkId[]): number {
    if (retrieved.length === 0) return 0.0;
    const gtSet = new Set(groundTruth);
    const hits = retrieved.filter((id) => gtSet.has(id));
    return hits.length / retrieved.length;
  },
};
