# Slice 1 — Provider Breadth

> Part of the [Pipeline Retrievers Plan](./pipeline-retrievers-shared-context.md). See shared context for codebase state and design decisions.

**Unlocks**: 4 embedders x 3 rerankers x 3 search strategies = **36 experiment configs**

This slice adds no new pipeline stages — just new providers that plug into the existing interfaces. Highest ROI starting point.

### 1a. Cohere Embedder

**File**: `packages/eval-lib/src/embedders/cohere.ts`

```typescript
// Implements: Embedder interface (from embedder.interface.ts)
// Package: cohere-ai (already in optionalDependencies)
// Pattern: follows CohereReranker — private constructor + static async create() factory
//   (Note: OpenAIEmbedder uses a PUBLIC constructor + static create(); new embedders
//    use private constructor to force async factory usage for API key / SDK init)

interface CohereEmbedClient {
  embed(opts: {
    model: string;
    texts: string[];
    inputType: string;
    embeddingTypes: string[];
  }): Promise<{
    embeddings: { float: number[][] };
  }>;
}

export class CohereEmbedder implements Embedder {
  readonly name: string;     // "Cohere(embed-english-v3.0)"
  readonly dimension: number; // 1024

  private constructor(client: CohereEmbedClient, model: string);

  static async create(options?: {
    model?: string;  // "embed-english-v3.0" | "embed-multilingual-v3.0"
    apiKey?: string;
  }): Promise<CohereEmbedder>;

  // Key implementation details:
  // embed()      → inputType: "search_document"
  // embedQuery() → inputType: "search_query"
  // Always pass embeddingTypes: ["float"] to get numeric arrays (Cohere also supports int8/ubinary)
}
```

**Models**:
| Model | Dims | Max Tokens | Notes |
|-------|------|------------|-------|
| `embed-english-v3.0` (default) | 1024 | 512 | English-only |
| `embed-multilingual-v3.0` | 1024 | 512 | 100+ languages |

### 1b. Voyage Embedder

**File**: `packages/eval-lib/src/embedders/voyage.ts`

```typescript
// Implements: Embedder interface
// Package: plain fetch to https://api.voyageai.com/v1/embeddings
// Pattern: private constructor + static async create() factory (same as CohereReranker)

export class VoyageEmbedder implements Embedder {
  readonly name: string;     // "Voyage(voyage-3.5)"
  readonly dimension: number; // 1024 (varies by model)

  static async create(options?: {
    model?: string;  // "voyage-3.5" | "voyage-3.5-lite" | "voyage-3" | "voyage-code-3"
    apiKey?: string; // defaults to process.env.VOYAGE_API_KEY
  }): Promise<VoyageEmbedder>;

  // Key implementation detail:
  // embed()      → input_type: "document"
  // embedQuery() → input_type: "query"
}
```

Uses plain `fetch` — no additional npm dependency required. The Voyage API is OpenAI-compatible with an added `input_type` field.

**Models**:
| Model | Dims | Max Tokens | Notes |
|-------|------|------------|-------|
| `voyage-3.5` (default) | 1024 | 32,000 | Best quality/$ |
| `voyage-3.5-lite` | 512 | 32,000 | Budget option |
| `voyage-3` | 1024 | 32,000 | General-purpose |
| `voyage-code-3` | 1024 | 32,000 | Code-optimized |

### 1c. Jina Embedder

**File**: `packages/eval-lib/src/embedders/jina.ts`

```typescript
// Implements: Embedder interface
// Package: plain fetch to https://api.jina.ai/v1/embeddings
// Pattern: private constructor + static async create() factory (same as CohereReranker)

export class JinaEmbedder implements Embedder {
  readonly name: string;     // "Jina(jina-embeddings-v3)"
  readonly dimension: number; // 1024

  static async create(options?: {
    model?: string;     // "jina-embeddings-v3"
    apiKey?: string;    // defaults to process.env.JINA_API_KEY
    dimensions?: number; // Matryoshka: 32-1024, default 1024
  }): Promise<JinaEmbedder>;

  // Key implementation detail:
  // embed()      → task: "retrieval.passage"
  // embedQuery() → task: "retrieval.query"
}
```

