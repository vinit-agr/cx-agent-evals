## ADDED Requirements

### Requirement: Position-aware chunking helper
The system SHALL provide an `indexSingleDocument` helper function in `convex/ragActions.ts` (a `"use node"` file) that accepts a document ID and chunker/embedder options. It SHALL: (1) read the document content via `ctx.runQuery`, (2) chunk the content using eval-lib's `RecursiveCharacterChunker` (which implements `PositionAwareChunker`), (3) embed each chunk using OpenAI's embedding API via eval-lib's `OpenAIEmbedder`, (4) insert each chunk into the `documentChunks` table via `ctx.runMutation(internal.rag.insertChunk, ...)` with `chunkId`, `content`, `start`, `end`, `embedding`, `documentId`, and `kbId`. The chunker configuration (chunk size, overlap) SHALL be parameterized.

Note: This is a helper function (not a standalone Convex action) because it is called from within batch processing actions (e.g., `experimentActions.runIndexing`).

#### Scenario: Document chunked with character positions
- **WHEN** indexing a document with 5000 characters using chunk size 1000 and overlap 200
- **THEN** approximately 6 chunks SHALL be created, each with accurate `start` and `end` character positions

#### Scenario: Chunk content matches document substring
- **WHEN** a chunk is created with `start: 1000` and `end: 1500`
- **THEN** `chunk.content` SHALL equal `document.content.substring(1000, 1500)`

### Requirement: Chunk storage mutations and queries
The system SHALL provide in `convex/rag.ts` (a regular file, NOT `"use node"`):
- `insertChunk` internalMutation — inserts a single chunk into `documentChunks`
- `deleteDocumentChunks` internalMutation — deletes all chunks for a document (by `documentId` index)
- `deleteKbChunks` internalMutation — deletes all chunks for a knowledge base (by `kbId` index)
- `isIndexed` internalQuery — checks if a knowledge base has any chunks
- `fetchChunksWithDocs` internalQuery — takes an array of chunk IDs and returns full chunk records with the parent document's `docId` joined

These are split into a separate file because `"use node"` files can ONLY contain actions.

### Requirement: Batch document indexing via experiment pipeline
Document indexing is performed as the first phase of the experiment pipeline in `experimentActions.runIndexing`. It SHALL process all documents in the knowledge base using the batch processing pattern (time budget, per-item checkpointing). Each document's chunks SHALL be persisted before moving to the next document. If the knowledge base is already indexed (checked via `rag.isIndexed`), the indexing phase SHALL be skipped.

#### Scenario: Index 100 documents in batches
- **WHEN** indexing a knowledge base with 100 documents
- **THEN** documents SHALL be processed in batches within the time budget, with all chunks for each document persisted before proceeding

#### Scenario: Resume after interruption
- **WHEN** the indexing action is interrupted after processing 37 of 100 documents
- **THEN** the next action SHALL start from document 38, and all chunks from documents 1-37 SHALL be intact

#### Scenario: Skip indexing if already indexed
- **WHEN** starting an experiment on a knowledge base that already has chunks
- **THEN** the indexing phase SHALL be skipped and evaluation SHALL start immediately

### Requirement: Vector search for retrieval (inline in actions)
Vector search SHALL be performed inline within Convex actions (e.g., `experimentActions.runEvaluation`) because `ctx.vectorSearch()` is ONLY available in actions (ActionCtx), not in queries or mutations. The pattern is:

1. Embed the query using OpenAI's embedding API
2. Call `ctx.vectorSearch("documentChunks", "by_embedding", { vector, limit: k, filter: (q) => q.eq("kbId", kbId) })`
3. Hydrate the results by calling `ctx.runQuery(internal.rag.fetchChunksWithDocs, { ids })` to get full chunk records with `docId`

There is NO separate `rag.retrieve` action — retrieval logic is inlined where needed.

#### Scenario: Retrieve top-k chunks for query
- **WHEN** evaluating a question in `experimentActions.runEvaluation`
- **THEN** the action SHALL embed the query, vectorSearch for top-k chunks, and hydrate them with document IDs

#### Scenario: Results scoped to knowledge base
- **WHEN** performing vector search with a `kbId` filter
- **THEN** only chunks from documents in that knowledge base SHALL be returned

### Requirement: Retrieval results as CharacterSpans
After hydration via `fetchChunksWithDocs`, the results SHALL be mapped to eval-lib's `CharacterSpan` interface: `{ docId: chunk.docId, start: chunk.start, end: chunk.end, text: chunk.content }`. Note the field rename: chunk's `content` maps to span's `text`. This enables direct use with eval-lib's metric functions.

#### Scenario: Retrieved chunks used directly for metric computation
- **WHEN** retrieval results are mapped to spans and passed to eval-lib's `recall(retrievedSpans, groundTruthSpans)`
- **THEN** the metrics SHALL compute correctly because both use the same `CharacterSpan` structure with matching `docId` references

### Requirement: Delete chunks for re-indexing
The system SHALL provide internal mutations `rag.deleteDocumentChunks` (by document) and `rag.deleteKbChunks` (by knowledge base) that delete all chunks for the given scope. This enables re-indexing with different chunker configurations.

#### Scenario: Re-index with different chunk size
- **WHEN** deleting chunks for a knowledge base and re-indexing with a new chunk size
- **THEN** all old chunks SHALL be removed before new chunks are created

### Requirement: Optional reranking
**NOT YET IMPLEMENTED** — The system does not currently support reranking. Vector search results are returned directly as top-k without a reranking step. This may be added in a future change.
