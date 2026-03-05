# Slice 5 — Refinement + Async Chunkers

> Part of the [Pipeline Retrievers Plan](./pipeline-retrievers-shared-context.md). See shared context for codebase state and design decisions.

### 5a. New Refinement Steps

#### Dedup (`type: "dedup"`)

**File**: `packages/eval-lib/src/retrievers/pipeline/refinement/dedup.ts`

```typescript
export interface DedupRefinementStep {
  readonly type: "dedup";
  readonly method?: "exact" | "overlap";    // default "exact"
  readonly overlapThreshold?: number;       // default 0.5, for "overlap" method
}

export function applyDedup(
  results: readonly ScoredChunk[],
  method: "exact" | "overlap",
  overlapThreshold: number,
): ScoredChunk[];

// "exact": hash chunk.content, keep first (highest-scored) occurrence
// "overlap": for chunks from same docId, compute character span overlap ratio.
//   If overlap / min(chunk1.length, chunk2.length) > threshold, keep higher-scored.
```

#### MMR (`type: "mmr"`)

**File**: `packages/eval-lib/src/retrievers/pipeline/refinement/mmr.ts`

```typescript
export interface MmrRefinementStep {
  readonly type: "mmr";
  readonly lambda?: number; // 0-1, default 0.7 (0=max diversity, 1=max relevance)
}

export function applyMmr(
  results: readonly ScoredChunk[],
  k: number,
  lambda: number,
): ScoredChunk[];

// Algorithm:
// 1. Start with empty selected set S
// 2. For each iteration up to k:
//    For each candidate c not in S:
//      relevance = c.score (from search stage)
//      maxSimilarity = max content overlap ratio between c and any chunk in S
//      mmrScore = lambda * relevance - (1-lambda) * maxSimilarity
//    Add highest mmrScore candidate to S
// 3. Return S
//
// Uses content overlap as diversity proxy (not embeddings).
// Content overlap ratio = |intersection of character spans| / min(len(a), len(b))
// For chunks from different documents, overlap = 0 (always diverse).
// Reuses spanOverlapChars() from utils/span.ts.
```

#### Expand-Context (`type: "expand-context"`)

**File**: `packages/eval-lib/src/retrievers/pipeline/refinement/expand-context.ts`

```typescript
export interface ExpandContextRefinementStep {
  readonly type: "expand-context";
  readonly windowChars?: number; // default 500
}

export function applyExpandContext(
  results: readonly ScoredChunk[],
  corpus: Corpus,
  windowChars: number,
): ScoredChunk[];

// For each chunk:
//   Find the source document in corpus by docId
//   newStart = max(0, chunk.start - windowChars)
//   newEnd = min(doc.content.length, chunk.end + windowChars)
//   Return new PositionAwareChunk with expanded span and content
//
// Requires corpus reference (stored during init()).
```

**Pipeline change**: Store `this._corpus = corpus` during `init()`. The expand-context refinement step receives it.

```typescript
// In pipeline-retriever.ts:
private _corpus: Corpus | null = null;

async init(corpus: Corpus): Promise<void> {
  this._corpus = corpus;
  // ... rest of init
}
```

#### Config Type Update

```typescript
export type RefinementStepConfig =
  | RerankRefinementStep       // existing
  | ThresholdRefinementStep    // existing
  | DedupRefinementStep        // new
  | MmrRefinementStep          // new
  | ExpandContextRefinementStep; // new
```

#### Update _applyRefinements in pipeline-retriever.ts

```typescript
private async _applyRefinements(
  query: string,
  results: ScoredChunk[],
  k: number,
): Promise<ScoredChunk[]> {
  let current = results;

  for (const step of this._refinementSteps) {
    switch (step.type) {
      case "rerank": {
        // existing — unchanged
        const chunks = current.map(({ chunk }) => chunk);
        const reranked = await this._reranker!.rerank(query, chunks, k);
        current = assignRankScores(reranked);
        break;
      }
      case "threshold": {
        // existing — unchanged
        current = applyThresholdFilter(current, step.minScore);
        break;
      }
      case "dedup": {
        current = applyDedup(current, step.method ?? "exact", step.overlapThreshold ?? 0.5);
        break;
      }
      case "mmr": {
        current = applyMmr(current, k, step.lambda ?? 0.7);
        break;
      }
      case "expand-context": {
        if (!this._corpus) throw new Error("expand-context requires corpus");
        current = applyExpandContext(current, this._corpus, step.windowChars ?? 500);
        break;
      }
      default:
        throw new Error(`Unknown refinement step type: ${(step as any).type}`);
    }
  }

  return current;
}
```

