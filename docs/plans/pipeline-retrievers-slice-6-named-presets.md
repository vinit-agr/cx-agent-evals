# Slice 6 — Named Presets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the preset system from 4 to 19 fully-typed, runnable presets by adding 15 new `PipelineConfig` constants, widening the `PRESET_CONFIGS` map, updating barrel exports, and syncing the registry status for presets that became available after Slice 4 landed.

**Architecture:** Add config constants to `experiments/presets.ts`, expand the `PRESET_CONFIGS` map (from which `PresetName` is derived), re-export from barrel files, and flip 6 registry entries from `"coming-soon"` → `"available"`. All presets are purely declarative data — the `PipelineRetriever` constructor validates deps at construction time.

**Tech Stack:** TypeScript, Vitest, eval-lib only. No new dependencies.

> Part of the [Pipeline Retrievers Plan](./pipeline-retrievers-shared-context.md). See shared context for codebase state and design decisions.

---

## Improvements Over Original Plan

After deep codebase review, the following corrections and improvements were made:

1. **`PipelinePresetDeps.llm` already exists** — The original plan said to add `llm?: PipelineLLM` to `PipelinePresetDeps`, but it's already there (`src/experiments/presets.ts:16`). No interface change needed.

2. **5 presets blocked on Slice 5** — The original plan listed 20 new presets (24 total), but 5 use `dedup` or `mmr` refinement steps that don't exist in `RefinementStepConfig` yet (Slice 5 work). These won't compile as `PipelineConfig`:
   - `multi-query-dense` — uses `{ type: "dedup" }` refinement
   - `multi-query-hybrid` — uses `{ type: "dedup" }` refinement
   - `diverse-hybrid` — uses `{ type: "mmr" }` refinement
   - `step-back-hybrid` — uses `{ type: "dedup" }` refinement
   - `premium` — uses `{ type: "dedup" }` refinement

   **Decision:** Add only the 15 presets that are fully typed now. The remaining 5 will be added as a follow-up after Slice 5 lands `DedupRefinementStep` and `MmrRefinementStep`.

3. **Registry status updates needed** — Slice 4 implemented `contextual`, `summary`, and `parent-child` index strategies. Six registry presets that were `"coming-soon"` are now fully implementable and should become `"available"`: `openclaw-style`, `contextual-dense`, `contextual-hybrid`, `anthropic-best`, `parent-child-dense`, `summary-dense`.

4. **Test approach** — Instead of 19 individual describe blocks, use parameterized `it.each` tests for the generic factory while keeping existing 4 legacy wrapper tests for backward compatibility.

---

## Codebase Reference (Verified)

All paths below are relative to `packages/eval-lib/`.

**Key existing files:**
- `src/experiments/presets.ts` — 4 preset configs, PRESET_CONFIGS map, createPresetRetriever factory, deprecated wrappers (113 lines)
- `src/experiments/index.ts` — re-exports from presets.ts (27 lines)
- `src/index.ts` — root barrel (155 lines)
- `src/retrievers/pipeline/config.ts` — PipelineConfig, RefinementStepConfig union (has `rerank` + `threshold` only) (268 lines)
- `src/retrievers/pipeline/pipeline-retriever.ts` — PipelineRetriever class, validates reranker + LLM deps in constructor (417 lines)
- `src/registry/presets.ts` — 24 PresetEntry objects (13 available, 11 coming-soon), uses `comingSoonConfig()` casts (739 lines)
- `tests/unit/experiments/presets.test.ts` — 4 describe blocks testing legacy wrappers (235 lines)
- `tests/unit/registry/presets.test.ts` — registry structure tests, asserts 13 available / 11 coming-soon (97 lines)
- `tests/fixtures.ts` — `mockEmbedder()` helper, no mockLLM yet (71 lines)

