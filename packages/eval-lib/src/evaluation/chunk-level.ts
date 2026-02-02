import type { Corpus, EvaluationResult, ChunkLevelGroundTruth } from "../types/index.js";
import { generateChunkId } from "../utils/hashing.js";
import { generatePaChunkId } from "../utils/hashing.js";
import type { Chunker } from "../chunkers/chunker.interface.js";
import type { Embedder } from "../embedders/embedder.interface.js";
import type { VectorStore } from "../vector-stores/vector-store.interface.js";
import type { Reranker } from "../rerankers/reranker.interface.js";
import type { ChunkLevelMetric } from "./metrics/base.js";
import { chunkRecall } from "./metrics/chunk-level/recall.js";
import { chunkPrecision } from "./metrics/chunk-level/precision.js";
import { chunkF1 } from "./metrics/chunk-level/f1.js";
import { ChunkId } from "../types/primitives.js";
import type { PositionAwareChunk } from "../types/index.js";
import { InMemoryVectorStore } from "../vector-stores/in-memory.js";

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
    const { chunker, embedder, k = 5, reranker, batchSize = 100 } = options;
    const metrics = options.metrics ?? DEFAULT_METRICS;
    const vectorStore = options.vectorStore ?? new InMemoryVectorStore();

    try {
      // Step 1: Chunk corpus with document tracking
      const paChunks: PositionAwareChunk[] = [];
      const chunkIdMap = new Map<string, string>(); // pa_chunk_id -> chunk_id

      for (const doc of this._corpus.documents) {
        const textChunks = chunker.chunk(doc.content);
        for (const text of textChunks) {
          const cid = generateChunkId(text);
          const paId = generatePaChunkId(text);
          chunkIdMap.set(String(paId), String(cid));
          paChunks.push({
            id: paId,
            content: text,
            docId: doc.id,
            start: 0,
            end: text.length,
            metadata: {},
          });
        }
      }

      // Step 2: Embed and index in batches
      for (let i = 0; i < paChunks.length; i += batchSize) {
        const batch = paChunks.slice(i, i + batchSize);
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
          retrievedChunks = await reranker.rerank(String(gt.query.text), retrievedChunks, k);
        }

        const retrievedIds = retrievedChunks.map((c) => {
          const mapped = chunkIdMap.get(String(c.id));
          return ChunkId(mapped ?? String(c.id));
        });

        for (const metric of metrics) {
          const score = metric.calculate(retrievedIds, [...gt.relevantChunkIds]);
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

  private async _loadGroundTruth(): Promise<ChunkLevelGroundTruth[]> {
    const { loadChunkLevelDataset } = await import("../langsmith/client.js");
    return loadChunkLevelDataset(this._datasetName);
  }
}
