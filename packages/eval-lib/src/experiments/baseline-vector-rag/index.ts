import type { PositionAwareChunker } from "../../chunkers/chunker.interface.js";
import type { Embedder } from "../../embedders/embedder.interface.js";
import type { VectorStore } from "../../vector-stores/vector-store.interface.js";
import type { Reranker } from "../../rerankers/reranker.interface.js";
import type { PipelineConfig } from "../../retrievers/pipeline/config.js";
import { PipelineRetriever } from "../../retrievers/pipeline/pipeline-retriever.js";
import { BASELINE_VECTOR_RAG_CONFIG } from "./config.js";

export interface BaselineVectorRagPresetDeps {
  readonly chunker: PositionAwareChunker;
  readonly embedder: Embedder;
  readonly vectorStore?: VectorStore;
  readonly reranker?: Reranker;
}

export function createBaselineVectorRagRetriever(
  deps: BaselineVectorRagPresetDeps,
  configOverrides?: Partial<PipelineConfig>,
): PipelineRetriever {
  const config: PipelineConfig = {
    ...BASELINE_VECTOR_RAG_CONFIG,
    ...configOverrides,
    name: configOverrides?.name ?? BASELINE_VECTOR_RAG_CONFIG.name,
  };
  return new PipelineRetriever(config, deps);
}

export { BASELINE_VECTOR_RAG_CONFIG } from "./config.js";
