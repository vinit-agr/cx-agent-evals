import type { Corpus, EvaluationResult, ChunkLevelGroundTruth } from "../types/index.js";
import type { Chunker } from "../chunkers/chunker.interface.js";
import type { Embedder } from "../embedders/embedder.interface.js";
import type { VectorStore } from "../vector-stores/vector-store.interface.js";
import type { Reranker } from "../rerankers/reranker.interface.js";
import type { ChunkLevelMetric } from "./metrics/base.js";
import { chunkRecall } from "./metrics/chunk-level/recall.js";
import { chunkPrecision } from "./metrics/chunk-level/precision.js";
import { chunkF1 } from "./metrics/chunk-level/f1.js";
import { VectorRAGRetriever } from "../experiments/baseline-vector-rag/retriever.js";
import { runExperiment } from "../experiments/runner.js";

export interface ChunkLevelEvaluationConfig {
  corpus: Corpus;
  langsmithDatasetName: string;
}

export interface ChunkLevelRunOptions {
  chunker: Chunker;
  embedder: Embedder;
  k?: number;
  vectorStore?: VectorStore;
  reranker?: Reranker;
  metrics?: ChunkLevelMetric[];
  batchSize?: number;
  groundTruth?: ChunkLevelGroundTruth[];
}

const DEFAULT_METRICS: ChunkLevelMetric[] = [chunkRecall, chunkPrecision, chunkF1];

export class ChunkLevelEvaluation {
  private _corpus: Corpus;
  private _datasetName: string;

  constructor(config: ChunkLevelEvaluationConfig) {
    this._corpus = config.corpus;
    this._datasetName = config.langsmithDatasetName;
  }

  async run(options: ChunkLevelRunOptions): Promise<EvaluationResult> {
    const { chunker, embedder, k = 5, vectorStore, reranker, batchSize } = options;
    const metrics = options.metrics ?? DEFAULT_METRICS;

    // Create retriever from options
    const retriever = new VectorRAGRetriever({
      chunker,
      embedder,
      vectorStore,
      reranker,
      batchSize,
    });

    // Load ground truth
    const groundTruth = options.groundTruth ?? (await this._loadGroundTruth());

    // Delegate to runExperiment
    const result = await runExperiment({
      name: `chunk-level-eval-${this._datasetName}`,
      evaluationType: "chunk-level",
      corpus: this._corpus,
      groundTruth,
      retriever,
      k,
      metrics,
    });

    // Return in original EvaluationResult format for backward compatibility
    return { metrics: result.metrics };
  }

  private async _loadGroundTruth(): Promise<ChunkLevelGroundTruth[]> {
    const { loadChunkLevelDataset } = await import("../langsmith/client.js");
    return loadChunkLevelDataset(this._datasetName);
  }
}
