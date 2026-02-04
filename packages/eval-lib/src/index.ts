// Types and type factories (DocumentId etc. are both type and value)
export {
  DocumentId,
  QueryId,
  QueryText,
  ChunkId,
  PositionAwareChunkId,
} from "./types/index.js";
export type {
  Brand,
  EvaluationType,
  Document,
  Corpus,
  CharacterSpan,
  SpanRange,
  Chunk,
  PositionAwareChunk,
  Query,
  ChunkLevelGroundTruth,
  TokenLevelGroundTruth,
  ChunkLevelDatasetExample,
  TokenLevelDatasetExample,
  EvaluationResult,
  ChunkLevelRunOutput,
  TokenLevelRunOutput,
} from "./types/index.js";

// Type utilities
export {
  DocumentSchema,
  CorpusSchema,
  createDocument,
  createCorpus,
  corpusFromFolder,
  getDocument,
  CharacterSpanSchema,
  createCharacterSpan,
  positionAwareChunkToSpan,
  ChunkLevelDatasetExampleSchema,
  TokenLevelDatasetExampleSchema,
} from "./types/index.js";

// Chunkers
export type { Chunker, PositionAwareChunker, RecursiveCharacterChunkerOptions } from "./chunkers/index.js";
export { isPositionAwareChunker, ChunkerPositionAdapter, RecursiveCharacterChunker } from "./chunkers/index.js";

// Embedder
export type { Embedder } from "./embedders/index.js";

// Vector Store
export type { VectorStore } from "./vector-stores/index.js";
export { InMemoryVectorStore } from "./vector-stores/index.js";

// Reranker
export type { Reranker } from "./rerankers/index.js";

// Evaluation
export { ChunkLevelEvaluation, TokenLevelEvaluation } from "./evaluation/index.js";
export type {
  ChunkLevelEvaluationConfig,
  ChunkLevelRunOptions,
  TokenLevelEvaluationConfig,
  TokenLevelRunOptions,
  ChunkLevelMetric,
  TokenLevelMetric,
} from "./evaluation/index.js";
export { evaluateChunkLevel, evaluateTokenLevel } from "./evaluation/index.js";
export type { ChunkLevelEvaluateOptions, TokenLevelEvaluateOptions } from "./evaluation/index.js";

// Metrics
export { chunkRecall, chunkPrecision, chunkF1 } from "./evaluation/metrics/chunk-level/index.js";
export { spanRecall, spanPrecision, spanIoU } from "./evaluation/metrics/token-level/index.js";
export { mergeOverlappingSpans, calculateOverlap } from "./evaluation/metrics/token-level/utils.js";

// Experiments
export { runExperiment, VectorRAGRetriever } from "./experiments/index.js";
export type {
  Retriever,
  ExperimentConfig,
  ChunkLevelExperimentConfig,
  TokenLevelExperimentConfig,
  ExperimentResult,
  VectorRAGRetrieverConfig,
} from "./experiments/index.js";

// Synthetic Data Generation
export type { LLMClient } from "./synthetic-datagen/base.js";
export { openAIClientAdapter } from "./synthetic-datagen/base.js";
export { generate } from "./synthetic-datagen/index.js";
export type { GenerateOptions } from "./synthetic-datagen/index.js";
export { SimpleStrategy } from "./synthetic-datagen/strategies/simple/generator.js";
export { DimensionDrivenStrategy } from "./synthetic-datagen/strategies/dimension-driven/generator.js";
export { RealWorldGroundedStrategy } from "./synthetic-datagen/strategies/real-world-grounded/generator.js";
export { discoverDimensions } from "./synthetic-datagen/strategies/dimension-driven/discovery.js";
export { loadDimensions } from "./synthetic-datagen/strategies/dimension-driven/dimensions.js";
export { ChunkLevelGroundTruthAssigner } from "./synthetic-datagen/ground-truth/chunk-level.js";
export { TokenLevelGroundTruthAssigner } from "./synthetic-datagen/ground-truth/token-level.js";
export type {
  QuestionStrategy,
  GeneratedQuery,
  StrategyContext,
  SimpleStrategyOptions,
  DimensionDrivenStrategyOptions,
  RealWorldGroundedStrategyOptions,
  MatchedQuestion,
  Dimension,
  DimensionCombo,
  ProgressCallback,
  ProgressEvent,
} from "./synthetic-datagen/strategies/types.js";

// LangSmith
export {
  getLangSmithClient,
  uploadChunkLevelDataset,
  uploadTokenLevelDataset,
  loadChunkLevelDataset,
  loadTokenLevelDataset,
} from "./langsmith/index.js";

// Utils
export { generateChunkId, generatePaChunkId } from "./utils/hashing.js";
export { spanOverlaps, spanOverlapChars, spanLength } from "./utils/span.js";
