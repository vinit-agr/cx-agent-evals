## ADDED Requirements

### Requirement: Chunker interface
The system SHALL define a `Chunker` interface with `readonly name: string` and `chunk(text: string): string[]`.

#### Scenario: Chunker returns text segments
- **WHEN** calling `chunker.chunk("some long text")`
- **THEN** the result SHALL be an array of non-empty strings that together cover the input text

### Requirement: PositionAwareChunker interface
The system SHALL define a `PositionAwareChunker` interface with `readonly name: string` and `chunkWithPositions(doc: Document): PositionAwareChunk[]`.

#### Scenario: Position-aware chunks have valid positions
- **WHEN** calling `chunker.chunkWithPositions(doc)`
- **THEN** each returned chunk SHALL have `start >= 0`, `end > start`, and `doc.content.slice(chunk.start, chunk.end) === chunk.content`

### Requirement: Type guard for chunker detection
The system SHALL provide `isPositionAwareChunker(chunker): chunker is PositionAwareChunker` that returns `true` if the chunker has a `chunkWithPositions` method.

#### Scenario: Detect position-aware chunker
- **WHEN** passing a `RecursiveCharacterChunker` (which implements both interfaces) to `isPositionAwareChunker`
- **THEN** the result SHALL be `true`

#### Scenario: Detect basic chunker
- **WHEN** passing an object with only a `chunk` method to `isPositionAwareChunker`
- **THEN** the result SHALL be `false`

### Requirement: ChunkerPositionAdapter
The system SHALL provide `ChunkerPositionAdapter` that wraps a `Chunker` to implement `PositionAwareChunker`. It SHALL locate each chunk's position in the source document via sequential `indexOf`. If a chunk cannot be located, the adapter SHALL skip it and increment a `skippedChunks` counter with a console warning.

#### Scenario: Adapter locates chunks sequentially
- **WHEN** wrapping a chunker that splits "AABBCC" into ["AA", "BB", "CC"]
- **THEN** the adapter SHALL produce chunks with positions (0,2), (2,4), (4,6)

#### Scenario: Adapter handles non-locatable chunks
- **WHEN** a chunk's text cannot be found in the source document (e.g., chunker normalized whitespace)
- **THEN** the adapter SHALL skip that chunk, log a warning, and increment `skippedChunks`

#### Scenario: Adapter name includes wrapped chunker name
- **WHEN** wrapping a chunker with `name: "MyChunker"`
- **THEN** the adapter's name SHALL be `"PositionAdapter(MyChunker)"`

### Requirement: RecursiveCharacterChunker
The system SHALL provide `RecursiveCharacterChunker` implementing both `Chunker` and `PositionAwareChunker`. It SHALL accept `chunkSize` (default 1000), `chunkOverlap` (default 200), and `separators` (default `["\n\n", "\n", ". ", " ", ""]`). It SHALL throw if `chunkOverlap >= chunkSize`.

#### Scenario: Chunk text with default settings
- **WHEN** chunking a 3000-character document with default settings
- **THEN** the result SHALL be multiple chunks each no longer than 1000 characters, split at separator boundaries

#### Scenario: Chunk with positions tracks offsets
- **WHEN** calling `chunkWithPositions(doc)` on a document
- **THEN** each chunk's `start` and `end` SHALL correspond to exact character positions in `doc.content`

#### Scenario: Reject invalid overlap
- **WHEN** constructing with `chunkOverlap >= chunkSize`
- **THEN** the constructor SHALL throw an error

### Requirement: Chunk ID generation
The system SHALL provide `generateChunkId(content: string): ChunkId` producing IDs in format `chunk_` + first 12 hex chars of SHA256, and `generatePaChunkId(content: string): PositionAwareChunkId` producing `pa_chunk_` + first 12 hex chars of SHA256. IDs SHALL be deterministic for the same content.

#### Scenario: Deterministic chunk IDs
- **WHEN** calling `generateChunkId("hello world")` twice
- **THEN** both calls SHALL return the same `ChunkId` value

#### Scenario: Different content produces different IDs
- **WHEN** calling `generateChunkId("hello")` and `generateChunkId("world")`
- **THEN** the results SHALL be different
