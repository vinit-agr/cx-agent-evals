import type { ChunkId } from "../../types/primitives.js";
import type { CharacterSpan } from "../../types/chunks.js";

export interface ChunkLevelMetric {
  readonly name: string;
  readonly calculate: (
    retrieved: readonly ChunkId[],
    groundTruth: readonly ChunkId[],
  ) => number;
}

export interface TokenLevelMetric {
  readonly name: string;
  readonly calculate: (
    retrieved: readonly CharacterSpan[],
    groundTruth: readonly CharacterSpan[],
  ) => number;
}
