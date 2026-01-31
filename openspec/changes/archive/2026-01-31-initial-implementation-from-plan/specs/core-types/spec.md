## ADDED Requirements

### Requirement: Branded type system for compile-time safety
The system SHALL provide a `Brand<K, T>` utility type using `unique symbol` that creates nominal types from structural types. Branded types SHALL exist for `DocumentId`, `QueryId`, `QueryText`, `ChunkId`, and `PositionAwareChunkId`, all branding `string`.

#### Scenario: Branded types prevent cross-assignment
- **WHEN** a function accepts `DocumentId` as a parameter
- **THEN** passing a plain `string` or a `ChunkId` value SHALL produce a TypeScript compile error

#### Scenario: Factory functions create branded values
- **WHEN** calling `DocumentId("test.md")`
- **THEN** the return value SHALL have type `DocumentId` and runtime value `"test.md"`

### Requirement: Document and Corpus types
The system SHALL define a `Document` interface with readonly fields `id: DocumentId`, `content: string`, and `metadata: Record<string, unknown>`. The system SHALL define a `Corpus` interface with readonly fields `documents: readonly Document[]` and `metadata: Record<string, unknown>`.

#### Scenario: Create a Document via factory
- **WHEN** calling `createDocument({ id: "doc.md", content: "hello", metadata: { source: "test" } })`
- **THEN** the returned object SHALL have `id` as `DocumentId`, frozen metadata, and all fields readonly

#### Scenario: Load corpus from folder
- **WHEN** calling `corpusFromFolder("./knowledge_base")` on a directory containing markdown files
- **THEN** the system SHALL return a `Corpus` with one `Document` per markdown file, where `id` is the filename and `content` is the file text

#### Scenario: Load corpus with custom glob
- **WHEN** calling `corpusFromFolder("./docs", "**/*.txt")`
- **THEN** the system SHALL load only `.txt` files matching the pattern

### Requirement: Chunk types
The system SHALL define `Chunk` (with `id: ChunkId`, `content`, `docId`, `metadata`), `PositionAwareChunk` (adding `start: number` inclusive 0-indexed, `end: number` exclusive), and `CharacterSpan` (with `docId: DocumentId`, `start`, `end`, `text`).

#### Scenario: CharacterSpan validation rejects invalid spans
- **WHEN** creating a `CharacterSpan` with `end <= start`
- **THEN** the Zod schema SHALL throw a validation error

#### Scenario: CharacterSpan validation rejects text length mismatch
- **WHEN** creating a `CharacterSpan` where `text.length !== end - start`
- **THEN** the Zod schema SHALL throw a validation error

#### Scenario: Convert PositionAwareChunk to CharacterSpan
- **WHEN** calling `positionAwareChunkToSpan(chunk)`
- **THEN** the result SHALL have `docId`, `start`, `end` from the chunk and `text` equal to `chunk.content`

### Requirement: SpanRange type for internal computation
The system SHALL define a `SpanRange` interface with `docId: DocumentId`, `start: number`, `end: number` (no `text` field) for use in metric calculations where text content is irrelevant.

#### Scenario: Span merging produces SpanRanges
- **WHEN** merging overlapping spans internally for metric computation
- **THEN** the merge function SHALL operate on and return `SpanRange[]` without requiring a `text` field

### Requirement: Ground truth and dataset example types
The system SHALL define `ChunkLevelGroundTruth` (query + `relevantChunkIds`), `TokenLevelGroundTruth` (query + `relevantSpans`), `ChunkLevelDatasetExample`, `TokenLevelDatasetExample`, and `EvaluationResult` (with `metrics: Record<string, number>`).

#### Scenario: EvaluationResult contains metric scores
- **WHEN** an evaluation completes
- **THEN** the result SHALL contain a `metrics` record mapping metric names to numeric scores, and optionally an `experimentUrl`

### Requirement: Zod runtime validation schemas
The system SHALL provide Zod schemas for `Document`, `Corpus`, `CharacterSpan`, `ChunkLevelDatasetExample`, and `TokenLevelDatasetExample` to validate data at system boundaries (file loading, LangSmith responses).

#### Scenario: Validate LangSmith dataset example
- **WHEN** parsing a raw JSON object from LangSmith as a `TokenLevelDatasetExample`
- **THEN** the Zod schema SHALL validate the structure and throw on missing or invalid fields