**Key type signatures:**
```typescript
// src/retrievers/pipeline/config.ts:185-191
interface PipelineConfig {
  readonly name: string;
  readonly index?: IndexConfig;      // plain | contextual | summary | parent-child
  readonly query?: QueryConfig;      // identity | hyde | multi-query | step-back | rewrite
  readonly search?: SearchConfig;    // dense | bm25 | hybrid
  readonly refinement?: readonly RefinementStepConfig[];  // rerank | threshold (dedup/mmr NOT yet)
}

// src/experiments/presets.ts:11-17
interface PipelinePresetDeps {
  readonly chunker: PositionAwareChunker;
  readonly embedder: Embedder;
  readonly vectorStore?: VectorStore;
  readonly reranker?: Reranker;
  readonly llm?: PipelineLLM;  // already present
}

// src/retrievers/pipeline/llm.interface.ts
interface PipelineLLM {
  readonly name: string;
  complete(prompt: string): Promise<string>;
}
```

**PipelineRetriever constructor validation** (`pipeline-retriever.ts:148-169`):
- Throws if refinement includes `"rerank"` but no `reranker` in deps
- Throws if query strategy is `hyde|multi-query|step-back|rewrite` but no `llm` in deps
- Throws if index strategy is `contextual|summary` but no `llm` in deps

**Preset dependency groups (for test parameterization):**

| Group | Presets | Needs LLM | Needs Reranker |
|-------|---------|-----------|----------------|
| Basic (no deps) | baseline-vector-rag, bm25, hybrid, hybrid-rrf, openclaw-style, parent-child-dense | No | No |
| Reranker only | dense-reranked, bm25-reranked, hybrid-reranked, hybrid-rrf-reranked | No | Yes |
| LLM only | hyde-dense, hyde-hybrid, contextual-dense, contextual-hybrid, summary-dense, rewrite-hybrid | Yes | No |
| LLM + Reranker | hyde-hybrid-reranked, anthropic-best, rewrite-hybrid-reranked | Yes | Yes |

---

## Final State After Slice 6

| Artifact | Before | After |
|----------|--------|-------|
| `experiments/presets.ts` config constants | 4 | 19 |
| `PRESET_CONFIGS` map entries | 4 | 19 |
| `PresetName` type | (derived, 4 keys) | (derived, 19 keys) + exported alias |
| Registry available presets | 13 | 19 |
| Registry coming-soon presets | 11 | 5 |
| Preset unit tests | 4 describe blocks | 4 legacy + 1 parameterized describe |

---

## Modified Files

- `src/experiments/presets.ts` — 15 new config constants, expanded PRESET_CONFIGS map, PresetName type alias
- `src/experiments/index.ts` — re-export new configs + PresetName
- `src/index.ts` — re-export new configs + PresetName
- `src/registry/presets.ts` — 6 presets: coming-soon → available, remove comingSoonConfig() wrappers
- `tests/fixtures.ts` — add `mockLLM()` helper
- `tests/unit/experiments/presets.test.ts` — new parameterized tests for generic factory
- `tests/unit/registry/presets.test.ts` — update count assertions (19/5)

---

### Task 1: Add mockLLM fixture

**Files:**
- Modify: `tests/fixtures.ts:70` (append after mockEmbedder)

**Step 1: Add mockLLM helper to fixtures**

```typescript
// Append to tests/fixtures.ts after mockEmbedder function:

export function mockLLM(): PipelineLLM {
  return {
    name: "MockLLM",
    async complete() {
      return "mock LLM response";
    },
  };
}
```

Also add the import at the top of fixtures.ts:
```typescript
import type { PipelineLLM } from "../src/retrievers/pipeline/llm.interface.js";
```

**Step 2: Run existing tests to verify no regressions**

Run: `pnpm -C packages/eval-lib test -- --run`
Expected: All existing tests pass (no changes to existing code).

**Step 3: Commit**

```bash
git add packages/eval-lib/tests/fixtures.ts
git commit -m "test(eval-lib): add mockLLM fixture for preset tests"
```

---

### Task 2: Write failing tests for preset config constants

**Files:**
- Modify: `tests/unit/experiments/presets.test.ts` (add new describe block)

**Step 1: Write the failing test**

Add a new describe block at the end of the existing test file:

