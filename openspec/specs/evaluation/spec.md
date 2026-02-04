## Purpose

Evaluation orchestrator for span-based RAG retrieval pipeline assessment.

## Requirements

### Requirement: Evaluation orchestrator
The system SHALL provide an `Evaluation` class that accepts a `Corpus` and `langsmithDatasetName`. Its `run` method SHALL accept a `PositionAwareChunker`, `Embedder`, optional `VectorStore` (default: InMemoryVectorStore), optional `Reranker`, optional metrics (default: recall, precision, iou), and `k`. It SHALL internally create a `VectorRAGRetriever` and delegate to `runExperiment()`. The chunker parameter SHALL require `PositionAwareChunker` (basic `Chunker` with adapter wrapping is NOT supported).

#### Scenario: End-to-end evaluation
- **WHEN** calling `evaluation.run({ chunker, embedder, k: 5 })`
- **THEN** the system SHALL chunk with positions, embed, index, retrieve for each ground truth query, convert to spans, compute metrics, and return averaged scores

#### Scenario: PositionAwareChunker is required
- **WHEN** passing a chunker to evaluation
- **THEN** it SHALL be a `PositionAwareChunker` that provides position information

#### Scenario: Default vector store is InMemoryVectorStore
- **WHEN** no `vectorStore` is provided in run options
- **THEN** the system SHALL use `InMemoryVectorStore`

#### Scenario: Reranker is applied after retrieval
- **WHEN** a `reranker` is provided
- **THEN** retrieved chunks SHALL be reranked before metric computation

#### Scenario: Custom metrics override defaults
- **WHEN** `metrics: [recall]` is provided
- **THEN** only recall SHALL be computed (not precision or iou)

### Requirement: Pure evaluate function
The system SHALL provide a pure function `evaluate(options: { results: Array<{ retrieved: CharacterSpan[], groundTruth: CharacterSpan[] }>, metrics: Metric[] }): Record<string, number>` that computes metric scores for each result and returns averaged scores. It SHALL perform no I/O operations.

#### Scenario: Evaluate results
- **WHEN** calling `evaluate({ results, metrics })`
- **THEN** the function SHALL compute each metric for each result and return averaged scores

#### Scenario: Empty results returns zeros
- **WHEN** calling `evaluate({ results: [], metrics })`
- **THEN** the function SHALL return metric scores of `0` for each metric

### Requirement: Embedding batching
The evaluation orchestrator SHALL batch embedding calls with a configurable `batchSize` (default: 100) to stay within API limits. Vector store `add` calls SHALL also be batched.

#### Scenario: Large corpus is batched
- **WHEN** evaluating a corpus with 500 chunks and `batchSize: 100`
- **THEN** the embedder SHALL be called 5 times with 100 texts each

### Requirement: Vector store cleanup
The evaluation orchestrator SHALL call `vectorStore.clear()` after evaluation completes, including on error (using a finally block or equivalent).

#### Scenario: Cleanup on success
- **WHEN** evaluation completes successfully
- **THEN** `vectorStore.clear()` SHALL be called

#### Scenario: Cleanup on error
- **WHEN** evaluation throws an error during metric computation
- **THEN** `vectorStore.clear()` SHALL still be called