Uses plain `fetch` — no additional npm dependency required.

### 1d. Update Cohere Reranker

**File**: `packages/eval-lib/src/rerankers/cohere.ts` (modify existing)

The current `CohereReranker.create()` accepts `{ model?: string }` and defaults to `"rerank-english-v3.0"`. Change the default to `"rerank-v3.5"` (latest) and document the supported models.

```typescript
// CHANGE: Default model from "rerank-english-v3.0" to "rerank-v3.5"
static async create(options?: {
  model?: string;  // "rerank-v3.5" (NEW default) | "rerank-english-v3.0" (old default)
}): Promise<CohereReranker>;
```

**Note**: This is a minor behavior change. If backward compatibility is critical, keep `"rerank-english-v3.0"` as default and just add documentation for the newer model. The factory already accepts any model string.

### 1e. Jina Reranker

**File**: `packages/eval-lib/src/rerankers/jina.ts`

```typescript
// Implements: Reranker interface (from reranker.interface.ts)
// Package: plain fetch to https://api.jina.ai/v1/rerank
// Pattern: follows CohereReranker — private constructor + static async create() factory

export class JinaReranker implements Reranker {
  readonly name: string; // "Jina(jina-reranker-v2-base-multilingual)"

  static async create(options?: {
    model?: string;  // "jina-reranker-v2-base-multilingual"
    apiKey?: string; // defaults to process.env.JINA_API_KEY
  }): Promise<JinaReranker>;

  // API: POST https://api.jina.ai/v1/rerank
  // Request: { model, query, documents: string[], top_n }
  // Response: { results: [{ index, relevance_score }] }
  // Map response indices back to PositionAwareChunk[]
}
```

### 1f. Voyage Reranker

**File**: `packages/eval-lib/src/rerankers/voyage.ts`

```typescript
// Implements: Reranker interface
// Package: plain fetch to https://api.voyageai.com/v1/rerank
// Pattern: follows CohereReranker — private constructor + static async create() factory

export class VoyageReranker implements Reranker {
  readonly name: string; // "Voyage(rerank-2.5)"

  static async create(options?: {
    model?: string;  // "rerank-2.5" | "rerank-2"
    apiKey?: string; // defaults to process.env.VOYAGE_API_KEY
  }): Promise<VoyageReranker>;

  // API: POST https://api.voyageai.com/v1/rerank
  // Request: { model, query, documents: string[], top_k }
  // Response: { data: [{ index, relevance_score }] }
}
```

### 1g. Package.json Changes

Current state after PR #27:

```json
{
  "dependencies": {
    "@langchain/core": "^1.1.0",
    "langsmith": "^0.5.0",
    "minisearch": "^7.2.0",
    "zod": "^3.23"
  },
  "optionalDependencies": {
    "cohere-ai": ">=7.0",
    "openai": ">=4.0"
  }
}
```

**No new npm dependencies needed for Slice 1.** Voyage and Jina use plain `fetch` (Node 18+ built-in). Cohere embedder reuses the existing `cohere-ai` optional dependency. The `langsmith` and `@langchain/core` dependencies were already added in PR #27.

### 1h. tsup Entry Points

Add new entry points for each provider that has an optional dependency, following the existing `embedders/openai` and `rerankers/cohere` pattern:

