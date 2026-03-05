# Slice 6 — Named Presets

> Part of the [Pipeline Retrievers Plan](./pipeline-retrievers-shared-context.md). See shared context for codebase state and design decisions.

**File**: `packages/eval-lib/src/experiments/presets.ts` — extend the existing pattern.

The current file has individual config constants + a `PRESET_CONFIGS` map + `createPresetRetriever` factory. We extend this by:

1. Adding new config constants
2. Adding them to the `PRESET_CONFIGS` map
3. Widening the factory's `presetName` union type

```typescript
// === EXISTING (keep exactly as-is) ===

export const BASELINE_VECTOR_RAG_CONFIG: PipelineConfig = {
  name: "baseline-vector-rag",
  index: { strategy: "plain" },
  search: { strategy: "dense" },
};

export const BM25_CONFIG: PipelineConfig = { ... };
export const HYBRID_CONFIG: PipelineConfig = { ... };
export const HYBRID_RERANKED_CONFIG: PipelineConfig = { ... };

// === NEW PRESET CONFIGS ===

export const DENSE_RERANKED_CONFIG: PipelineConfig = {
  name: "dense-reranked",
  index: { strategy: "plain" },
  search: { strategy: "dense" },
  refinement: [{ type: "rerank" }],
};

export const BM25_RERANKED_CONFIG: PipelineConfig = {
  name: "bm25-reranked",
  index: { strategy: "plain" },
  search: { strategy: "bm25" },
  refinement: [{ type: "rerank" }],
};

export const HYBRID_RRF_CONFIG: PipelineConfig = {
  name: "hybrid-rrf",
  index: { strategy: "plain" },
  search: { strategy: "hybrid", fusionMethod: "rrf", candidateMultiplier: 4 },
};

export const HYBRID_RRF_RERANKED_CONFIG: PipelineConfig = {
  name: "hybrid-rrf-reranked",
  index: { strategy: "plain" },
  search: { strategy: "hybrid", fusionMethod: "rrf", candidateMultiplier: 4 },
  refinement: [{ type: "rerank" }],
};

export const OPENCLAW_STYLE_CONFIG: PipelineConfig = {
  name: "openclaw-style",
  index: { strategy: "plain", chunkSize: 400, chunkOverlap: 80 },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, fusionMethod: "weighted", candidateMultiplier: 4 },
  refinement: [{ type: "threshold", minScore: 0.35 }],
};

export const HYDE_DENSE_CONFIG: PipelineConfig = {
  name: "hyde-dense",
  index: { strategy: "plain" },
  query: { strategy: "hyde" },
  search: { strategy: "dense" },
};

export const HYDE_HYBRID_CONFIG: PipelineConfig = {
  name: "hyde-hybrid",
  index: { strategy: "plain" },
  query: { strategy: "hyde" },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
};

export const HYDE_HYBRID_RERANKED_CONFIG: PipelineConfig = {
  name: "hyde-hybrid-reranked",
  index: { strategy: "plain" },
  query: { strategy: "hyde" },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
  refinement: [{ type: "rerank" }],
};

export const MULTI_QUERY_DENSE_CONFIG: PipelineConfig = {
  name: "multi-query-dense",
  index: { strategy: "plain" },
  query: { strategy: "multi-query", numQueries: 3 },
  search: { strategy: "dense" },
  refinement: [{ type: "dedup" }],
};

export const MULTI_QUERY_HYBRID_CONFIG: PipelineConfig = {
  name: "multi-query-hybrid",
  index: { strategy: "plain" },
  query: { strategy: "multi-query", numQueries: 3 },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
  refinement: [{ type: "dedup" }, { type: "rerank" }],
};

export const CONTEXTUAL_DENSE_CONFIG: PipelineConfig = {
  name: "contextual-dense",
  index: { strategy: "contextual" },
  search: { strategy: "dense" },
};

export const CONTEXTUAL_HYBRID_CONFIG: PipelineConfig = {
  name: "contextual-hybrid",
  index: { strategy: "contextual" },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
};

export const ANTHROPIC_BEST_CONFIG: PipelineConfig = {
  name: "anthropic-best",
  index: { strategy: "contextual" },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
  refinement: [{ type: "rerank" }],
};

export const PARENT_CHILD_DENSE_CONFIG: PipelineConfig = {
  name: "parent-child-dense",
  index: { strategy: "parent-child", childChunkSize: 200, parentChunkSize: 1000 },
  search: { strategy: "dense" },
};

export const DIVERSE_HYBRID_CONFIG: PipelineConfig = {
  name: "diverse-hybrid",
  index: { strategy: "plain" },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
  refinement: [{ type: "mmr", lambda: 0.5 }],
};

export const STEP_BACK_HYBRID_CONFIG: PipelineConfig = {
  name: "step-back-hybrid",
  index: { strategy: "plain" },
  query: { strategy: "step-back", includeOriginal: true },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
  refinement: [{ type: "dedup" }, { type: "rerank" }],
};

export const PREMIUM_CONFIG: PipelineConfig = {
  name: "premium",
  index: { strategy: "contextual" },
  query: { strategy: "multi-query", numQueries: 3 },
  search: { strategy: "hybrid", candidateMultiplier: 5 },
  refinement: [{ type: "dedup" }, { type: "rerank" }, { type: "threshold", minScore: 0.3 }],
};

export const SUMMARY_DENSE_CONFIG: PipelineConfig = {
  name: "summary-dense",
  index: { strategy: "summary" },
  search: { strategy: "dense" },
};

export const REWRITE_HYBRID_CONFIG: PipelineConfig = {
  name: "rewrite-hybrid",
  index: { strategy: "plain" },
  query: { strategy: "rewrite" },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
};

export const REWRITE_HYBRID_RERANKED_CONFIG: PipelineConfig = {
  name: "rewrite-hybrid-reranked",
  index: { strategy: "plain" },
  query: { strategy: "rewrite" },
  search: { strategy: "hybrid", denseWeight: 0.7, sparseWeight: 0.3, candidateMultiplier: 4 },
  refinement: [{ type: "rerank" }],
};

// === UPDATED PRESET MAP ===

const PRESET_CONFIGS = {
  // Existing
  "baseline-vector-rag": BASELINE_VECTOR_RAG_CONFIG,
  "bm25": BM25_CONFIG,
  "hybrid": HYBRID_CONFIG,
  "hybrid-reranked": HYBRID_RERANKED_CONFIG,
  // New — Dense variants
  "dense-reranked": DENSE_RERANKED_CONFIG,
  // New — BM25 variants
  "bm25-reranked": BM25_RERANKED_CONFIG,
  // New — Hybrid variants
  "hybrid-rrf": HYBRID_RRF_CONFIG,
  "hybrid-rrf-reranked": HYBRID_RRF_RERANKED_CONFIG,
  // New — OpenClaw-style
  "openclaw-style": OPENCLAW_STYLE_CONFIG,
  // New — HyDE variants
  "hyde-dense": HYDE_DENSE_CONFIG,
  "hyde-hybrid": HYDE_HYBRID_CONFIG,
  "hyde-hybrid-reranked": HYDE_HYBRID_RERANKED_CONFIG,
  // New — Multi-Query variants
  "multi-query-dense": MULTI_QUERY_DENSE_CONFIG,
  "multi-query-hybrid": MULTI_QUERY_HYBRID_CONFIG,
  // New — Contextual variants (Anthropic's approach)
  "contextual-dense": CONTEXTUAL_DENSE_CONFIG,
  "contextual-hybrid": CONTEXTUAL_HYBRID_CONFIG,
  "anthropic-best": ANTHROPIC_BEST_CONFIG,
  // New — Parent-Child
  "parent-child-dense": PARENT_CHILD_DENSE_CONFIG,
  // New — Diversity-focused
  "diverse-hybrid": DIVERSE_HYBRID_CONFIG,
  // New — Step-Back
  "step-back-hybrid": STEP_BACK_HYBRID_CONFIG,
  // New — Rewrite variants
  "rewrite-hybrid": REWRITE_HYBRID_CONFIG,
  "rewrite-hybrid-reranked": REWRITE_HYBRID_RERANKED_CONFIG,
  // New — Summary index
  "summary-dense": SUMMARY_DENSE_CONFIG,
  // New — Premium (everything)
  "premium": PREMIUM_CONFIG,
} as const;

export type PresetName = keyof typeof PRESET_CONFIGS;

// createPresetRetriever signature UPDATED to accept wider union:
export function createPresetRetriever(
  presetName: PresetName,
  deps: PipelinePresetDeps,
  overrides?: Partial<PipelineConfig>,
): PipelineRetriever;
```

**Note on PipelinePresetDeps**: Presets that require LLM (hyde-*, multi-query-*, step-back-*, contextual-*, anthropic-best, premium) need the caller to also provide `llm` in deps. The `PipelinePresetDeps` interface should be extended:

```typescript
export interface PipelinePresetDeps {
  readonly chunker: PositionAwareChunker;
  readonly embedder: Embedder;
  readonly vectorStore?: VectorStore;
  readonly reranker?: Reranker;
  readonly llm?: PipelineLLM;  // NEW — required for LLM-based strategies
}
```

The constructor validation in `PipelineRetriever` catches the missing `llm` case.

---

## Testing (Slice 6)

Extend existing preset tests to verify:
- All 24 preset names are valid keys
- Each preset creates a valid PipelineRetriever
- LLM-requiring presets throw without llm dep
- Overrides work correctly

### Modified Files (Slice 6)
- `src/experiments/presets.ts` — new configs, expanded map, PipelinePresetDeps.llm
- `src/experiments/index.ts` — re-exports
- `src/index.ts` — root barrel

### New/Modified Test Files (Slice 6)
- `tests/unit/experiments/presets.test.ts` — extend existing
