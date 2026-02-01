import type { PositionAwareChunk } from "../types/index.js";

export interface VectorStore {
  readonly name: string;
  add(chunks: readonly PositionAwareChunk[], embeddings: readonly number[][]): Promise<void>;
  search(queryEmbedding: readonly number[], k?: number): Promise<PositionAwareChunk[]>;
  clear(): Promise<void>;
}
