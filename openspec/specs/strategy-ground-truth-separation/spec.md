## ADDED Requirements

### Requirement: QuestionStrategy interface
The system SHALL define a `QuestionStrategy` interface with a `generate(context: StrategyContext): Promise<GeneratedQuery[]>` method. `GeneratedQuery` SHALL contain `query` (string), `targetDocId` (string), and `metadata` (Record<string, string>).

#### Scenario: Strategy produces document-targeted queries
- **WHEN** a strategy generates queries
- **THEN** each `GeneratedQuery` SHALL reference a specific `targetDocId` from the corpus

### Requirement: GroundTruthAssigner interface
The system SHALL define a `GroundTruthAssigner<T>` interface with an `assign(queries: GeneratedQuery[], corpus: Corpus): Promise<T[]>` method. The chunk-level assigner SHALL return `ChunkLevelGroundTruth[]` and the token-level assigner SHALL return `TokenLevelGroundTruth[]`.

#### Scenario: Chunk-level ground truth assignment
- **WHEN** calling the chunk-level assigner with generated queries
- **THEN** it SHALL chunk documents, call the LLM to identify relevant chunk IDs per query, validate IDs exist, and return `ChunkLevelGroundTruth[]`

#### Scenario: Token-level ground truth assignment
- **WHEN** calling the token-level assigner with generated queries
- **THEN** it SHALL call the LLM to extract verbatim excerpts, find character positions via string matching (with whitespace-normalized fallback), and return `TokenLevelGroundTruth[]`

### Requirement: Strategy and assigner composition
The system SHALL allow any `QuestionStrategy` to be composed with any `GroundTruthAssigner`. The public API SHALL accept a strategy and an evaluation type, then wire the appropriate assigner.

#### Scenario: Simple strategy with chunk-level evaluation
- **WHEN** using the simple strategy with chunk-level evaluation type
- **THEN** the simple strategy SHALL generate queries and the chunk-level assigner SHALL produce ground truth

#### Scenario: Dimension-driven strategy with token-level evaluation
- **WHEN** using the dimension-driven strategy with token-level evaluation type
- **THEN** the dimension-driven strategy SHALL generate queries and the token-level assigner SHALL produce ground truth

### Requirement: StrategyContext includes optional embedder
The `StrategyContext` interface SHALL include an optional `embedder` field of type `Embedder`. Existing strategies SHALL continue to work without providing an embedder.

#### Scenario: Embedder is optional
- **WHEN** a strategy is called with a `StrategyContext` that has no `embedder` field
- **THEN** the strategy SHALL function normally (existing behavior unchanged)

#### Scenario: Embedder is provided
- **WHEN** a strategy is called with a `StrategyContext` that includes an `embedder`
- **THEN** the strategy MAY use it for embedding-based operations
