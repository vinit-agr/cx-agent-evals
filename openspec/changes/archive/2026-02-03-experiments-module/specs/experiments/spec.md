## ADDED Requirements

### Requirement: Retriever interface
The system SHALL define a `Retriever` interface with `readonly name: string`, `init(corpus: Corpus): Promise<void>`, `retrieve(query: string, k: number): Promise<PositionAwareChunk[]>`, and `cleanup(): Promise<void>`. The interface SHALL always return `PositionAwareChunk[]` regardless of evaluation type, enabling the same retriever to be used for both chunk-level and token-level evaluation.

#### Scenario: Retriever lifecycle
- **WHEN** using a retriever in an experiment
- **THEN** the system SHALL call `init()` before any `retrieve()` calls, and `cleanup()` after all retrievals complete

#### Scenario: Retriever returns position-aware chunks
- **WHEN** calling `retriever.retrieve(query, k)`
- **THEN** the result SHALL be an array of up to `k` `PositionAwareChunk` objects containing `id`, `content`, `docId`, `start`, `end`, and `metadata`

### Requirement: Type-safe ExperimentConfig with discriminated union
The system SHALL define `ExperimentConfig` as a discriminated union based on `evaluationType`. When `evaluationType` is `'chunk-level'`, `groundTruth` SHALL be typed as `ChunkLevelGroundTruth[]` and `metrics` as `ChunkLevelMetric[]`. When `evaluationType` is `'token-level'`, `groundTruth` SHALL be typed as `TokenLevelGroundTruth[]` and `metrics` as `TokenLevelMetric[]`. Common fields SHALL include `name`, `corpus`, `retriever`, and `k`.

#### Scenario: Chunk-level config type safety
- **WHEN** creating an experiment config with `evaluationType: 'chunk-level'`
- **THEN** TypeScript SHALL enforce that `groundTruth` is `ChunkLevelGroundTruth[]` and `metrics` is `ChunkLevelMetric[]`

#### Scenario: Token-level config type safety
- **WHEN** creating an experiment config with `evaluationType: 'token-level'`
- **THEN** TypeScript SHALL enforce that `groundTruth` is `TokenLevelGroundTruth[]` and `metrics` is `TokenLevelMetric[]`

#### Scenario: Type error on mismatched ground truth
- **WHEN** attempting to pass `TokenLevelGroundTruth[]` to a config with `evaluationType: 'chunk-level'`
- **THEN** TypeScript SHALL produce a compile-time error

### Requirement: ExperimentResult type
The system SHALL define `ExperimentResult` with `experimentName: string`, `retrieverName: string`, `metrics: Record<string, number>` (averaged scores), and `metadata` containing `corpusSize`, `queryCount`, `k`, and `durationMs`.

#### Scenario: Result contains all required fields
- **WHEN** an experiment completes
- **THEN** the result SHALL contain the experiment name, retriever name, computed metrics, and metadata

### Requirement: runExperiment function
The system SHALL provide an async `runExperiment(config: ExperimentConfig): Promise<ExperimentResult>` function that orchestrates the experiment lifecycle: (1) call `retriever.init(corpus)`, (2) for each ground truth entry, call `retriever.retrieve(query, k)`, (3) convert results based on `evaluationType` (PAChunk to ChunkId or CharacterSpan), (4) calculate metrics using the pure evaluator functions, (5) call `retriever.cleanup()` in a finally block, (6) return aggregated results.

#### Scenario: Experiment execution flow
- **WHEN** calling `runExperiment(config)`
- **THEN** the system SHALL initialize the retriever, retrieve for each query, evaluate metrics, cleanup, and return results

#### Scenario: Cleanup on error
- **WHEN** an error occurs during retrieval or evaluation
- **THEN** `retriever.cleanup()` SHALL still be called

#### Scenario: Chunk-level result conversion
- **WHEN** `evaluationType` is `'chunk-level'`
- **THEN** the runner SHALL convert `PositionAwareChunk[]` to `ChunkId[]` before metric calculation

#### Scenario: Token-level result conversion
- **WHEN** `evaluationType` is `'token-level'`
- **THEN** the runner SHALL convert `PositionAwareChunk[]` to `CharacterSpan[]` using `positionAwareChunkToSpan`

### Requirement: VectorRAGRetriever baseline implementation
The system SHALL provide a `VectorRAGRetriever` class implementing the `Retriever` interface. It SHALL accept a config with `chunker: Chunker`, `embedder: Embedder`, optional `vectorStore: VectorStore` (default: InMemoryVectorStore), optional `reranker: Reranker`, and optional `batchSize: number` (default: 100). The `init()` method SHALL chunk the corpus, generate chunk IDs, embed in batches, and add to vector store. The `retrieve()` method SHALL embed the query, search the vector store, optionally rerank, and return `PositionAwareChunk[]`. The `cleanup()` method SHALL clear the vector store.

#### Scenario: VectorRAGRetriever init chunks and indexes
- **WHEN** calling `retriever.init(corpus)`
- **THEN** the retriever SHALL chunk all documents, embed chunks in batches, and add to the vector store

#### Scenario: VectorRAGRetriever retrieve with reranker
- **WHEN** calling `retriever.retrieve(query, k)` with a reranker configured
- **THEN** the retriever SHALL embed the query, search the vector store, rerank results, and return the top k chunks

#### Scenario: VectorRAGRetriever retrieve without reranker
- **WHEN** calling `retriever.retrieve(query, k)` without a reranker
- **THEN** the retriever SHALL embed the query, search the vector store, and return the top k chunks directly

#### Scenario: VectorRAGRetriever cleanup clears vector store
- **WHEN** calling `retriever.cleanup()`
- **THEN** the vector store SHALL be cleared

### Requirement: Default metrics based on evaluation type
The system SHALL use default metrics when none are provided: `[chunkRecall, chunkPrecision, chunkF1]` for chunk-level and `[spanRecall, spanPrecision, spanIoU]` for token-level.

#### Scenario: Default chunk-level metrics
- **WHEN** running a chunk-level experiment without specifying metrics
- **THEN** the system SHALL use chunkRecall, chunkPrecision, and chunkF1

#### Scenario: Default token-level metrics
- **WHEN** running a token-level experiment without specifying metrics
- **THEN** the system SHALL use spanRecall, spanPrecision, and spanIoU
