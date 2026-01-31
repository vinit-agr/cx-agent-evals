## Context

This is a greenfield TypeScript library for evaluating RAG retrieval pipelines. There is no existing codebase — the project starts from an empty directory with brainstorm and implementation plan documents as input. The library targets Node.js 18+ and will be published as an ESM/CJS dual-format npm package.

The core architectural insight is that evaluation type (chunk-level vs token-level) is a foundational choice that shapes the entire pipeline: different dataset schemas, different synthetic data generation strategies, different chunker interfaces, different metrics, and strong typing that makes incompatible combinations impossible at compile time.

## Goals / Non-Goals

**Goals:**
- Type-safe evaluation framework with branded types preventing misuse at compile time
- Two complete evaluation paths (chunk-level and token-level) with shared infrastructure
- Pluggable interfaces for chunkers, embedders, vector stores, and rerankers
- Built-in implementations for common tools (OpenAI, Chroma, Cohere)
- LLM-driven synthetic ground truth generation
- LangSmith integration for dataset storage and experiment tracking
- Comprehensive test suite runnable without external API keys (using mocks and in-memory implementations)

**Non-Goals:**
- Answer/generation quality evaluation (this is retrieval-only)
- Production RAG pipeline runtime (this is an evaluation/benchmarking tool)
- UI or dashboard (results go to LangSmith)
- Support for non-TypeScript consumers (no REST API, no CLI)

## Decisions

### 1. Branded types via `unique symbol` for nominal typing

Use `unique symbol`-based branded types rather than simple string literal brands. This prevents accidental structural compatibility between separately declared branded types.

```typescript
declare const __brand: unique symbol;
type Brand<K extends string, T> = T & { readonly [__brand]: K };
```

**Alternative considered**: Plain string-literal brands (`T & { __brand: K }`). Rejected because two brands with the same string key would be structurally compatible.

### 2. Two separate chunker interfaces with adapter pattern

`Chunker` (returns `string[]`) and `PositionAwareChunker` (returns `PositionAwareChunk[]`) are separate interfaces. `ChunkerPositionAdapter` wraps a `Chunker` to make it position-aware by locating chunk text in the source document via `indexOf`.

**Alternative considered**: Single interface with optional positions. Rejected because it makes the type system weaker — callers can't know at compile time whether positions are available.

### 3. Metrics as plain named objects, not classes

Metrics carry no state. Use `{ name, calculate }` objects instead of classes to avoid unnecessary instantiation (particularly the `ChunkF1` allocating `new ChunkRecall()` on every call).

```typescript
interface NamedMetric<TRetrieved, TGroundTruth> {
  readonly name: string;
  readonly calculate: (retrieved: TRetrieved, groundTruth: TGroundTruth) => number;
}
```

### 4. `SpanRange` type for internal metric computation

`CharacterSpan` requires `text` with validated length matching `end - start`. Span merging produces spans with no meaningful `text`. Introduce an internal `SpanRange` (`{ docId, start, end }`) for metric calculations, keeping `CharacterSpan` at API boundaries.

### 5. InMemoryVectorStore as first-class implementation

Ship an `InMemoryVectorStore` using brute-force cosine similarity. This serves as both a testing utility and a zero-dependency default, eliminating the Chroma requirement for basic usage and CI.

### 6. Dynamic imports for optional dependencies

All optional dependencies (openai, chromadb, cohere-ai, langsmith) are loaded via `await import()` — never `require()` — since the project is ESM (`"type": "module"`). Each built-in implementation provides a static `create()` factory for async initialization.

### 7. VectorStore accepts `PositionAwareChunk` universally

Rather than making VectorStore generic, keep it accepting `PositionAwareChunk`. For chunk-level evaluation, produce `PositionAwareChunk` with real document IDs and positions from the chunker (the `RecursiveCharacterChunker` implements both interfaces). This avoids the fake `docId: "unknown"` hack from the implementation plan.

### 8. Token-level synthetic data: hybrid LLM + string matching

The LLM generates queries and quotes relevant text verbatim. A post-processing step locates exact spans via string matching with a fallback to whitespace-normalized case-insensitive search. Spans that can't be located are rejected. This avoids relying on the LLM for character positions.

### 9. Embedding batching

Add a configurable `batchSize` (default: 100) to the evaluation orchestrators. Embedding and vector store `add` calls are batched to stay within API limits.

### 10. Build phase order for fastest testable code

1. Project setup + core types + utils
2. Metrics (pure functions, fully testable immediately)
3. Chunkers + adapter
4. Interfaces + InMemoryVectorStore
5. Evaluation orchestrators (testable with mocks)
6. Synthetic data generation
7. LangSmith integration
8. Built-in implementations (OpenAI, Chroma, Cohere)
9. Package exports + publishing

### 11. No path aliases

Use relative imports throughout instead of `@/*` path aliases. tsup does not resolve TypeScript path aliases by default, and adding a plugin for this adds complexity with no meaningful benefit for a library.

### 12. ESLint 9 flat config with typescript-eslint v8

Use `eslint.config.mjs` with the `typescript-eslint` v8 unified package (no separate parser/plugin packages).

## Risks / Trade-offs

- **[ChunkerPositionAdapter silent data corruption]** If a chunker produces duplicate substrings, `indexOf` may match the wrong occurrence. → Mitigation: After fallback match, verify no overlap with already-assigned spans. Log warnings with chunk preview for debugging.

- **[LLM excerpt hallucination]** LLMs may paraphrase instead of quoting verbatim, causing span location failures. → Mitigation: Whitespace-normalized fuzzy matching fallback. Reject and warn on unfound excerpts rather than silently dropping data.

- **[Chroma dependency for production use]** ChromaDB requires a running server or embedded mode. → Mitigation: InMemoryVectorStore as default; Chroma is opt-in.

- **[Empty recall convention]** Returning 1.0 for empty ground truth (vacuous truth) vs 0.0 is a convention choice. → Mitigation: Use 1.0 (standard IR convention), document explicitly.

- **[Span merging double-computation]** `calculateOverlap` re-merges spans that metrics already merged. → Mitigation: Accept pre-merged spans in the overlap function. Optimize if profiling shows it matters.
