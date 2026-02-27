import type { PositionAwareChunk } from "../types/index.js";

/** A chunk paired with its similarity score from vector search. */
export interface VectorSearchResult {
  readonly chunk: PositionAwareChunk;
  readonly score: number;
}

export interface VectorStore {
  readonly name: string;
  add(chunks: readonly PositionAwareChunk[], embeddings: readonly number[][]): Promise<void>;
  search(queryEmbedding: readonly number[], k?: number): Promise<VectorSearchResult[]>;
  clear(): Promise<void>;
}
