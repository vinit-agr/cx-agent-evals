## Purpose

Experiment runner infrastructure for RAG retrieval evaluation with configurable retrievers and metrics.

## Requirements

### Requirement: Retriever interface
The system SHALL define a `Retriever` interface with `readonly name: string`, `init(corpus: Corpus): Promise<void>`, `retrieve(query: string, k: number): Promise<PositionAwareChunk[]>`, and `cleanup(): Promise<void>`. The interface SHALL always return `PositionAwareChunk[]` for span-based evaluation.

#### Scenario: Retriever lifecycle
- **WHEN** using a retriever in an experiment
- **THEN** the system SHALL call `init()` before any `retrieve()` calls, and `cleanup()` after all retrievals complete

#### Scenario: Retriever returns position-aware chunks
- **WHEN** calling `retriever.retrieve(query, k)`
- **THEN** the result SHALL be an array of up to `k` `PositionAwareChunk` objects containing `id`, `content`, `docId`, `start`, `end`, and `metadata`

### Requirement: ExperimentConfig type
The system SHALL define `ExperimentConfig` as a single interface (not a discriminated union) with fields `name: string`, `corpus: Corpus`, `retriever: Retriever`, `k: number`, `groundTruth: GroundTruth[]`, and optional `metrics: Metric[]`.

#### Scenario: Config type safety
- **WHEN** creating an experiment config
- **THEN** TypeScript SHALL enforce that `groundTruth` is `GroundTruth[]` (with `relevantSpans`) and `metrics` is `Metric[]`

### Requirement: ExperimentResult type
The system SHALL define `ExperimentResult` with `experimentName: string`, `retrieverName: string`, `metrics: Record<string, number>` (averaged scores), and `metadata` containing `corpusSize`, `queryCount`, `k`, and `durationMs`.

#### Scenario: Result contains all required fields
- **WHEN** an experiment completes
- **THEN** the result SHALL contain the experiment name, retriever name, computed metrics, and metadata

### Requirement: runExperiment function
The system SHALL provide an async `runExperiment(config: ExperimentConfig): Promise<ExperimentResult>` function that orchestrates the experiment lifecycle: (1) call `retriever.init(corpus)`, (2) for each ground truth entry, call `retriever.retrieve(query, k)`, (3) convert `PositionAwareChunk[]` to `CharacterSpan[]` using `positionAwareChunkToSpan`, (4) calculate metrics using the `evaluate` function, (5) call `retriever.cleanup()` in a finally block, (6) return aggregated results.

#### Scenario: Experiment execution flow
- **WHEN** calling `runExperiment(config)`
- **THEN** the system SHALL initialize the retriever, retrieve for each query, evaluate metrics, cleanup, and return results

#### Scenario: Cleanup on error
- **WHEN** an error occurs during retrieval or evaluation
- **THEN** `retriever.cleanup()` SHALL still be called

#### Scenario: Result conversion
- **WHEN** running an experiment
- **THEN** the runner SHALL convert `PositionAwareChunk[]` to `CharacterSpan[]` using `positionAwareChunkToSpan`

### Requirement: VectorRAGRetriever baseline implementation
The system SHALL provide a `VectorRAGRetriever` class implementing the `Retriever` interface. It SHALL accept a config with `chunker: PositionAwareChunker`, `embedder: Embedder`, optional `vectorStore: VectorStore` (default: InMemoryVectorStore), optional `reranker: Reranker`, and optional `batchSize: number` (default: 100). The chunker SHALL be a `PositionAwareChunker` (not a basic `Chunker`). The `init()` method SHALL chunk the corpus with positions, embed in batches, and add to vector store. The `retrieve()` method SHALL embed the query, search the vector store, optionally rerank, and return `PositionAwareChunk[]`. The `cleanup()` method SHALL clear the vector store.

#### Scenario: VectorRAGRetriever init chunks and indexes
- **WHEN** calling `retriever.init(corpus)`
- **THEN** the retriever SHALL chunk all documents with position tracking, embed chunks in batches, and add to the vector store

#### Scenario: VectorRAGRetriever retrieve with reranker
- **WHEN** calling `retriever.retrieve(query, k)` with a reranker configured
- **THEN** the retriever SHALL embed the query, search the vector store, rerank results, and return the top k chunks

#### Scenario: VectorRAGRetriever retrieve without reranker
- **WHEN** calling `retriever.retrieve(query, k)` without a reranker
- **THEN** the retriever SHALL embed the query, search the vector store, and return the top k chunks directly

#### Scenario: VectorRAGRetriever cleanup clears vector store
- **WHEN** calling `retriever.cleanup()`
- **THEN** the vector store SHALL be cleared

### Requirement: Default metrics
The system SHALL use default metrics when none are provided: `[recall, precision, iou]`.

#### Scenario: Default metrics
- **WHEN** running an experiment without specifying metrics
- **THEN** the system SHALL use recall, precision, and iou