```typescript
// tsup.config.ts — add to the existing entry array (which already has 8 entry points):
// Existing: src/index.ts, src/embedders/openai.ts, src/rerankers/cohere.ts,
//           src/pipeline/internals.ts, src/utils/index.ts,
//           src/langsmith/index.ts, src/llm/index.ts, src/shared/index.ts
//
// Add:
"src/embedders/cohere.ts",                   // uses cohere-ai (already optional dep)
"src/embedders/voyage.ts",                   // uses plain fetch (no optional dep needed)
"src/embedders/jina.ts",                     // uses plain fetch (no optional dep needed)
"src/rerankers/jina.ts",                     // uses plain fetch
"src/rerankers/voyage.ts",                   // uses plain fetch
"src/retrievers/pipeline/llm-openai.ts",     // Slice 3 — uses openai (already optional dep)
```

Also add these to the `external` array in tsup.config.ts if not already present:

```typescript
external: [
  "openai",          // already present
  "langsmith",       // already present
  "langsmith/evaluation", // already present
  "@langchain/core", // already present
  "cohere-ai",       // already present
],
```

And corresponding package.json exports:

```json
{
  "exports": {
    "./embedders/cohere": { "import": "...", "types": "..." },
    "./embedders/voyage": { "import": "...", "types": "..." },
    "./embedders/jina":   { "import": "...", "types": "..." },
    "./rerankers/jina":   { "import": "...", "types": "..." },
    "./rerankers/voyage": { "import": "...", "types": "..." },
    "./pipeline/llm-openai": { "import": "...", "types": "..." }
  }
}
```

**Design note**: Even though Voyage and Jina use plain `fetch` (no optional deps), separate entry points keep the main bundle lean and maintain the pattern for consistency.

### 1i. Index Exports

**File**: `packages/eval-lib/src/embedders/index.ts` — re-export `CohereEmbedder`, `VoyageEmbedder`, `JinaEmbedder`

**File**: `packages/eval-lib/src/rerankers/index.ts` — re-export `JinaReranker`, `VoyageReranker`

**File**: `packages/eval-lib/src/index.ts` — add to the existing Embedder and Reranker sections:

```typescript
// Embedder
export type { Embedder } from "./embedders/index.js";
export { OpenAIEmbedder, CohereEmbedder, VoyageEmbedder, JinaEmbedder } from "./embedders/index.js";

// Reranker
export type { Reranker } from "./rerankers/index.js";
export { JinaReranker, VoyageReranker } from "./rerankers/index.js";
// CohereReranker remains at "rag-evaluation-system/rerankers/cohere" for backward compat
```

---

## Testing (Slice 1)

```typescript
// Pattern: mock the SDK client/fetch, verify correct API calls
// Follow the existing CohereReranker and OpenAIEmbedder test patterns

describe("CohereEmbedder", () => {
  it("should call embed with inputType search_document for embed()", async () => {
    const mockClient = {
      embed: vi.fn().mockResolvedValue({
        embeddings: { float: [[0.1, 0.2, ...]] },
      }),
    };
    const embedder = new CohereEmbedder(mockClient, "embed-english-v3.0");

    await embedder.embed(["test text"]);

    expect(mockClient.embed).toHaveBeenCalledWith(
      expect.objectContaining({ inputType: "search_document" })
    );
  });

  it("should call embed with inputType search_query for embedQuery()", async () => {
    // ... inputType: "search_query"
  });
});
```

### New Files (Slice 1)
- `src/embedders/cohere.ts`
- `src/embedders/voyage.ts`
- `src/embedders/jina.ts`
- `src/rerankers/jina.ts`
- `src/rerankers/voyage.ts`

### New Test Files (Slice 1)
- `tests/unit/embedders/cohere.test.ts`
- `tests/unit/embedders/voyage.test.ts`
- `tests/unit/embedders/jina.test.ts`
- `tests/unit/rerankers/jina.test.ts`
- `tests/unit/rerankers/voyage.test.ts`

### Modified Files (Slice 1)
- `src/embedders/index.ts` — re-exports
- `src/rerankers/cohere.ts` — model default update
- `src/rerankers/index.ts` — re-exports
- `src/index.ts` — root barrel
- `package.json` — dependency versions
- `tsup.config.ts` — new entry points
