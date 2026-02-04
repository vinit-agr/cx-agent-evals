import type { Corpus, ChunkLevelGroundTruth, TokenLevelGroundTruth } from "../types/index.js";
import type { ChunkLevelMetric, TokenLevelMetric } from "../evaluation/metrics/base.js";
import type { Retriever } from "./retriever.interface.js";

interface ExperimentConfigBase {
  readonly name: string;
  readonly corpus: Corpus;
  readonly retriever: Retriever;
  readonly k: number;
}

export interface ChunkLevelExperimentConfig extends ExperimentConfigBase {
  readonly evaluationType: "chunk-level";
  readonly groundTruth: readonly ChunkLevelGroundTruth[];
  readonly metrics?: readonly ChunkLevelMetric[];
}

export interface TokenLevelExperimentConfig extends ExperimentConfigBase {
  readonly evaluationType: "token-level";
  readonly groundTruth: readonly TokenLevelGroundTruth[];
  readonly metrics?: readonly TokenLevelMetric[];
}

export type ExperimentConfig = ChunkLevelExperimentConfig | TokenLevelExperimentConfig;

export interface ExperimentResult {
  readonly experimentName: string;
  readonly retrieverName: string;
  readonly metrics: Readonly<Record<string, number>>;
  readonly metadata: {
    readonly corpusSize: number;
    readonly queryCount: number;
    readonly k: number;
    readonly durationMs: number;
  };
}
