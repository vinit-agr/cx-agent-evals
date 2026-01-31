## 1. Project Setup

- [x] 1.1 Initialize project with pnpm, create package.json with ESM config, dependencies, scripts
- [x] 1.2 Create tsconfig.json (strict, ES2022, bundler resolution, no path aliases)
- [x] 1.3 Create tsup.config.ts (ESM + CJS, dts, multiple entry points for subpath exports)
- [x] 1.4 Create vitest.config.ts with coverage config
- [x] 1.5 Create eslint.config.mjs (ESLint 9 flat config with typescript-eslint v8)
- [x] 1.6 Create .prettierrc and .gitignore
- [x] 1.7 Create full src/ and tests/ directory structure
- [x] 1.8 Install all dependencies (zod, dev deps, optional peer deps for development)

## 2. Core Types and Utilities

- [x] 2.1 Implement types/brand.ts (Brand utility with unique symbol)
- [x] 2.2 Implement types/primitives.ts (DocumentId, ChunkId, QueryId, QueryText, PositionAwareChunkId, EvaluationType, factory functions)
- [x] 2.3 Implement types/documents.ts (Document, Corpus interfaces, Zod schemas, createDocument, createCorpus, corpusFromFolder)
- [x] 2.4 Implement types/chunks.ts (Chunk, PositionAwareChunk, CharacterSpan, SpanRange, Zod schemas, factories, positionAwareChunkToSpan)
- [x] 2.5 Implement types/queries.ts (Query interface)
- [x] 2.6 Implement types/ground-truth.ts (ChunkLevel/TokenLevel ground truth and dataset example types with Zod schemas)
- [x] 2.7 Implement types/results.ts (EvaluationResult, RunOutput types)
- [x] 2.8 Implement types/index.ts re-exports
- [x] 2.9 Implement utils/hashing.ts (generateChunkId, generatePaChunkId)
- [x] 2.10 Implement utils/span.ts (spanOverlaps, spanOverlapChars, spanLength)
- [x] 2.11 Write unit tests for branded types, Zod validation, factories, hashing, span utilities

## 3. Metrics

- [x] 3.1 Implement evaluation/metrics/base.ts (ChunkLevelMetric, TokenLevelMetric interfaces as named objects)
- [x] 3.2 Implement chunk-level metrics: chunkRecall, chunkPrecision, chunkF1 (as plain objects, not classes)
- [x] 3.3 Implement evaluation/metrics/token-level/utils.ts (mergeOverlappingSpans operating on SpanRange, calculateOverlap)
- [x] 3.4 Implement token-level metrics: spanRecall, spanPrecision, spanIoU
- [x] 3.5 Write comprehensive metric tests (edge cases: empty inputs, vacuous truth, cross-document, overlapping spans, perfect/partial/zero scores)

## 4. Chunkers

- [x] 4.1 Implement chunkers/chunker.interface.ts (Chunker, PositionAwareChunker interfaces, isPositionAwareChunker type guard)
- [x] 4.2 Implement chunkers/adapter.ts (ChunkerPositionAdapter with skippedChunks tracking, overlap verification on fallback match)
- [x] 4.3 Implement chunkers/recursive-character.ts (RecursiveCharacterChunker implementing both interfaces, with position tracking)
- [x] 4.4 Write tests for adapter (sequential location, non-locatable chunks, name) and RecursiveCharacterChunker (splitting, positions, overlap validation)

## 5. Retrieval Interfaces and InMemoryVectorStore

- [x] 5.1 Implement embedders/embedder.interface.ts (Embedder interface)
- [x] 5.2 Implement vector-stores/vector-store.interface.ts (VectorStore interface)
- [x] 5.3 Implement rerankers/reranker.interface.ts (Reranker interface)
- [x] 5.4 Implement vector-stores/in-memory.ts (InMemoryVectorStore with cosine similarity)
- [x] 5.5 Write tests for InMemoryVectorStore (add/search/clear, cosine ranking)
- [x] 5.6 Create tests/fixtures.ts (sampleDocument, sampleCorpus, sampleSpans, mockEmbedder)

## 6. Evaluation Orchestrators

- [x] 6.1 Implement evaluation/chunk-level.ts (ChunkLevelEvaluation with batching, cleanup, proper chunk-to-PositionAwareChunk conversion with real docIds)
- [x] 6.2 Implement evaluation/token-level.ts (TokenLevelEvaluation with auto-wrapping, batching, cleanup)
- [x] 6.3 Write integration tests for both orchestrators using InMemoryVectorStore and mockEmbedder (no external API calls)

## 7. Synthetic Data Generation

- [x] 7.1 Implement synthetic-datagen/base.ts (LLMClient interface with flat complete method, openAIClientAdapter, SyntheticDatasetGenerator base class with configurable model)
- [x] 7.2 Implement synthetic-datagen/chunk-level/generator.ts (ChunkLevelSyntheticDatasetGenerator with per-document chunk tracking, validation of returned IDs)
- [x] 7.3 Implement synthetic-datagen/token-level/generator.ts (TokenLevelSyntheticDatasetGenerator with two-step LLM process, string matching with whitespace-normalized fallback, span validation)
- [x] 7.4 Write tests with mocked LLM responses for both generators

## 8. LangSmith Integration

- [x] 8.1 Implement langsmith/get-client.ts (shared getLangSmithClient with dynamic import and error message)
- [x] 8.2 Implement langsmith/upload.ts (uploadChunkLevelDataset, uploadTokenLevelDataset)
- [x] 8.3 Implement langsmith/client.ts (loadChunkLevelDataset, loadTokenLevelDataset with branded type parsing)
- [x] 8.4 Write tests with mocked LangSmith client for upload/load round-trips

## 9. Built-in Implementations

- [x] 9.1 Implement embedders/openai.ts (OpenAIEmbedder with static create factory, dynamic import)
- [x] 9.2 Implement vector-stores/chroma.ts (ChromaVectorStore with position metadata, dynamic import)
- [x] 9.3 Implement rerankers/cohere.ts (CohereReranker with dynamic import)

## 10. Package Exports and Final Wiring

- [x] 10.1 Create src/index.ts with all public exports (types, interfaces, implementations, metrics, utilities)
- [x] 10.2 Configure package.json subpath exports for optional implementations
- [x] 10.3 Verify build produces valid ESM + CJS output with correct type declarations
- [x] 10.4 Run full test suite, lint, and typecheck
