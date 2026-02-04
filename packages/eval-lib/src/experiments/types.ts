import type { Corpus, GroundTruth } from "../types/index.js";
import type { Metric } from "../evaluation/metrics/base.js";
import type { Retriever } from "./retriever.interface.js";

export interface ExperimentConfig {
  readonly name: string;
  readonly corpus: Corpus;
  readonly retriever: Retriever;
  readonly k: number;
  readonly groundTruth: readonly GroundTruth[];
  readonly metrics?: readonly Metric[];
}

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