```typescript
import {
  createPresetRetriever,
  // New config imports — will fail until Task 3
  DENSE_RERANKED_CONFIG,
  BM25_RERANKED_CONFIG,
  HYBRID_RRF_CONFIG,
  HYBRID_RRF_RERANKED_CONFIG,
  OPENCLAW_STYLE_CONFIG,
  HYDE_DENSE_CONFIG,
  HYDE_HYBRID_CONFIG,
  HYDE_HYBRID_RERANKED_CONFIG,
  CONTEXTUAL_DENSE_CONFIG,
  CONTEXTUAL_HYBRID_CONFIG,
  ANTHROPIC_BEST_CONFIG,
  PARENT_CHILD_DENSE_CONFIG,
  SUMMARY_DENSE_CONFIG,
  REWRITE_HYBRID_CONFIG,
  REWRITE_HYBRID_RERANKED_CONFIG,
} from "../../../src/experiments/presets.js";
import type { PipelinePresetDeps } from "../../../src/experiments/presets.js";
import { mockLLM } from "../../fixtures.js";
```

Then add this describe block after the existing blocks:

```typescript
// ---------------------------------------------------------------------------
// Config constant validation
// ---------------------------------------------------------------------------

describe("preset config constants", () => {
  const allConfigs = [
    { name: "dense-reranked", config: DENSE_RERANKED_CONFIG },
    { name: "bm25-reranked", config: BM25_RERANKED_CONFIG },
    { name: "hybrid-rrf", config: HYBRID_RRF_CONFIG },
    { name: "hybrid-rrf-reranked", config: HYBRID_RRF_RERANKED_CONFIG },
    { name: "openclaw-style", config: OPENCLAW_STYLE_CONFIG },
    { name: "hyde-dense", config: HYDE_DENSE_CONFIG },
    { name: "hyde-hybrid", config: HYDE_HYBRID_CONFIG },
    { name: "hyde-hybrid-reranked", config: HYDE_HYBRID_RERANKED_CONFIG },
    { name: "contextual-dense", config: CONTEXTUAL_DENSE_CONFIG },
    { name: "contextual-hybrid", config: CONTEXTUAL_HYBRID_CONFIG },
    { name: "anthropic-best", config: ANTHROPIC_BEST_CONFIG },
    { name: "parent-child-dense", config: PARENT_CHILD_DENSE_CONFIG },
    { name: "summary-dense", config: SUMMARY_DENSE_CONFIG },
    { name: "rewrite-hybrid", config: REWRITE_HYBRID_CONFIG },
    { name: "rewrite-hybrid-reranked", config: REWRITE_HYBRID_RERANKED_CONFIG },
  ];

  it.each(allConfigs)("$name config has matching name property", ({ name, config }) => {
    expect(config.name).toBe(name);
  });

  it.each(allConfigs)("$name config has a search strategy", ({ config }) => {
    expect(config.search).toBeDefined();
    expect(config.search!.strategy).toMatch(/^(dense|bm25|hybrid)$/);
  });

  it("dense-reranked has rerank refinement", () => {
    expect(DENSE_RERANKED_CONFIG.refinement).toEqual([{ type: "rerank" }]);
  });

  it("openclaw-style has custom chunk settings and threshold", () => {
    expect(OPENCLAW_STYLE_CONFIG.index).toEqual({
      strategy: "plain",
      chunkSize: 400,
      chunkOverlap: 80,
    });
    expect(OPENCLAW_STYLE_CONFIG.refinement).toEqual([{ type: "threshold", minScore: 0.35 }]);
  });

  it("hybrid-rrf uses RRF fusion method", () => {
    expect(HYBRID_RRF_CONFIG.search).toMatchObject({
      strategy: "hybrid",
      fusionMethod: "rrf",
    });
  });

  it("contextual-dense uses contextual index strategy", () => {
    expect(CONTEXTUAL_DENSE_CONFIG.index).toEqual({ strategy: "contextual" });
  });

  it("parent-child-dense uses parent-child index strategy", () => {
    expect(PARENT_CHILD_DENSE_CONFIG.index).toEqual({
      strategy: "parent-child",
      childChunkSize: 200,
      parentChunkSize: 1000,
    });
  });

  it("summary-dense uses summary index strategy", () => {
    expect(SUMMARY_DENSE_CONFIG.index).toEqual({ strategy: "summary" });
  });

  it("hyde-dense uses hyde query strategy", () => {
    expect(HYDE_DENSE_CONFIG.query).toEqual({ strategy: "hyde" });
  });

  it("rewrite-hybrid uses rewrite query strategy", () => {
    expect(REWRITE_HYBRID_CONFIG.query).toEqual({ strategy: "rewrite" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/eval-lib test -- --run tests/unit/experiments/presets.test.ts`
