# Slice 4 — Index Stage Strategies

> Part of the [Pipeline Retrievers Plan](./pipeline-retrievers-shared-context.md). See shared context for codebase state and design decisions.

**Unlocks**: Contextual + Summary + Parent-Child indexing. Multiplies experiment grid by ~4x index strategies.

### 4a. Index Config Types

**File**: `packages/eval-lib/src/retrievers/pipeline/config.ts` — convert `IndexConfig` from a single interface to a discriminated union:

```typescript
// RENAME existing to PlainIndexConfig
export interface PlainIndexConfig {
  readonly strategy: "plain";
  readonly chunkSize?: number;          // default 1000
  readonly chunkOverlap?: number;       // default 200
  readonly separators?: readonly string[];
  readonly embeddingModel?: string;
}

// NEW
export interface ContextualIndexConfig {
  readonly strategy: "contextual";
  readonly chunkSize?: number;
  readonly chunkOverlap?: number;
  readonly embeddingModel?: string;
  readonly contextPrompt?: string;      // custom prompt for situating context
  readonly concurrency?: number;        // parallel LLM calls, default 5
}

export interface SummaryIndexConfig {
  readonly strategy: "summary";
  readonly chunkSize?: number;
  readonly chunkOverlap?: number;
  readonly embeddingModel?: string;
  readonly summaryPrompt?: string;
  readonly concurrency?: number;
}

export interface ParentChildIndexConfig {
  readonly strategy: "parent-child";
  readonly childChunkSize?: number;     // default 200
  readonly parentChunkSize?: number;    // default 1000
  readonly childOverlap?: number;       // default 0
  readonly parentOverlap?: number;      // default 100
  readonly embeddingModel?: string;
}

// UPDATED — now a discriminated union
export type IndexConfig =
  | PlainIndexConfig
  | ContextualIndexConfig
  | SummaryIndexConfig
  | ParentChildIndexConfig;

// DEFAULT unchanged — still "plain"
export const DEFAULT_INDEX_CONFIG: PlainIndexConfig = {
  strategy: "plain",
  chunkSize: 1000,
  chunkOverlap: 200,
  embeddingModel: "text-embedding-3-small",
} as const;
```

**Breaking change note**: `IndexConfig` was `{ strategy: "plain"; ... }` — code that pattern-matched on `config.index.strategy === "plain"` still works. Code that assumed `IndexConfig` always has `chunkSize` etc. will need a discriminated switch.

### 4b. Update computeIndexConfigHash

**File**: `packages/eval-lib/src/retrievers/pipeline/config.ts`

Replace the concrete `IndexHashPayload` interface with strategy-aware hashing:

```typescript
// REMOVE:
// interface IndexHashPayload { ... }

// REPLACE computeIndexConfigHash with:
export function computeIndexConfigHash(config: PipelineConfig): string {
  const index = config.index ?? DEFAULT_INDEX_CONFIG;

  let payload: Record<string, unknown>;

  switch (index.strategy) {
    case "plain":
      payload = {
        strategy: "plain",
        chunkSize: index.chunkSize ?? 1000,
        chunkOverlap: index.chunkOverlap ?? 200,
        separators: index.separators,
        embeddingModel: index.embeddingModel ?? "text-embedding-3-small",
      };
      break;
    case "contextual":
      payload = {
        strategy: "contextual",
        chunkSize: index.chunkSize ?? 1000,
        chunkOverlap: index.chunkOverlap ?? 200,
        embeddingModel: index.embeddingModel ?? "text-embedding-3-small",
        contextPrompt: index.contextPrompt ?? DEFAULT_CONTEXT_PROMPT,
        // concurrency does NOT affect output — excluded from hash
      };
      break;
    case "summary":
      payload = {
        strategy: "summary",
        chunkSize: index.chunkSize ?? 1000,
        chunkOverlap: index.chunkOverlap ?? 200,
        embeddingModel: index.embeddingModel ?? "text-embedding-3-small",
        summaryPrompt: index.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT,
      };
      break;
    case "parent-child":
      payload = {
        strategy: "parent-child",
        childChunkSize: index.childChunkSize ?? 200,
        parentChunkSize: index.parentChunkSize ?? 1000,
        childOverlap: index.childOverlap ?? 0,
        parentOverlap: index.parentOverlap ?? 100,
        embeddingModel: index.embeddingModel ?? "text-embedding-3-small",
      };
      break;
  }

  const json = stableStringify(payload);
  return createHash("sha256").update(json).digest("hex");
}
```

