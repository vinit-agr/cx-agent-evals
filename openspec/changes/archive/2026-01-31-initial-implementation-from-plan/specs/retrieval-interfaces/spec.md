## ADDED Requirements

### Requirement: Embedder interface
The system SHALL define an `Embedder` interface with `readonly name: string`, `readonly dimension: number`, `embed(texts: string[]): Promise<number[][]>`, and `embedQuery(query: string): Promise<number[]>`. Implementations MUST ensure `embed(["x"])[0]` produces the same vector as `embedQuery("x")`.

#### Scenario: Embed multiple texts
- **WHEN** calling `embedder.embed(["hello", "world"])`
- **THEN** the result SHALL be an array of two number arrays, each of length `embedder.dimension`

#### Scenario: Single query embedding consistency
- **WHEN** calling `embedder.embedQuery("hello")`
- **THEN** the result SHALL equal the first element of `embedder.embed(["hello"])`

### Requirement: VectorStore interface
The system SHALL define a `VectorStore` interface with `readonly name: string`, `add(chunks: PositionAwareChunk[], embeddings: number[][]): Promise<void>`, `search(queryEmbedding: number[], k?: number): Promise<PositionAwareChunk[]>`, and `clear(): Promise<void>`.

#### Scenario: Add and search returns relevant chunks
- **WHEN** adding chunks with embeddings and then searching with a query embedding
- **THEN** the search SHALL return up to `k` chunks ordered by similarity (most similar first)

#### Scenario: Clear removes all data
- **WHEN** calling `clear()` after adding chunks
- **THEN** subsequent searches SHALL return empty results

### Requirement: Reranker interface
The system SHALL define a `Reranker` interface with `readonly name: string` and `rerank(query: string, chunks: PositionAwareChunk[], topK?: number): Promise<PositionAwareChunk[]>`.

#### Scenario: Rerank reorders chunks by relevance
- **WHEN** calling `reranker.rerank(query, chunks, 3)`
- **THEN** the result SHALL contain at most 3 chunks reordered by the reranker's relevance scoring

#### Scenario: Rerank with empty input
- **WHEN** calling `reranker.rerank(query, [], 5)`
- **THEN** the result SHALL be an empty array

### Requirement: InMemoryVectorStore implementation
The system SHALL provide an `InMemoryVectorStore` that implements `VectorStore` using brute-force cosine similarity. It SHALL require no external dependencies.

#### Scenario: Cosine similarity ranking
- **WHEN** adding chunks with distinct embeddings and searching with a query embedding close to one of them
- **THEN** the closest chunk SHALL be returned first

#### Scenario: Works without external dependencies
- **WHEN** importing and using `InMemoryVectorStore`
- **THEN** no external packages (chromadb, etc.) SHALL be required

### Requirement: OpenAIEmbedder implementation
The system SHALL provide an `OpenAIEmbedder` that implements `Embedder` using the OpenAI embeddings API. It SHALL accept an optional `model` (default `"text-embedding-3-small"`) and optional pre-built client. It SHALL provide a static `create()` async factory for initialization without a pre-built client. It SHALL load the `openai` package via dynamic `import()`.

#### Scenario: Create with async factory
- **WHEN** calling `OpenAIEmbedder.create()`
- **THEN** the embedder SHALL be initialized with a new OpenAI client using environment credentials

#### Scenario: Missing openai package
- **WHEN** `OpenAIEmbedder.create()` is called and the `openai` package is not installed
- **THEN** the factory SHALL throw an error with installation instructions

### Requirement: ChromaVectorStore implementation
The system SHALL provide a `ChromaVectorStore` that implements `VectorStore` using ChromaDB. It SHALL store chunk positions (`start`, `end`, `docId`) in Chroma metadata. It SHALL load `chromadb` via dynamic `import()`.

#### Scenario: Positions preserved through storage
- **WHEN** adding a `PositionAwareChunk` with `start: 10, end: 50, docId: "doc.md"` and then retrieving it via search
- **THEN** the returned chunk SHALL have the same `start`, `end`, and `docId` values

### Requirement: CohereReranker implementation
The system SHALL provide a `CohereReranker` that implements `Reranker` using the Cohere rerank API. It SHALL load `cohere-ai` via dynamic `import()`.

#### Scenario: Rerank with Cohere
- **WHEN** calling `reranker.rerank(query, chunks, 3)` with a valid Cohere client
- **THEN** the result SHALL contain chunks reordered by Cohere's relevance scores
