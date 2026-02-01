import type { PositionAwareChunk } from "../types/index.js";
import type { VectorStore } from "./vector-store.interface.js";

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class InMemoryVectorStore implements VectorStore {
  readonly name = "InMemory";
  private _chunks: PositionAwareChunk[] = [];
  private _embeddings: number[][] = [];

  async add(
    chunks: readonly PositionAwareChunk[],
    embeddings: readonly number[][],
  ): Promise<void> {
    this._chunks.push(...chunks);
    this._embeddings.push(...embeddings.map((e) => [...e]));
  }

  async search(
    queryEmbedding: readonly number[],
    k: number = 5,
  ): Promise<PositionAwareChunk[]> {
    const scored = this._chunks.map((chunk, i) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, this._embeddings[i]),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.chunk);
  }

  async clear(): Promise<void> {
    this._chunks = [];
    this._embeddings = [];
  }
}
