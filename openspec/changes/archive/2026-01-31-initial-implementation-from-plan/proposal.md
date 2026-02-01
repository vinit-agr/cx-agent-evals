## Why

We need a TypeScript library for evaluating RAG retrieval pipelines. The library must support two evaluation paradigms — chunk-level (did we retrieve the right chunks?) and token-level (did we retrieve the right content, measured by character span overlap?) — enabling fair comparison of chunking strategies, embedders, and rerankers against LangSmith-stored ground truth datasets.

## What Changes

- New TypeScript package (`rag-evaluation-system`) with core type system using branded types for compile-time safety
- Chunker interfaces (basic and position-aware) with an adapter pattern bridging the two
- Built-in chunker implementations: recursive character, fixed token, semantic
- Embedder, vector store, and reranker interfaces with built-in implementations (OpenAI, Chroma, Cohere)
- Synthetic data generation using LLMs for both chunk-level and token-level ground truth
- Retrieval metrics: chunk recall/precision/F1 and span recall/precision/IoU
- Evaluation orchestrators that wire together chunker + embedder + vector store + reranker + metrics
- LangSmith integration for dataset storage and experiment tracking

## Capabilities

### New Capabilities

- `core-types`: Branded type system (DocumentId, ChunkId, etc.), Document/Corpus/Chunk/CharacterSpan types, Zod runtime validation schemas, factory functions
- `chunkers`: Chunker and PositionAwareChunker interfaces, ChunkerPositionAdapter, built-in implementations (RecursiveCharacterChunker, FixedTokenChunker, SemanticChunker)
- `retrieval-interfaces`: Embedder, VectorStore, and Reranker interfaces with built-in implementations (OpenAIEmbedder, ChromaVectorStore, CohereReranker, InMemoryVectorStore)
- `metrics`: Chunk-level metrics (recall, precision, F1) and token-level metrics (span recall, span precision, span IoU) with span merging utilities
- `synthetic-datagen`: LLM-driven synthetic dataset generation for both chunk-level (chunker-dependent) and token-level (chunker-independent) ground truth
- `evaluation`: Evaluation orchestrators (ChunkLevelEvaluation, TokenLevelEvaluation) that run end-to-end retrieval evaluation against ground truth datasets
- `langsmith-integration`: LangSmith client wrapper for uploading ground truth datasets and loading them for evaluation

### Modified Capabilities

(none — this is a greenfield implementation)

## Impact

- **New package**: Entire `src/` tree created from scratch (~30 source files across types, chunkers, embedders, vector-stores, rerankers, synthetic-datagen, evaluation, langsmith, utils)
- **Dependencies**: `zod` (required), `langsmith` (peer), `openai`/`chromadb`/`cohere-ai` (optional peer)
- **Build tooling**: pnpm, tsup, vitest, ESLint 9 flat config, Prettier
- **APIs**: Public API surface exported from `src/index.ts` plus subpath exports for optional implementations
