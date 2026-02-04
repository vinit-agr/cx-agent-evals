## REMOVED Requirements

### Requirement: ChunkLevelEvaluation orchestrator
**Reason**: Chunk-level evaluation is being removed entirely in favor of span-based evaluation.
**Migration**: Use the `Evaluation` class (formerly `TokenLevelEvaluation`) instead.

### Requirement: Pure evaluateChunkLevel function
**Reason**: Chunk-level evaluation is being removed entirely.
**Migration**: Use the `evaluate` function (formerly `evaluateTokenLevel`) instead.

## MODIFIED Requirements

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

## RENAMED Requirements

### Requirement: Evaluation orchestrator
- **FROM**: `TokenLevelEvaluation`
- **TO**: `Evaluation`

### Requirement: Evaluation orchestrator
- **FROM**: `TokenLevelEvaluationConfig`
- **TO**: `EvaluationConfig`

### Requirement: Evaluation orchestrator
- **FROM**: `TokenLevelRunOptions`
- **TO**: `RunOptions`

### Requirement: Pure evaluate function
- **FROM**: `evaluateTokenLevel`
- **TO**: `evaluate`

### Requirement: Pure evaluate function
- **FROM**: `TokenLevelEvaluateOptions`
- **TO**: `EvaluateOptions`