### 5b. AsyncPositionAwareChunker Interface

**File**: `packages/eval-lib/src/chunkers/chunker.interface.ts` — add:

```typescript
/**
 * Async variant of PositionAwareChunker for chunkers that need
 * async operations (embedding, LLM calls) during chunking.
 */
export interface AsyncPositionAwareChunker {
  readonly name: string;
  chunkWithPositions(doc: Document): Promise<PositionAwareChunk[]>;
}

/** Type guard for async chunkers. */
export function isAsyncPositionAwareChunker(
  chunker: PositionAwareChunker | AsyncPositionAwareChunker,
): chunker is AsyncPositionAwareChunker {
  // Test by invoking with a minimal doc and checking if result is a Promise
  // OR: use a discriminator property
  return "async" in chunker && (chunker as any).async === true;
}
```

**Pipeline change**: In `pipeline-retriever.ts`, `init()` must handle both sync and async chunkers:

```typescript
// PipelineRetrieverDeps updated:
export interface PipelineRetrieverDeps {
  readonly chunker: PositionAwareChunker | AsyncPositionAwareChunker;  // UPDATED
  // ... rest unchanged
}

// In init():
for (const doc of corpus.documents) {
  const docChunks = isAsyncPositionAwareChunker(this._chunker)
    ? await this._chunker.chunkWithPositions(doc)
    : this._chunker.chunkWithPositions(doc);
  chunks.push(...docChunks);
}
```

### 5c. Semantic Chunker

**File**: `packages/eval-lib/src/chunkers/semantic.ts`

```typescript
export interface SemanticChunkerOptions {
  percentileThreshold?: number; // default 95 (split where similarity < 95th percentile)
  maxChunkSize?: number;        // default 2000
}

export class SemanticChunker implements AsyncPositionAwareChunker {
  readonly name: string; // "Semantic(threshold=95)"
  readonly async = true as const; // discriminator for isAsyncPositionAwareChunker

  constructor(embedder: Embedder, options?: SemanticChunkerOptions);

  async chunkWithPositions(doc: Document): Promise<PositionAwareChunk[]>;

  // Algorithm (Kamradt method):
  // 1. Split text into sentences (reuse regex from SentenceChunker)
  // 2. Embed all sentences via this.embedder.embed(sentences)
  // 3. Compute cosine similarity between consecutive sentence embeddings
  //    Uses cosineSimilarity() from utils/similarity.ts (already exists)
  // 4. Find Nth percentile of all similarities
  // 5. Place chunk boundaries where similarity < percentile threshold
  // 6. Merge sentences within boundaries into chunks
  // 7. If any chunk > maxChunkSize, sub-split with RecursiveCharacterChunker
  // 8. Track positions from sentence offsets
}
```

### 5d. Cluster Semantic Chunker

**File**: `packages/eval-lib/src/chunkers/cluster-semantic.ts`

```typescript
export interface ClusterSemanticChunkerOptions {
  maxChunkSize?: number;  // default 400
  segmentSize?: number;   // default 50 (chars per micro-segment)
}

export class ClusterSemanticChunker implements AsyncPositionAwareChunker {
  readonly name: string; // "ClusterSemantic(size=400)"
  readonly async = true as const;

  constructor(embedder: Embedder, options?: ClusterSemanticChunkerOptions);

  async chunkWithPositions(doc: Document): Promise<PositionAwareChunk[]>;

  // Algorithm (dynamic programming — Chroma's approach):
  // 1. Split text into micro-segments of ~segmentSize chars
  //    Track each segment's character offset
  // 2. Embed all segments via this.embedder.embed(segments)
  // 3. Compute pairwise cosine similarity matrix
  // 4. DP: dp[i] = max total intra-chunk similarity for segments[0..i]
  //    For each i, try all valid previous breakpoints j where
  //    sum of segment lengths in [j..i] <= maxChunkSize:
  //      similarity(j, i) = avg pairwise cosine of embeddings[j..i]
  //      dp[i] = max(dp[j-1] + similarity(j, i))
  // 5. Backtrack to find optimal chunk boundaries
  // 6. Each chunk = concatenation of adjacent segments
  //    start = first segment start, end = last segment end
  //
  // Complexity: O(n²) where n = number of segments. Acceptable for
  // typical documents (e.g., 10K chars / 50 = 200 segments).
  //
  // Reference: github.com/brandonstarxel/chunking_evaluation
}
```