**Key principle**: Fields that affect output (prompts, sizes, models) go in the hash. Fields that affect performance but not output (concurrency, batchSize) do NOT.

### 4c. Update computeRetrieverConfigHash

The existing `computeRetrieverConfigHash` resolves defaults for the index portion using `DEFAULT_INDEX_CONFIG`. When `IndexConfig` becomes a union, the index portion of the hash payload must use a strategy-aware switch, matching `computeIndexConfigHash`.

**IMPORTANT — Hash stability**: The current `computeRetrieverConfigHash` inlines the index fields directly in the payload object. We MUST preserve this structure (nested `index` object, not a string hash) to avoid changing hash values for existing retrievers stored in the backend. Changing the payload structure would invalidate all existing `retrieverConfigHash` values, causing duplicate retrievers to be created.

```typescript
export function computeRetrieverConfigHash(config: PipelineConfig, k: number): string {
  const index = config.index ?? DEFAULT_INDEX_CONFIG;
  const query = config.query ?? DEFAULT_QUERY_CONFIG;
  const search = config.search ?? DEFAULT_SEARCH_CONFIG;
  const refinement = config.refinement ?? [];

  // Build the index portion using the same strategy-aware logic as computeIndexConfigHash,
  // but inline it as a nested object (NOT as a hash string) to preserve hash stability
  // with existing stored retrieverConfigHash values.
  let indexPayload: Record<string, unknown>;

  switch (index.strategy) {
    case "plain":
      indexPayload = {
        strategy: "plain",
        chunkSize: index.chunkSize ?? 1000,
        chunkOverlap: index.chunkOverlap ?? 200,
        separators: index.separators,
        embeddingModel: index.embeddingModel ?? "text-embedding-3-small",
      };
      break;
    case "contextual":
      indexPayload = {
        strategy: "contextual",
        chunkSize: index.chunkSize ?? 1000,
        chunkOverlap: index.chunkOverlap ?? 200,
        embeddingModel: index.embeddingModel ?? "text-embedding-3-small",
        contextPrompt: index.contextPrompt ?? DEFAULT_CONTEXT_PROMPT,
      };
      break;
    case "summary":
      indexPayload = {
        strategy: "summary",
        chunkSize: index.chunkSize ?? 1000,
        chunkOverlap: index.chunkOverlap ?? 200,
        embeddingModel: index.embeddingModel ?? "text-embedding-3-small",
        summaryPrompt: index.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT,
      };
      break;
    case "parent-child":
      indexPayload = {
        strategy: "parent-child",
        childChunkSize: index.childChunkSize ?? 200,
        parentChunkSize: index.parentChunkSize ?? 1000,
        childOverlap: index.childOverlap ?? 0,
        parentOverlap: index.parentOverlap ?? 100,
        embeddingModel: index.embeddingModel ?? "text-embedding-3-small",
      };
      break;
  }

  const payload = {
    index: indexPayload,
    k,
    query,
    refinement,
    search,
  };

  const json = stableStringify(payload);
  return createHash("sha256").update(json).digest("hex");
}
```

**Hash stability guarantee**: For `strategy: "plain"`, the `indexPayload` shape is identical to the current `computeRetrieverConfigHash` implementation's inline index object: `{ strategy, chunkSize, chunkOverlap, separators, embeddingModel }`. This means existing "plain" retriever hashes remain unchanged. New strategies produce new hashes (no collision risk).

### 4d. Contextual Indexing Implementation

In `pipeline-retriever.ts`, within `init()`:

```
Algorithm:
  1. Chunk all documents normally (using configured chunker)
  2. For each chunk, in parallel batches of `concurrency`:
     a. Send to LLM: contextPrompt + full document text + chunk text
     b. LLM returns ~50-100 tokens of situating context
     c. Create enriched text: context + "\n\n" + chunk.content
  3. Embed the enriched text (not the raw chunk)
  4. Store in vector store: (enriched_embedding, original_chunk)
  5. The stored chunk retains its original content and positions
```

Default context prompt:

```
"<document>\n{doc.content}\n</document>\n\nHere is the chunk we want to situate within the whole document:\n<chunk>\n{chunk.content}\n</chunk>\n\nPlease give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else."
```

