## ADDED Requirements

### Requirement: ChunkLevelEvaluation orchestrator
The system SHALL provide a `ChunkLevelEvaluation` class that accepts a `Corpus` and `langsmithDatasetName`. Its `run` method SHALL accept a `Chunker`, `Embedder`, optional `VectorStore` (default: InMemoryVectorStore), optional `Reranker`, optional metrics (default: recall, precision, F1), and `k` (default: 5). It SHALL chunk the corpus, embed chunks, index them, load ground truth from LangSmith, and compute metrics per query, returning averaged `EvaluationResult`.

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

### Requirement: TokenLevelEvaluation orchestrator
The system SHALL provide a `TokenLevelEvaluation` class that accepts a `Corpus` and `langsmithDatasetName`. Its `run` method SHALL accept a `Chunker | PositionAwareChunker`, `Embedder`, optional `VectorStore`, optional `Reranker`, optional metrics (default: span recall, precision, IoU), and `k`. If a basic `Chunker` is provided, it SHALL be wrapped with `ChunkerPositionAdapter`. Retrieved chunks SHALL be converted to `CharacterSpan` for metric computation.

#### Scenario: End-to-end token-level evaluation
- **WHEN** calling `evaluation.run({ chunker, embedder, k: 5 })`
- **THEN** the system SHALL chunk with positions, embed, index, retrieve for each ground truth query, convert to spans, compute metrics, and return averaged scores

#### Scenario: Basic Chunker is auto-wrapped
- **WHEN** passing a `Chunker` (not `PositionAwareChunker`) to token-level evaluation
- **THEN** it SHALL be wrapped with `ChunkerPositionAdapter` automatically

#### Scenario: PositionAwareChunker is used directly
- **WHEN** passing a `PositionAwareChunker` to token-level evaluation
- **THEN** it SHALL be used directly without wrapping

### Requirement: Embedding batching
The evaluation orchestrators SHALL batch embedding calls with a configurable `batchSize` (default: 100) to stay within API limits. Vector store `add` calls SHALL also be batched.

#### Scenario: Large corpus is batched
- **WHEN** evaluating a corpus with 500 chunks and `batchSize: 100`
- **THEN** the embedder SHALL be called 5 times with 100 texts each

### Requirement: Vector store cleanup
The evaluation orchestrators SHALL call `vectorStore.clear()` after evaluation completes, including on error (using a finally block or equivalent).

#### Scenario: Cleanup on success
- **WHEN** evaluation completes successfully
- **THEN** `vectorStore.clear()` SHALL be called

#### Scenario: Cleanup on error
- **WHEN** evaluation throws an error during metric computation
- **THEN** `vectorStore.clear()` SHALL still be called