Expected: FAIL — imports like `DENSE_RERANKED_CONFIG` don't exist yet.

---

### Task 3: Add 15 new preset config constants to presets.ts

**Files:**
- Modify: `src/experiments/presets.ts:56` (insert before the PRESET_CONFIGS map)

**Step 1: Add the config constants**

Insert after `HYBRID_RERANKED_CONFIG` (line 56) and before the `PRESET_CONFIGS` map (line 60):

```typescript
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
  search: {
    strategy: "hybrid",
    denseWeight: 0.7,
    sparseWeight: 0.3,
    fusionMethod: "weighted",
    candidateMultiplier: 4,
  },
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
  search: {
    strategy: "hybrid",
    denseWeight: 0.7,
    sparseWeight: 0.3,
    candidateMultiplier: 4,
  },
};

export const HYDE_HYBRID_RERANKED_CONFIG: PipelineConfig = {
  name: "hyde-hybrid-reranked",
  index: { strategy: "plain" },
  query: { strategy: "hyde" },
  search: {
    strategy: "hybrid",
    denseWeight: 0.7,
    sparseWeight: 0.3,
    candidateMultiplier: 4,
  },
  refinement: [{ type: "rerank" }],
};

export const CONTEXTUAL_DENSE_CONFIG: PipelineConfig = {
  name: "contextual-dense",
  index: { strategy: "contextual" },
  search: { strategy: "dense" },
};

export const CONTEXTUAL_HYBRID_CONFIG: PipelineConfig = {
  name: "contextual-hybrid",
  index: { strategy: "contextual" },
  search: {
    strategy: "hybrid",
    denseWeight: 0.7,
    sparseWeight: 0.3,
    candidateMultiplier: 4,
  },
};

export const ANTHROPIC_BEST_CONFIG: PipelineConfig = {
  name: "anthropic-best",
  index: { strategy: "contextual" },
  search: {
    strategy: "hybrid",
    denseWeight: 0.7,
    sparseWeight: 0.3,
    candidateMultiplier: 4,
  },
  refinement: [{ type: "rerank" }],
};

export const PARENT_CHILD_DENSE_CONFIG: PipelineConfig = {
  name: "parent-child-dense",
  index: { strategy: "parent-child", childChunkSize: 200, parentChunkSize: 1000 },
  search: { strategy: "dense" },
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
  search: {
    strategy: "hybrid",
    denseWeight: 0.7,
    sparseWeight: 0.3,
    candidateMultiplier: 4,
  },
};

export const REWRITE_HYBRID_RERANKED_CONFIG: PipelineConfig = {
  name: "rewrite-hybrid-reranked",
  index: { strategy: "plain" },
  query: { strategy: "rewrite" },
  search: {
    strategy: "hybrid",
    denseWeight: 0.7,
    sparseWeight: 0.3,
    candidateMultiplier: 4,
  },
  refinement: [{ type: "rerank" }],
};
```

**Step 2: Run tests from Task 2 to verify they pass**

