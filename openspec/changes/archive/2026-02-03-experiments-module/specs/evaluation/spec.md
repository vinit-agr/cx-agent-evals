## ADDED Requirements

### Requirement: Pure evaluateChunkLevel function
The system SHALL provide a pure function `evaluateChunkLevel(options: { results: Array<{ retrieved: ChunkId[], groundTruth: ChunkId[] }>, metrics: ChunkLevelMetric[] }): Record<string, number>` that computes metric scores for each result and returns averaged scores. It SHALL perform no I/O operations.

#### Scenario: Evaluate chunk-level results
- **WHEN** calling `evaluateChunkLevel({ results, metrics })`
- **THEN** the function SHALL compute each metric for each result and return averaged scores

#### Scenario: Empty results returns zeros
- **WHEN** calling `evaluateChunkLevel({ results: [], metrics })`
- **THEN** the function SHALL return metric scores of `0` for each metric

### Requirement: Pure evaluateTokenLevel function
The system SHALL provide a pure function `evaluateTokenLevel(options: { results: Array<{ retrieved: CharacterSpan[], groundTruth: CharacterSpan[] }>, metrics: TokenLevelMetric[] }): Record<string, number>` that computes metric scores for each result and returns averaged scores. It SHALL perform no I/O operations.

#### Scenario: Evaluate token-level results
- **WHEN** calling `evaluateTokenLevel({ results, metrics })`
- **THEN** the function SHALL compute each metric for each result and return averaged scores

#### Scenario: Empty results returns zeros
- **WHEN** calling `evaluateTokenLevel({ results: [], metrics })`
- **THEN** the function SHALL return metric scores of `0` for each metric

## MODIFIED Requirements

### Requirement: ChunkLevelEvaluation orchestrator
The system SHALL provide a `ChunkLevelEvaluation` class that accepts a `Corpus` and `langsmithDatasetName`. Its `run` method SHALL accept a `Chunker`, `Embedder`, optional `VectorStore` (default: InMemoryVectorStore), optional `Reranker`, optional metrics (default: recall, precision, F1), and `k` (default: 5). It SHALL internally create a `VectorRAGRetriever` and delegate to `runExperiment()` with `evaluationType: 'chunk-level'`. The public API SHALL remain unchanged for backward compatibility.

#### Scenario: End-to-end chunk-level evaluation
- **WHEN** calling `evaluation.run({ chunker, embedder, k: 5 })`
- **THEN** the system SHALL chunk the corpus, embed, index, retrieve for each ground truth query, compute metrics, and return averaged scores

#### Scenario: Default vector store is InMemoryVectorStore
- **WHEN** no `vectorStore` is provided in run options
- **THEN** the system SHALL use `InMemoryVectorStore`

#### Scenario: Reranker is applied after retrieval
- **WHEN** a `reranker` is provided
- **THEN** retrieved chunks SHALL be reranked before metric computation

#### Scenario: Custom metrics override defaults
- **WHEN** `metrics: [chunkRecall]` is provided
- **THEN** only chunk recall SHALL be computed (not precision or F1)

#### Scenario: Backward compatible API
- **WHEN** using the existing `ChunkLevelEvaluation` constructor and `run()` method signatures
- **THEN** the API SHALL work identically to the previous implementation

### Requirement: TokenLevelEvaluation orchestrator
The system SHALL provide a `TokenLevelEvaluation` class that accepts a `Corpus` and `langsmithDatasetName`. Its `run` method SHALL accept a `Chunker | PositionAwareChunker`, `Embedder`, optional `VectorStore`, optional `Reranker`, optional metrics (default: span recall, precision, IoU), and `k`. It SHALL internally create a `VectorRAGRetriever` and delegate to `runExperiment()` with `evaluationType: 'token-level'`. If a basic `Chunker` is provided, it SHALL be wrapped with `ChunkerPositionAdapter`. The public API SHALL remain unchanged for backward compatibility.

#### Scenario: End-to-end token-level evaluation
- **WHEN** calling `evaluation.run({ chunker, embedder, k: 5 })`
- **THEN** the system SHALL chunk with positions, embed, index, retrieve for each ground truth query, convert to spans, compute metrics, and return averaged scores

#### Scenario: Basic Chunker is auto-wrapped
- **WHEN** passing a `Chunker` (not `PositionAwareChunker`) to token-level evaluation
- **THEN** it SHALL be wrapped with `ChunkerPositionAdapter` automatically

#### Scenario: PositionAwareChunker is used directly
- **WHEN** passing a `PositionAwareChunker` to token-level evaluation
- **THEN** it SHALL be used directly without wrapping

#### Scenario: Backward compatible API
- **WHEN** using the existing `TokenLevelEvaluation` constructor and `run()` method signatures
- **THEN** the API SHALL work identically to the previous implementation
