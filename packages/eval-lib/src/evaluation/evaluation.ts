import type { Corpus, EvaluationResult, GroundTruth } from "../types/index.js";
import type { PositionAwareChunker } from "../chunkers/chunker.interface.js";
import type { Embedder } from "../embedders/embedder.interface.js";
import type { VectorStore } from "../vector-stores/vector-store.interface.js";
import type { Reranker } from "../rerankers/reranker.interface.js";
import type { Metric } from "./metrics/base.js";
import { recall } from "./metrics/recall.js";
import { precision } from "./metrics/precision.js";
import { iou } from "./metrics/iou.js";
import { VectorRAGRetriever } from "../experiments/baseline-vector-rag/retriever.js";
import { runExperiment } from "../experiments/runner.js";

export interface EvaluationConfig {
  corpus: Corpus;
  langsmithDatasetName: string;
}

export interface RunOptions {
  chunker: PositionAwareChunker;
  embedder: Embedder;
  k?: number;
  vectorStore?: VectorStore;
  reranker?: Reranker;
  metrics?: Metric[];
  batchSize?: number;
  groundTruth?: GroundTruth[];
}

const DEFAULT_METRICS: Metric[] = [recall, precision, iou];

export class Evaluation {
  private _corpus: Corpus;
  private _datasetName: string;

  constructor(config: EvaluationConfig) {
    this._corpus = config.corpus;
    this._datasetName = config.langsmithDatasetName;
  }

  async run(options: RunOptions): Promise<EvaluationResult> {
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
      name: `eval-${this._datasetName}`,
      corpus: this._corpus,
      groundTruth,
      retriever,
      k,
      metrics,
    });

    // Return in original EvaluationResult format for backward compatibility
    return { metrics: result.metrics };
  }

  private async _loadGroundTruth(): Promise<GroundTruth[]> {
    const { loadDataset } = await import("../langsmith/client.js");
    return loadDataset(this._datasetName);
  }
}
