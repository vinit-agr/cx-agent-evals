## REMOVED Requirements

### Requirement: Branded type system for compile-time safety
**Reason**: Removing `ChunkId` from the branded types. The requirement is modified, not removed entirely.
**Migration**: Use `PositionAwareChunk` with position information instead of `ChunkId`.

## MODIFIED Requirements

### Requirement: Branded type system for compile-time safety
The system SHALL provide a `Brand<K, T>` utility type using `unique symbol` that creates nominal types from structural types. Branded types SHALL exist for `DocumentId`, `QueryId`, `QueryText`, and `PositionAwareChunkId`, all branding `string`. The `ChunkId` type SHALL NOT be provided.

#### Scenario: Branded types prevent cross-assignment
- **WHEN** a function accepts `DocumentId` as a parameter
- **THEN** passing a plain `string` or a `PositionAwareChunkId` value SHALL produce a TypeScript compile error

#### Scenario: Factory functions create branded values
- **WHEN** calling `DocumentId("test.md")`
- **THEN** the return value SHALL have type `DocumentId` and runtime value `"test.md"`

### Requirement: Ground truth and dataset example types
The system SHALL define `GroundTruth` (query + `relevantSpans: CharacterSpan[]`), `DatasetExample`, and `EvaluationResult` (with `metrics: Record<string, number>`). The `EvaluationType` discriminator type SHALL NOT be provided. The `ChunkLevelGroundTruth` and `ChunkLevelDatasetExample` types SHALL NOT be provided.

#### Scenario: EvaluationResult contains metric scores
- **WHEN** an evaluation completes
- **THEN** the result SHALL contain a `metrics` record mapping metric names to numeric scores, and optionally an `experimentUrl`

#### Scenario: GroundTruth contains spans
- **WHEN** creating a ground truth entry
- **THEN** it SHALL have a `query` field and a `relevantSpans` field containing `CharacterSpan[]`

### Requirement: Zod runtime validation schemas
The system SHALL provide Zod schemas for `Document`, `Corpus`, `CharacterSpan`, and `DatasetExample` to validate data at system boundaries (file loading, LangSmith responses). The `ChunkLevelDatasetExampleSchema` SHALL NOT be provided.

#### Scenario: Validate LangSmith dataset example
- **WHEN** parsing a raw JSON object from LangSmith as a `DatasetExample`
- **THEN** the Zod schema SHALL validate the structure and throw on missing or invalid fields

## RENAMED Requirements

### Requirement: Ground truth and dataset example types
- **FROM**: `TokenLevelGroundTruth`
- **TO**: `GroundTruth`

### Requirement: Ground truth and dataset example types
- **FROM**: `TokenLevelDatasetExample`
- **TO**: `DatasetExample`

### Requirement: Zod runtime validation schemas
- **FROM**: `TokenLevelDatasetExampleSchema`
- **TO**: `DatasetExampleSchema`
