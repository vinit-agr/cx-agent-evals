import type { Corpus, EvaluationResult, TokenLevelGroundTruth } from "../types/index.js";
import type { Chunker, PositionAwareChunker } from "../chunkers/chunker.interface.js";
import { isPositionAwareChunker } from "../chunkers/chunker.interface.js";
import { ChunkerPositionAdapter } from "../chunkers/adapter.js";
import type { Embedder } from "../embedders/embedder.interface.js";
import type { VectorStore } from "../vector-stores/vector-store.interface.js";
import type { Reranker } from "../rerankers/reranker.interface.js";
import type { TokenLevelMetric } from "./metrics/base.js";
import { spanRecall } from "./metrics/token-level/recall.js";
import { spanPrecision } from "./metrics/token-level/precision.js";
import { spanIoU } from "./metrics/token-level/iou.js";
import { VectorRAGRetriever } from "../experiments/baseline-vector-rag/retriever.js";
import { runExperiment } from "../experiments/runner.js";

export interface TokenLevelEvaluationConfig {
  corpus: Corpus;
  langsmithDatasetName: string;
}

export interface TokenLevelRunOptions {
  chunker: Chunker | PositionAwareChunker;
  embedder: Embedder;
  k?: number;
  vectorStore?: VectorStore;
  reranker?: Reranker;
  metrics?: TokenLevelMetric[];
  batchSize?: number;
  groundTruth?: TokenLevelGroundTruth[];
}

const DEFAULT_METRICS: TokenLevelMetric[] = [spanRecall, spanPrecision, spanIoU];

export class TokenLevelEvaluation {
  private _corpus: Corpus;
  private _datasetName: string;

  constructor(config: TokenLevelEvaluationConfig) {
    this._corpus = config.corpus;
    this._datasetName = config.langsmithDatasetName;
  }

  async run(options: TokenLevelRunOptions): Promise<EvaluationResult> {
    const { embedder, k = 5, vectorStore, reranker, batchSize } = options;
    const metrics = options.metrics ?? DEFAULT_METRICS;

    // Ensure position-aware chunker
    const paChunker: PositionAwareChunker = isPositionAwareChunker(options.chunker)
      ? options.chunker
      : new ChunkerPositionAdapter(options.chunker as Chunker);

    // Create retriever from options
    const retriever = new VectorRAGRetriever({
      chunker: paChunker,
      embedder,
      vectorStore,
      reranker,
      batchSize,
    });

    // Load ground truth
    const groundTruth = options.groundTruth ?? (await this._loadGroundTruth());

    // Delegate to runExperiment
    const result = await runExperiment({
      name: `token-level-eval-${this._datasetName}`,
      evaluationType: "token-level",
      corpus: this._corpus,
      groundTruth,
      retriever,
      k,
      metrics,
    });

    // Return in original EvaluationResult format for backward compatibility
    return { metrics: result.metrics };
  }

  private async _loadGroundTruth(): Promise<TokenLevelGroundTruth[]> {
    const { loadTokenLevelDataset } = await import("../langsmith/client.js");
    return loadTokenLevelDataset(this._datasetName);
  }
}
