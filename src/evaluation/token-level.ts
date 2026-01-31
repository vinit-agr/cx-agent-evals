import type { Corpus, EvaluationResult, TokenLevelGroundTruth } from "../types/index.js";
import { positionAwareChunkToSpan } from "../types/chunks.js";
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
import { InMemoryVectorStore } from "../vector-stores/in-memory.js";

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
    const { embedder, k = 5, reranker, batchSize = 100 } = options;
    const metrics = options.metrics ?? DEFAULT_METRICS;
    const vectorStore = options.vectorStore ?? new InMemoryVectorStore();

    // Ensure position-aware chunker
    const paChunker: PositionAwareChunker = isPositionAwareChunker(options.chunker)
      ? options.chunker
      : new ChunkerPositionAdapter(options.chunker as Chunker);

    try {
      // Step 1: Chunk with positions
      const allChunks = this._corpus.documents.flatMap((doc) =>
        paChunker.chunkWithPositions(doc),
      );

      // Step 2: Embed and index in batches
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);
        const embeddings = await embedder.embed(batch.map((c) => c.content));
        await vectorStore.add(batch, embeddings);
      }

      // Step 3: Load ground truth
      const groundTruth = options.groundTruth ?? (await this._loadGroundTruth());

      // Step 4: Evaluate
      const allResults: Record<string, number[]> = {};
      for (const m of metrics) allResults[m.name] = [];

      for (const gt of groundTruth) {
        const queryEmbedding = await embedder.embedQuery(String(gt.query.text));
        let retrievedChunks = await vectorStore.search(queryEmbedding, k);

        if (reranker) {
          retrievedChunks = await reranker.rerank(
            String(gt.query.text),
            retrievedChunks,
            k,
          );
        }

        const retrievedSpans = retrievedChunks.map(positionAwareChunkToSpan);

        for (const metric of metrics) {
          const score = metric.calculate(retrievedSpans, [...gt.relevantSpans]);
          allResults[metric.name].push(score);
        }
      }

      // Step 5: Aggregate
      const avgMetrics: Record<string, number> = {};
      for (const [name, scores] of Object.entries(allResults)) {
        avgMetrics[name] =
          scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      }

      return { metrics: avgMetrics };
    } finally {
      await vectorStore.clear();
    }
  }

  private async _loadGroundTruth(): Promise<TokenLevelGroundTruth[]> {
    const { loadTokenLevelDataset } = await import("../langsmith/client.js");
    return loadTokenLevelDataset(this._datasetName);
  }
}
