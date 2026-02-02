import type { ChunkId } from "./primitives.js";
import type { CharacterSpan } from "./chunks.js";

export interface EvaluationResult {
  readonly metrics: Readonly<Record<string, number>>;
  readonly experimentUrl?: string;
  readonly rawResults?: unknown;
}

export interface ChunkLevelRunOutput {
  readonly retrievedChunkIds: readonly ChunkId[];
}

export interface TokenLevelRunOutput {
  readonly retrievedSpans: readonly CharacterSpan[];
}