Uses `mapWithConcurrency` from `utils/concurrency.ts` (already exists in the codebase) to limit parallel LLM calls.

### 4e. Summary Indexing Implementation

```
Algorithm:
  1. Chunk all documents normally
  2. For each chunk, in parallel batches:
     a. Send to LLM: summaryPrompt + chunk text
     b. LLM returns a concise summary
  3. Embed the summaries
  4. Store mapping: Map<chunkId, { summaryEmbedding, originalChunk }>
  5. At search time:
     a. Embed query
     b. Search summary embeddings
     c. Return the original chunks (with original positions)
```

**Instance state**: `_summaryToChunkMap: Map<string, PositionAwareChunk>` — maps summary vector store entries back to original chunks.

### 4f. Parent-Child Indexing Implementation

```
Algorithm:
  1. Chunk documents at parent granularity (parentChunkSize, parentOverlap)
  2. Chunk documents at child granularity (childChunkSize, childOverlap)
  3. Build parent-child relationships:
     For each child, find the parent where child.start >= parent.start && child.end <= parent.end
  4. Embed and index child chunks only
  5. At search time:
     a. Search child chunks
     b. For each matched child, look up its parent
     c. Deduplicate parents
     d. Return unique parent chunks

  Position tracking: Parents are PositionAwareChunks with their own start/end.
```

**Instance state**: `_childToParent: Map<PositionAwareChunkId, PositionAwareChunk>`

### 4g. LLM Validation for Index Strategies

**Prerequisite**: `PipelineRetrieverDeps.llm` field must already exist (added in Slice 3, section 3c). This validation is added alongside the query-strategy LLM validation from Slice 3.

Constructor must validate LLM requirement for index strategies too:

```typescript
const llmIndexStrategies = ["contextual", "summary"];
const indexStrategy = (config.index ?? DEFAULT_INDEX_CONFIG).strategy;
if (llmIndexStrategies.includes(indexStrategy) && !deps.llm) {
  throw new Error(
    `PipelineRetriever: index strategy "${indexStrategy}" requires an LLM but none was provided in deps.`
  );
}
```

---

## Testing (Slice 4)

```typescript
describe("Index strategies", () => {
  it("contextual should enrich chunks with LLM context before embedding", async () => {
    // ... verify LLM called for each chunk, enriched text embedded
  });

  it("parent-child should search children and return parents", async () => {
    // ... verify child-parent mapping and dedup
  });

  it("should throw if LLM-requiring index strategy has no llm", () => {
    expect(() => new PipelineRetriever(
      { name: "test", index: { strategy: "contextual" } },
      { chunker: mockChunker, embedder: mockEmbedder /* no llm */ }
    )).toThrow(/requires an LLM/);
  });
});

describe("Config hash stability", () => {
  it("computeIndexConfigHash should be stable across identical plain configs", () => {
    const config1: PipelineConfig = { name: "a", index: { strategy: "plain", chunkSize: 1000 } };
    const config2: PipelineConfig = { name: "b", index: { strategy: "plain", chunkSize: 1000 } };
    expect(computeIndexConfigHash(config1)).toBe(computeIndexConfigHash(config2));
  });

  it("computeIndexConfigHash should differ for different strategies", () => {
    const plain: PipelineConfig = { name: "a", index: { strategy: "plain" } };
    const contextual: PipelineConfig = { name: "b", index: { strategy: "contextual" } };
    expect(computeIndexConfigHash(plain)).not.toBe(computeIndexConfigHash(contextual));
  });

  it("concurrency should NOT affect index config hash", () => {
    const a: PipelineConfig = { name: "a", index: { strategy: "contextual", concurrency: 5 } };
    const b: PipelineConfig = { name: "b", index: { strategy: "contextual", concurrency: 10 } };
    expect(computeIndexConfigHash(a)).toBe(computeIndexConfigHash(b));
  });
});
```

### New Test Files (Slice 4)
- `tests/unit/retrievers/pipeline/index-strategies.test.ts`
- `tests/unit/retrievers/pipeline/config-hash.test.ts`

### Modified Files (Slice 4)
- `src/retrievers/pipeline/config.ts` — IndexConfig union, hash functions
- `src/retrievers/pipeline/pipeline-retriever.ts` — index strategy switch in init()
