import type { Corpus, ChunkLevelGroundTruth, TokenLevelGroundTruth } from "../../types/index.js";
import type { LLMClient } from "../base.js";
import type { GeneratedQuery } from "../strategies/types.js";

export interface GroundTruthAssignerContext {
  readonly corpus: Corpus;
  readonly llmClient: LLMClient;
  readonly model: string;
}

export interface GroundTruthAssigner<T> {
  readonly name: string;
  assign(
    queries: GeneratedQuery[],
    context: GroundTruthAssignerContext,
  ): Promise<T[]>;
}

export type ChunkLevelAssigner = GroundTruthAssigner<ChunkLevelGroundTruth>;
export type TokenLevelAssigner = GroundTruthAssigner<TokenLevelGroundTruth>;