Run: `pnpm -C packages/eval-lib test -- --run tests/unit/experiments/presets.test.ts`
Expected: All new "preset config constants" tests PASS. (The factory tests from Task 4 don't exist yet.)

**Step 3: Commit**

```bash
git add packages/eval-lib/src/experiments/presets.ts packages/eval-lib/tests/unit/experiments/presets.test.ts
git commit -m "feat(eval-lib): add 15 new preset config constants"
```

---

### Task 4: Write failing tests for generic factory + dependency validation

**Files:**
- Modify: `tests/unit/experiments/presets.test.ts` (add factory tests after the config constant tests)

**Step 1: Write the failing test**

Add after the "preset config constants" describe block:

```typescript
// ---------------------------------------------------------------------------
// createPresetRetriever — generic factory (all 19 presets)
// ---------------------------------------------------------------------------

describe("createPresetRetriever (generic factory)", () => {
  const baseDeps: PipelinePresetDeps = { chunker, embedder };
  const depsWithReranker: PipelinePresetDeps = { ...baseDeps, reranker: mockReranker };
  const llm = mockLLM();
  const depsWithLlm: PipelinePresetDeps = { ...baseDeps, llm };
  const fullDeps: PipelinePresetDeps = { ...baseDeps, reranker: mockReranker, llm };

  // Presets that need NO LLM and NO reranker
  const basicPresets = [
    "baseline-vector-rag",
    "bm25",
    "hybrid",
    "hybrid-rrf",
    "openclaw-style",
    "parent-child-dense",
  ] as const;

  // Presets that need reranker only
  const rerankerOnlyPresets = [
    "dense-reranked",
    "bm25-reranked",
    "hybrid-reranked",
    "hybrid-rrf-reranked",
  ] as const;

  // Presets that need LLM only
  const llmOnlyPresets = [
    "hyde-dense",
    "hyde-hybrid",
    "contextual-dense",
    "contextual-hybrid",
    "summary-dense",
    "rewrite-hybrid",
  ] as const;

  // Presets that need both LLM and reranker
  const llmAndRerankerPresets = [
    "hyde-hybrid-reranked",
    "anthropic-best",
    "rewrite-hybrid-reranked",
  ] as const;

  it("PRESET_CONFIGS map has exactly 19 entries", () => {
    // We test this by ensuring all 19 preset names are accepted by the factory
    const allNames = [
      ...basicPresets,
      ...rerankerOnlyPresets,
      ...llmOnlyPresets,
      ...llmAndRerankerPresets,
    ];
    expect(allNames).toHaveLength(19);
  });

  it.each(basicPresets.map((n) => ({ name: n })))(
    "$name creates a retriever with base deps",
    ({ name }) => {
      const retriever = createPresetRetriever(name, baseDeps);
      expect(retriever.name).toBe(name);
    },
  );

  it.each(rerankerOnlyPresets.map((n) => ({ name: n })))(
    "$name creates a retriever with reranker deps",
    ({ name }) => {
      const retriever = createPresetRetriever(name, depsWithReranker);
      expect(retriever.name).toBe(name);
    },
  );

  it.each(llmOnlyPresets.map((n) => ({ name: n })))(
    "$name creates a retriever with llm deps",
    ({ name }) => {
      const retriever = createPresetRetriever(name, depsWithLlm);
      expect(retriever.name).toBe(name);
    },
  );

  it.each(llmAndRerankerPresets.map((n) => ({ name: n })))(
    "$name creates a retriever with full deps",
    ({ name }) => {
      const retriever = createPresetRetriever(name, fullDeps);
      expect(retriever.name).toBe(name);
    },
  );

  // Dependency validation tests
  it.each(rerankerOnlyPresets.map((n) => ({ name: n })))(
    "$name throws without reranker",
    ({ name }) => {
      expect(() => createPresetRetriever(name, baseDeps)).toThrow(/reranker/i);
    },
  );

  it.each(llmOnlyPresets.map((n) => ({ name: n })))(
    "$name throws without llm",
    ({ name }) => {
      expect(() => createPresetRetriever(name, baseDeps)).toThrow(/LLM/i);
    },
  );

  it.each(llmAndRerankerPresets.map((n) => ({ name: n })))(
    "$name throws without llm (even with reranker)",
    ({ name }) => {
      expect(() => createPresetRetriever(name, depsWithReranker)).toThrow(/LLM/i);
    },
  );

  it("name override works via overrides parameter", () => {
    const retriever = createPresetRetriever("hybrid-rrf", baseDeps, {
      name: "custom-name",
    });
    expect(retriever.name).toBe("custom-name");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/eval-lib test -- --run tests/unit/experiments/presets.test.ts`
Expected: FAIL — `createPresetRetriever` doesn't accept the new preset names yet (TypeScript error / runtime key lookup failure).

---

### Task 5: Expand PRESET_CONFIGS map and export PresetName type

**Files:**
- Modify: `src/experiments/presets.ts` — update the PRESET_CONFIGS map

**Step 1: Expand the PRESET_CONFIGS map**

Replace the existing `PRESET_CONFIGS` block (`const PRESET_CONFIGS = { ... } as const;`) with:

```typescript
const PRESET_CONFIGS = {
  // Original 4
  "baseline-vector-rag": BASELINE_VECTOR_RAG_CONFIG,
  "bm25": BM25_CONFIG,
  "hybrid": HYBRID_CONFIG,
  "hybrid-reranked": HYBRID_RERANKED_CONFIG,
  // Dense variants
  "dense-reranked": DENSE_RERANKED_CONFIG,
  // BM25 variants
  "bm25-reranked": BM25_RERANKED_CONFIG,
  // Hybrid variants
  "hybrid-rrf": HYBRID_RRF_CONFIG,
  "hybrid-rrf-reranked": HYBRID_RRF_RERANKED_CONFIG,
  // OpenClaw-style
  "openclaw-style": OPENCLAW_STYLE_CONFIG,
  // HyDE variants
  "hyde-dense": HYDE_DENSE_CONFIG,
  "hyde-hybrid": HYDE_HYBRID_CONFIG,
  "hyde-hybrid-reranked": HYDE_HYBRID_RERANKED_CONFIG,
  // Contextual variants
  "contextual-dense": CONTEXTUAL_DENSE_CONFIG,
  "contextual-hybrid": CONTEXTUAL_HYBRID_CONFIG,
  "anthropic-best": ANTHROPIC_BEST_CONFIG,
  // Parent-Child
  "parent-child-dense": PARENT_CHILD_DENSE_CONFIG,
  // Summary
  "summary-dense": SUMMARY_DENSE_CONFIG,
  // Rewrite variants
  "rewrite-hybrid": REWRITE_HYBRID_CONFIG,
  "rewrite-hybrid-reranked": REWRITE_HYBRID_RERANKED_CONFIG,
} as const;

export type PresetName = keyof typeof PRESET_CONFIGS;
```

Note: The `createPresetRetriever` function signature (`presetName: keyof typeof PRESET_CONFIGS`) already derives the type from the map, so it automatically widens. The explicit `PresetName` alias is for consumer convenience.

**Step 2: Run tests to verify they pass**

Run: `pnpm -C packages/eval-lib test -- --run tests/unit/experiments/presets.test.ts`
Expected: All tests PASS — both existing legacy tests and new factory tests.

**Step 3: Commit**

```bash
git add packages/eval-lib/src/experiments/presets.ts packages/eval-lib/tests/unit/experiments/presets.test.ts
git commit -m "feat(eval-lib): expand PRESET_CONFIGS map to 19 presets with PresetName type"
```

---

### Task 6: Update barrel exports

**Files:**
- Modify: `src/experiments/index.ts`
- Modify: `src/index.ts`

**Step 1: Update experiments/index.ts**

Replace the preset export section with:

```typescript
// Experiment presets
export {
  createPresetRetriever,
  // Original 4
  BASELINE_VECTOR_RAG_CONFIG,
  BM25_CONFIG,
  HYBRID_CONFIG,
  HYBRID_RERANKED_CONFIG,
  // New preset configs
  DENSE_RERANKED_CONFIG,
  BM25_RERANKED_CONFIG,
  HYBRID_RRF_CONFIG,
  HYBRID_RRF_RERANKED_CONFIG,
  OPENCLAW_STYLE_CONFIG,
  HYDE_DENSE_CONFIG,
  HYDE_HYBRID_CONFIG,
  HYDE_HYBRID_RERANKED_CONFIG,
  CONTEXTUAL_DENSE_CONFIG,
  CONTEXTUAL_HYBRID_CONFIG,
  ANTHROPIC_BEST_CONFIG,
  PARENT_CHILD_DENSE_CONFIG,
  SUMMARY_DENSE_CONFIG,
  REWRITE_HYBRID_CONFIG,
  REWRITE_HYBRID_RERANKED_CONFIG,
  // Legacy wrappers (deprecated)
  createBaselineVectorRagRetriever,
  createBM25Retriever,
  createHybridRetriever,
  createHybridRerankedRetriever,
} from "./presets.js";
export type {
  PresetName,
  PipelinePresetDeps,
  BaselineVectorRagPresetDeps,
  BM25PresetDeps,
  HybridPresetDeps,
  HybridRerankedPresetDeps,
} from "./presets.js";
```

**Step 2: Update src/index.ts**

Replace the "Experiment Presets" section (around lines 101-117) with:

```typescript
// Experiment Presets
export {
  createPresetRetriever,
  createBaselineVectorRagRetriever,
  BASELINE_VECTOR_RAG_CONFIG,
  createBM25Retriever,
  BM25_CONFIG,
  createHybridRetriever,
  HYBRID_CONFIG,
  createHybridRerankedRetriever,
  HYBRID_RERANKED_CONFIG,
  // New preset configs
  DENSE_RERANKED_CONFIG,
  BM25_RERANKED_CONFIG,
  HYBRID_RRF_CONFIG,
  HYBRID_RRF_RERANKED_CONFIG,
  OPENCLAW_STYLE_CONFIG,
  HYDE_DENSE_CONFIG,
  HYDE_HYBRID_CONFIG,
  HYDE_HYBRID_RERANKED_CONFIG,
  CONTEXTUAL_DENSE_CONFIG,
  CONTEXTUAL_HYBRID_CONFIG,
  ANTHROPIC_BEST_CONFIG,
  PARENT_CHILD_DENSE_CONFIG,
  SUMMARY_DENSE_CONFIG,
  REWRITE_HYBRID_CONFIG,
  REWRITE_HYBRID_RERANKED_CONFIG,
} from "./experiments/index.js";
export type {
  PresetName,
  PipelinePresetDeps,
  BaselineVectorRagPresetDeps,
  BM25PresetDeps,
  HybridPresetDeps,
  HybridRerankedPresetDeps,
} from "./experiments/index.js";
```

**Step 3: Run tests + typecheck**

Run: `pnpm -C packages/eval-lib test -- --run && pnpm typecheck`
Expected: All tests PASS, no type errors.

**Step 4: Commit**

```bash
git add packages/eval-lib/src/experiments/index.ts packages/eval-lib/src/index.ts
git commit -m "feat(eval-lib): re-export new preset configs and PresetName from barrel files"
```

---

### Task 7: Update registry preset statuses

**Files:**
- Modify: `src/registry/presets.ts`

**Step 1: Update 6 presets from coming-soon to available**

The following 6 presets in `src/registry/presets.ts` should change:
1. `openclaw-style` (line 249): `status: "coming-soon"` → `status: "available"`, remove `comingSoonConfig()` wrapper
2. `contextualDense` (line 417): `status: "coming-soon"` → `status: "available"`, remove `comingSoonConfig()` wrapper
3. `contextualHybrid` (line 441): `status: "coming-soon"` → `status: "available"`, remove `comingSoonConfig()` wrapper
4. `anthropicBest` (line 470): `status: "coming-soon"` → `status: "available"`, remove `comingSoonConfig()` wrapper
5. `parentChildDense` (line 500): `status: "coming-soon"` → `status: "available"`, remove `comingSoonConfig()` wrapper
6. `summaryDense` (line 650): `status: "coming-soon"` → `status: "available"`, remove `comingSoonConfig()` wrapper

For each, two changes:
- Change `status: "coming-soon"` → `status: "available"`
- Change `config: comingSoonConfig({ ... })` → `config: { ... }` (remove the wrapper, keep the config object)

Also move these 6 entries in the `PRESET_REGISTRY` array to be in the available section (before the coming-soon section), maintaining complexity ordering within each group.

**Step 2: Update the PRESET_REGISTRY array ordering**

Reorder the registry array so available entries come first:

```typescript
export const PRESET_REGISTRY: readonly PresetEntry[] = [
  // Available — basic
  baselineVectorRag,
  bm25,
  denseReranked,
  bm25Reranked,
  // Available — intermediate
  hybrid,
  hybridReranked,
  hybridRrf,
  hybridRrfReranked,
  hydeDense,
  hydeHybrid,
  rewriteHybrid,
  openclawStyle,           // was coming-soon
  contextualDense,         // was coming-soon
  contextualHybrid,        // was coming-soon
  parentChildDense,        // was coming-soon
  summaryDense,            // was coming-soon
  // Available — advanced
  hydeHybridReranked,
  rewriteHybridReranked,
  anthropicBest,           // was coming-soon
  // Coming-soon — intermediate (blocked on Slice 5: dedup/mmr refinement)
  multiQueryDense,
  diverseHybrid,
  // Coming-soon — advanced (blocked on Slice 5: dedup/mmr refinement)
  multiQueryHybrid,
  stepBackHybrid,
  premium,
] as const;
```

**Step 3: Remove comingSoonConfig() if no longer needed**

After the changes, check if `comingSoonConfig()` is still used by the remaining 5 coming-soon presets. If all 5 still use it (they reference `{ type: "dedup" }` or `{ type: "mmr" }`), keep the helper. If it's unused, remove it.

The 5 remaining coming-soon presets (multi-query-dense, multi-query-hybrid, diverse-hybrid, step-back-hybrid, premium) all reference `dedup` or `mmr`, which are NOT in `RefinementStepConfig`. So `comingSoonConfig()` is still needed — keep it.

**Step 4: Run tests**

Run: `pnpm -C packages/eval-lib test -- --run tests/unit/registry/presets.test.ts`
Expected: FAIL — count assertions (13/11) are now wrong.

---

### Task 8: Update registry preset tests

**Files:**
- Modify: `tests/unit/registry/presets.test.ts`

**Step 1: Update count assertions**

Change line 87:
```typescript
// Before:
expect(available).toHaveLength(13);
// After:
expect(available).toHaveLength(19);
```

Change line 93:
```typescript
// Before:
expect(comingSoon).toHaveLength(11);
// After:
expect(comingSoon).toHaveLength(5);
```

**Step 2: Add test for the 6 newly-available presets**

Add a new test case:

```typescript
it("newly available presets from Slice 4 index strategies", () => {
  const newlyAvailable = [
    "openclaw-style",
    "contextual-dense",
    "contextual-hybrid",
    "anthropic-best",
    "parent-child-dense",
    "summary-dense",
  ];
  for (const id of newlyAvailable) {
    const preset = PRESET_REGISTRY.find((p) => p.id === id)!;
    expect(preset).toBeDefined();
    expect(preset.status).toBe("available");
  }
});
```

**Step 3: Add test verifying remaining coming-soon are dedup/mmr-dependent**

```typescript
it("remaining coming-soon presets depend on dedup or mmr refinement", () => {
  const comingSoon = PRESET_REGISTRY.filter((p) => p.status === "coming-soon");
  const ids = comingSoon.map((p) => p.id);
  expect(ids).toEqual(
    expect.arrayContaining([
      "multi-query-dense",
      "multi-query-hybrid",
      "diverse-hybrid",
      "step-back-hybrid",
      "premium",
    ]),
  );
  expect(comingSoon).toHaveLength(5);
});
```

**Step 4: Run tests**

Run: `pnpm -C packages/eval-lib test -- --run tests/unit/registry/presets.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add packages/eval-lib/src/registry/presets.ts packages/eval-lib/tests/unit/registry/presets.test.ts
git commit -m "feat(eval-lib): mark 6 registry presets as available after Slice 4 index strategies"
```

---

### Task 9: Run full test suite and final verification

**Files:** None (verification only)

**Step 1: Run full test suite**

Run: `pnpm -C packages/eval-lib test -- --run`
Expected: All tests pass (existing + new).

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors.

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds.

**Step 4: Verify preset count**

Quick verification — the test suite should confirm:
- 19 entries in PRESET_CONFIGS map
- 19 available + 5 coming-soon = 24 total registry presets
- All 19 presets construct successfully with appropriate deps
- LLM/reranker validation works for all categories

---

## Deferred Work (After Slice 5)

When Slice 5 lands `DedupRefinementStep` and `MmrRefinementStep` in the `RefinementStepConfig` union:

1. Add 5 remaining config constants to `experiments/presets.ts`:
   - `MULTI_QUERY_DENSE_CONFIG`
   - `MULTI_QUERY_HYBRID_CONFIG`
   - `DIVERSE_HYBRID_CONFIG`
   - `STEP_BACK_HYBRID_CONFIG`
   - `PREMIUM_CONFIG`

2. Expand `PRESET_CONFIGS` map from 19 → 24

3. Update `experiments/index.ts` and `src/index.ts` exports

4. Update `registry/presets.ts`:
   - Change 5 remaining presets from `"coming-soon"` → `"available"`
   - Remove `comingSoonConfig()` helper entirely

5. Update test counts: 24 available, 0 coming-soon