### 5e. cosineSimilarity Utility

**File**: `packages/eval-lib/src/utils/similarity.ts` — **ALREADY EXISTS**, no changes needed.

The `cosineSimilarity(a, b)` function already exists in the codebase and is already re-exported from `utils/index.ts`. Used by `SemanticChunker` (5c) and `ClusterSemanticChunker` (5d).

### 5f. LLM Semantic Chunker

**File**: `packages/eval-lib/src/chunkers/llm-semantic.ts`

```typescript
export interface LLMSemanticChunkerOptions {
  segmentSize?: number;  // default 50 (chars per segment)
  batchSize?: number;    // default 800 (chars per LLM batch)
}

export class LLMSemanticChunker implements AsyncPositionAwareChunker {
  readonly name: string; // "LLMSemantic"
  readonly async = true as const;

  constructor(llm: PipelineLLM, options?: LLMSemanticChunkerOptions);

  async chunkWithPositions(doc: Document): Promise<PositionAwareChunk[]>;

  // Algorithm (based on Chroma's LLMSemanticChunker):
  // 1. Split text into ~segmentSize char segments
  //    Track each segment's character offset
  // 2. Wrap each segment: <|start_chunk_N|> ... <|end_chunk_N|>
  // 3. Group wrapped segments into batches of ~batchSize total chars
  // 4. For each batch, prompt LLM:
  //    "Identify thematic boundaries in the following tagged text.
  //     Return split points in format: split_after: X, Y"
  // 5. Validate response (ascending order, within range)
  // 6. Merge segments based on split points
  // 7. Position tracking from segment offsets
  //
  // Note: Slow and expensive. Best for small-corpus experiments.
  // Reference: github.com/brandonstarxel/chunking_evaluation
}
```

---

## Testing (Slice 5)

```typescript
describe("AsyncPositionAwareChunker type guard", () => {
  it("isAsyncPositionAwareChunker returns true for async chunker", () => {
    const chunker = { name: "test", async: true, chunkWithPositions: vi.fn() };
    expect(isAsyncPositionAwareChunker(chunker)).toBe(true);
  });

  it("isAsyncPositionAwareChunker returns false for sync chunker", () => {
    const chunker = { name: "test", chunkWithPositions: vi.fn() };
    expect(isAsyncPositionAwareChunker(chunker)).toBe(false);
  });
});
```

### New Files (Slice 5)
- `src/retrievers/pipeline/refinement/dedup.ts`
- `src/retrievers/pipeline/refinement/mmr.ts`
- `src/retrievers/pipeline/refinement/expand-context.ts`
- `src/chunkers/semantic.ts`
- `src/chunkers/cluster-semantic.ts`
- `src/chunkers/llm-semantic.ts`

### New Test Files (Slice 5)
- `tests/unit/retrievers/pipeline/refinement/dedup.test.ts`
- `tests/unit/retrievers/pipeline/refinement/mmr.test.ts`
- `tests/unit/retrievers/pipeline/refinement/expand-context.test.ts`
- `tests/unit/chunkers/semantic.test.ts`
- `tests/unit/chunkers/cluster-semantic.test.ts`
- `tests/unit/chunkers/llm-semantic.test.ts`

### Modified Files (Slice 5)
- `src/retrievers/pipeline/config.ts` — RefinementStepConfig union extension
- `src/retrievers/pipeline/pipeline-retriever.ts` — _corpus, _applyRefinements, async chunker support
- `src/chunkers/chunker.interface.ts` — AsyncPositionAwareChunker
- `src/chunkers/index.ts` — re-exports
- `src/index.ts` — root barrel
