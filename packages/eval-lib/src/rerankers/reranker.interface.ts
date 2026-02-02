import type { PositionAwareChunk } from "../types/index.js";

export interface Reranker {
  readonly name: string;
  rerank(
    query: string,
    chunks: readonly PositionAwareChunk[],
    topK?: number,
  ): Promise<PositionAwareChunk[]>;
}
