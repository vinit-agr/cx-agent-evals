# Pipeline Config Registry + Guided Wizard — Design

## Problem

The RAG evaluation system's retriever configuration is growing across 6 slices — from 4 presets and ~10 form fields to 24 presets, 4 embedder providers, 3 reranker providers, 7 chunker types, 4 index strategies, 5 query strategies, 3 search strategies, and 5 refinement step types. The current UI is a scrollable form modal with raw inputs and no guidance. Two problems need solving:

1. **No single source of truth.** Provider/model/option metadata is scattered — frontend duplicates eval-lib types, presets are defined in both packages, and there's no structured way to describe "what models does Cohere offer?" or "what does HyDE do?"

2. **Poor configuration UX.** The form will grow 3x as slices land. Users get no descriptions, no tooltips, no recommendations. Configuring a retriever feels like filling out a tax form.

## Goals

- One place to add new providers/models/strategies — eval-lib registry
- Frontend automatically picks up new options without code changes
- Guided wizard that makes complex configuration approachable
- Presets as first-class citizens (most users should start from a preset)
- Contextual help without cluttering the UI

## Non-Goals

- Runtime config storage in Convex (stays as raw JSON blob in `retrieverConfig: v.any()`)
- Changing the backend create/index/retrieve flow
- Automated experiment grid generation (separate feature)

---

## Part 1: Config Registry (eval-lib)

### Location

```
packages/eval-lib/src/registry/
  index.ts              # barrel export
  types.ts              # shared registry types
  embedders.ts          # embedder providers + models
  rerankers.ts          # reranker providers + models
  chunkers.ts           # chunker types + options
  index-strategies.ts   # index stage strategies
  query-strategies.ts   # query stage strategies
  search-strategies.ts  # search stage strategies
  refinement-steps.ts   # refinement step types
  presets.ts            # 24 named presets with metadata
```

### Core Types

```typescript
/** A configurable option exposed in the UI */
interface OptionDef {
  key: string;                   // field name, e.g., "model"
  label: string;                 // display label, e.g., "Model"
  description: string;           // 1-2 sentence explanation
  type: "select" | "number" | "boolean" | "string";
  choices?: Choice[];            // for type: "select"
  default: unknown;              // default value
  constraints?: {                // for type: "number"
    min?: number;
    max?: number;
    step?: number;
  };
  advanced?: boolean;            // true = hidden in collapsible "Advanced" section
  requiredWhen?: string;         // conditional visibility, e.g., "strategy=contextual"
}

interface Choice {
  value: string;
  label: string;
  description?: string;          // shown below the option when selected
}

/** A registry entry for a provider, strategy, or component */
interface RegistryEntry {
  id: string;                    // machine key, e.g., "cohere"
  name: string;                  // display name, e.g., "Cohere"
  description: string;           // 1-2 sentence explanation
  tags?: string[];               // filterable tags, e.g., ["multilingual", "fast"]
  options: OptionDef[];          // configurable fields for this entry
  defaults: Record<string, unknown>;  // default values for all options
}

/** A named preset with full config + UI metadata */
interface PresetEntry {
  id: string;                    // e.g., "hybrid-reranked"
  name: string;                  // display name
  description: string;           // what this preset is good for
  complexity: "basic" | "intermediate" | "advanced";
  tags?: string[];               // e.g., ["recommended", "fast", "high-recall"]
  requiresLLM: boolean;
  requiresReranker: boolean;
  config: PipelineConfig;        // the actual config object
  stages: {                      // human-readable summary per stage
    index: string;               // e.g., "Plain (1000 chars, 200 overlap)"
    query: string;               // e.g., "Identity (passthrough)"
    search: string;              // e.g., "Hybrid (0.7 dense / 0.3 sparse, weighted)"
    refinement: string;          // e.g., "Rerank (Cohere)" or "None"
  };
}
```

### Registry Structure

Each file exports a typed array of `RegistryEntry` objects:

```typescript
// embedders.ts
export const EMBEDDER_REGISTRY: RegistryEntry[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Industry-standard embeddings with excellent English performance",
    options: [
      {
        key: "model",
        label: "Model",
        description: "OpenAI embedding model. text-embedding-3-small is fast and cost-effective; 3-large offers higher quality.",
        type: "select",
        choices: [
          { value: "text-embedding-3-small", label: "text-embedding-3-small", description: "1536 dims, fast, cost-effective" },
          { value: "text-embedding-3-large", label: "text-embedding-3-large", description: "3072 dims, highest quality" },
        ],
        default: "text-embedding-3-small",
      },
    ],
    defaults: { model: "text-embedding-3-small" },
  },
  {
    id: "cohere",
    name: "Cohere",
    description: "Dense retrieval embeddings with strong multilingual support",
    options: [
      {
        key: "model",
        label: "Model",
        type: "select",
        description: "Cohere embedding model.",
        choices: [
          { value: "embed-english-v3.0", label: "embed-english-v3.0", description: "1024 dims, English-optimized" },
          { value: "embed-multilingual-v3.0", label: "embed-multilingual-v3.0", description: "1024 dims, 100+ languages" },
        ],
        default: "embed-english-v3.0",
      },
    ],
    defaults: { model: "embed-english-v3.0" },
  },
  // ... voyage, jina
];
```

### Adding a New Provider/Strategy

When a developer implements (e.g.) a new reranker provider in slice N:

1. Add the implementation class in `src/rerankers/new-provider.ts`
2. Add one `RegistryEntry` to `src/registry/rerankers.ts`
3. Done — the frontend wizard automatically shows it

No frontend code changes. No type duplication. No preset updates (unless a new preset uses it).

### Export & Import

```typescript
// eval-lib src/registry/index.ts
export type { RegistryEntry, OptionDef, Choice, PresetEntry } from "./types.js";
export { EMBEDDER_REGISTRY } from "./embedders.js";
export { RERANKER_REGISTRY } from "./rerankers.js";
export { CHUNKER_REGISTRY } from "./chunkers.js";
export { INDEX_STRATEGY_REGISTRY } from "./index-strategies.js";
export { QUERY_STRATEGY_REGISTRY } from "./query-strategies.js";
export { SEARCH_STRATEGY_REGISTRY } from "./search-strategies.js";
export { REFINEMENT_STEP_REGISTRY } from "./refinement-steps.js";
export { PRESET_REGISTRY } from "./presets.js";
```

The registry sub-path is added to `tsup.config.ts` and `package.json` exports:
```
rag-evaluation-system/registry → src/registry/index.ts
```

This sub-path has zero runtime dependencies (pure data + types). Safe for browser import.

### Frontend Import

```typescript
// frontend/src/lib/pipeline-registry.ts
export {
  EMBEDDER_REGISTRY,
  RERANKER_REGISTRY,
  CHUNKER_REGISTRY,
  INDEX_STRATEGY_REGISTRY,
  QUERY_STRATEGY_REGISTRY,
  SEARCH_STRATEGY_REGISTRY,
  REFINEMENT_STEP_REGISTRY,
  PRESET_REGISTRY,
} from "rag-evaluation-system/registry";
export type { RegistryEntry, OptionDef, PresetEntry } from "rag-evaluation-system/registry";
```

**Eliminates type duplication:** The frontend's `pipeline-types.ts` currently duplicates `PipelineConfig`, `IndexConfig`, `QueryConfig`, etc. With the registry sub-path, the frontend imports types directly from eval-lib. The `resolveConfig()` and `isPresetUnmodified()` helpers stay frontend-side (they're UI concerns).

---

## Part 2: Guided Wizard (Frontend)

### Architecture

The wizard replaces the current `PipelineConfigModal`. It's a large modal (or could be a full page — same component either way).

```
frontend/src/components/wizard/
  RetrieverWizard.tsx        # top-level orchestrator (step state, navigation)
  WizardNav.tsx              # step indicators + back/next buttons
  steps/
    ChoosePresetStep.tsx     # Step 1: preset grid + "start from scratch"
    IndexStep.tsx            # Step 2: index strategy + chunker + embedder
    QueryStep.tsx            # Step 3: query strategy + LLM config
    SearchStep.tsx           # Step 4: search strategy + k
    RefinementStep.tsx       # Step 5: refinement pipeline builder
    ReviewStep.tsx           # Step 6: summary + create
  shared/
    StrategyCard.tsx         # radio card for selecting a strategy
    OptionField.tsx          # renders an OptionDef as the appropriate input
    OptionGroup.tsx          # groups OptionDefs with advanced toggle
    InfoTooltip.tsx          # (i) icon with hover description
    ComplexityBadge.tsx      # basic/intermediate/advanced pill
```

### Step 1: Choose Starting Point

```
+--------------------------------------------------------------+
|  Configure Retriever                          Step 1 of 6    |
|                                                               |
|  Start from a preset                                         |
|  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ |
|  │ baseline-vector  │ │ hybrid          │ │ hybrid-reranked│ |
|  │ ─────────────── │ │ ─────────────── │ │ ───────────────│ |
|  │ Dense vector     │ │ Dense + BM25    │ │ Hybrid search  │ |
|  │ search with      │ │ keyword search  │ │ with Cohere    │ |
|  │ cosine similarity│ │ with weighted   │ │ reranking for  │ |
|  │                  │ │ fusion          │ │ precision      │ |
|  │ [basic]          │ │ [intermediate]  │ │ [intermediate] │ |
|  │ plain→id→dense   │ │ plain→id→hybrid │ │ plain→id→hyb→rr│ |
|  └─────────────────┘ └─────────────────┘ └────────────────┘ |
|  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ |
|  │ anthropic-best   │ │ hyde-hybrid     │ │ premium        │ |
|  │ ─────────────── │ │ ─────────────── │ │ ───────────────│ |
|  │ Contextual       │ │ Hypothetical    │ │ Everything     │ |
|  │ retrieval with   │ │ document        │ │ combined:      │ |
|  │ hybrid + rerank  │ │ embeddings +    │ │ contextual +   │ |
|  │ (Anthropic style)│ │ hybrid search   │ │ multi-query +  │ |
|  │ [advanced] [LLM] │ │ [advanced][LLM] │ │ hybrid + all   │ |
|  │ ctx→id→hybrid→rr │ │ plain→hyde→hyb  │ │ [adv][LLM][RR] │ |
|  └─────────────────┘ └─────────────────┘ └────────────────┘ |
|                                                               |
|  [ ] Filter: basic  intermediate  advanced                   |
|  [ ] Search presets...                                       |
|                                                               |
|  ── or ──                                                    |
|                                                               |
|  [Start from scratch →]                                      |
|                                                               |
|                                    [Back]  [Next →]          |
+--------------------------------------------------------------+
```

- Preset cards are generated from `PRESET_REGISTRY`
- Complexity badges: green/yellow/red pills
- `[LLM]` and `[RR]` (reranker) requirement pills
- Stage flow shown as compact breadcrumb: `plain → identity → hybrid → rerank`
- Clicking a card selects it (green border) and pre-fills all steps

### Step 2: Index Stage

```
+--------------------------------------------------------------+
|  Index Strategy                               Step 2 of 6    |
|  How documents are chunked, enriched, and embedded           |
|                                                               |
|  Strategy                                                    |
|  ┌─────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐ |
|  │ ● Plain     │ │ ○ Contextual │ │ ○ Summary│ │ ○ Parent- │ |
|  │   Standard  │ │   LLM adds   │ │   LLM    │ │   Child   │ |
|  │   chunking +│ │   document   │ │   summar- │ │   Small   │ |
|  │   embedding │ │   context to │ │   izes    │ │   chunks  │ |
|  │             │ │   each chunk │ │   chunks  │ │   indexed,│ |
|  │             │ │   [LLM]      │ │   [LLM]   │ │   large   │ |
|  │             │ │              │ │           │ │   returned│ |
|  └─────────────┘ └──────────────┘ └──────────┘ └──────────┘ |
|                                                               |
|  Chunker                                                     |
|  [Recursive Character ▾]                                     |
|  Splits text by characters with configurable separators.     |
|  Good general-purpose chunker for most content types.        |
|                                                               |
|  Chunk Size       [1000    ]  (i)                            |
|  Chunk Overlap    [200     ]  (i)                            |
|                                                               |
|  ▸ Advanced (separators)                                     |
|                                                               |
|  Embedder                                                    |
|  Provider  [OpenAI ▾]                                        |
|  Model     [text-embedding-3-small ▾]                        |
|            1536 dims, fast, cost-effective                    |
|                                                               |
|                  [← Modified from: hybrid-reranked]          |
|                                    [Back]  [Next →]          |
+--------------------------------------------------------------+
```

- Strategy radio cards from `INDEX_STRATEGY_REGISTRY`
- Chunker dropdown from `CHUNKER_REGISTRY` — selecting one reveals its options
- Embedder: provider dropdown → model dropdown, both from `EMBEDDER_REGISTRY`
- `(i)` tooltips pull descriptions from `OptionDef.description`
- "Modified from: preset-name" indicator when the user has changed from the preset

### Step 3: Query Stage

```
+--------------------------------------------------------------+
|  Query Strategy                               Step 3 of 6    |
|  How the user's question is transformed before search        |
|                                                               |
|  ┌──────────────┐ ┌────────────┐ ┌─────────────┐            |
|  │ ● Identity   │ │ ○ HyDE     │ │ ○ Multi-    │  ...       |
|  │   Pass query │ │   Generate │ │   Query      │            |
|  │   through    │ │   hypothet-│ │   Generate N │            |
|  │   unchanged  │ │   ical doc │ │   query      │            |
|  │              │ │   [LLM]    │ │   variants   │            |
|  │              │ │            │ │   [LLM]      │            |
|  └──────────────┘ └────────────┘ └─────────────┘            |
|                                                               |
|  (No additional configuration for Identity)                  |
|                                                               |
|                                    [Back]  [Next →]          |
+--------------------------------------------------------------+
```

- When an LLM-requiring strategy is selected and no LLM configured yet, an inline LLM config section appears (model dropdown + temperature slider)
- LLM config is shared across all LLM-requiring stages (set once, used by query + index)

### Step 4: Search Stage

```
+--------------------------------------------------------------+
|  Search Strategy                              Step 4 of 6    |
|  How chunks are retrieved and ranked                         |
|                                                               |
|  ┌──────────────┐ ┌────────────┐ ┌─────────────┐            |
|  │ ○ Dense      │ │ ○ BM25     │ │ ● Hybrid    │            |
|  │   Vector     │ │   Keyword  │ │   Dense +   │            |
|  │   similarity │ │   matching │ │   BM25 fused│            |
|  │   search     │ │   (TF-IDF) │ │   together  │            |
|  └──────────────┘ └────────────┘ └─────────────┘            |
|                                                               |
|  Dense Weight    [0.7  ] ━━━━━━━●━━━  Sparse Weight [0.3]   |
|  Fusion Method   [Weighted ▾]                                |
|  Candidate Mult. [4    ]  (i) How many extra candidates      |
|                               to fetch per leg               |
|                                                               |
|  Top K           [5    ]  Number of final results            |
|                                                               |
|                                    [Back]  [Next →]          |
+--------------------------------------------------------------+
```

### Step 5: Refinement Pipeline

```
+--------------------------------------------------------------+
|  Refinement Pipeline                          Step 5 of 6    |
|  Post-retrieval steps applied in order                       |
|                                                               |
|  ┌──────────────────────────────────────────────────────  ┐  |
|  │ 1. Rerank                                          [x] │  |
|  │    Re-score results using a cross-encoder model         │  |
|  │    Provider [Cohere ▾]  Model [rerank-english-v3.0 ▾]  │  |
|  └─────────────────────────────────────────────────────── ┘  |
|                                                               |
|  ┌──────────────────────────────────────────────────────  ┐  |
|  │ 2. Threshold                                       [x] │  |
|  │    Remove results below a minimum score                 │  |
|  │    Min Score [0.3   ]                                   │  |
|  └─────────────────────────────────────────────────────── ┘  |
|                                                               |
|  [+ Add refinement step]                                     |
|    └─ Rerank | Threshold | Dedup | MMR | Expand Context      |
|                                                               |
|                                    [Back]  [Next →]          |
+--------------------------------------------------------------+
```

- Each step is a card with type label, description, and inline config
- `[x]` removes the step
- Steps are numbered to show order (future: drag handles for reordering)
- "Add step" dropdown shows all types from `REFINEMENT_STEP_REGISTRY`

### Step 6: Review & Create

```
+--------------------------------------------------------------+
|  Review & Create                              Step 6 of 6    |
|                                                               |
|  Name  [hybrid-reranked-custom     ]                         |
|  Based on: hybrid-reranked (modified)                        |
|                                                               |
|  ┌─ Index ──────────────────────────────────── [Edit] ─────┐ |
|  │ Strategy: Plain                                          │ |
|  │ Chunker:  Recursive Character (1000 chars, 200 overlap)  │ |
|  │ Embedder: OpenAI text-embedding-3-small (1536 dims)      │ |
|  └──────────────────────────────────────────────────────────┘ |
|                                                               |
|  ┌─ Query ──────────────────────────────────── [Edit] ─────┐ |
|  │ Strategy: Identity (passthrough)                         │ |
|  └──────────────────────────────────────────────────────────┘ |
|                                                               |
|  ┌─ Search ─────────────────────────────────── [Edit] ─────┐ |
|  │ Strategy: Hybrid (0.7 dense / 0.3 sparse, weighted)     │ |
|  │ Top K: 5                                                 │ |
|  └──────────────────────────────────────────────────────────┘ |
|                                                               |
|  ┌─ Refinement ─────────────────────────────── [Edit] ─────┐ |
|  │ 1. Rerank (Cohere rerank-english-v3.0)                   │ |
|  │ 2. Threshold (min score: 0.3)                            │ |
|  └──────────────────────────────────────────────────────────┘ |
|                                                               |
|                              [Save Config]  [Create Retriever]|
+--------------------------------------------------------------+
```

- "Save Config" saves to localStorage without creating a retriever
- "Create Retriever" calls the backend mutation
- [Edit] links jump back to the relevant step

### Design Tokens

The wizard uses the existing design system:
- Background: `bg-bg` (`#0c0c0f`) for modal backdrop, `bg-surface` (`#1a1a22`) for cards
- Borders: `border` (`#2a2a36`), `border-bright` for hover/selected
- Selected state: `border-accent` (`#6ee7b7`) + subtle `bg-accent-dim` tint
- Text: `text` for primary, `text-muted` for descriptions, `text-dim` for placeholders
- Badges: green (`accent`) for basic, `warn` yellow for intermediate, `error` red for advanced
- Font: JetBrains Mono throughout (monospace-native)
- Transitions: `fade-in` animation on step changes (existing keyframe)

### Navigation

- Step indicators at the top: numbered circles, filled = completed, outlined = current, dimmed = future
- Back/Next buttons at the bottom
- Steps can be clicked directly to jump (non-linear navigation)
- "Modified" indicator persists across steps when the user has deviated from the base preset
- "Reset to preset" link available on any step

---

## Part 3: Data Flow

```
eval-lib/src/registry/         ← source of truth (pure data, no deps)
        │
        │  build-time import
        ▼
frontend/src/lib/
  pipeline-registry.ts         ← re-exports registry data
  pipeline-types.ts            ← imports PipelineConfig type from eval-lib (no more duplication)
                                  keeps resolveConfig(), validation helpers
        │
        │  consumed by
        ▼
frontend/src/components/wizard/
  RetrieverWizard.tsx          ← reads registry to render options
  steps/*.tsx                  ← each step reads its registry slice
        │
        │  user completes wizard → PipelineConfig object
        ▼
frontend/src/lib/pipeline-storage.ts  ← localStorage persistence (unchanged)
        │
        │  createRetriever mutation
        ▼
backend/convex/retrieval/retrieverActions.ts  ← hashing + storage (unchanged)
```

### What Changes, What Stays

| Component | Change |
|-----------|--------|
| `eval-lib/src/registry/` | **New** — config registry with metadata |
| `eval-lib/tsup.config.ts` | **Modified** — add `registry` entry point |
| `eval-lib/package.json` | **Modified** — add `./registry` export |
| `frontend/pipeline-types.ts` | **Modified** — import types from eval-lib instead of duplicating |
| `frontend/pipeline-storage.ts` | **Unchanged** — localStorage persistence stays |
| `frontend/PipelineConfigModal.tsx` | **Replaced** — by wizard components |
| `frontend/components/wizard/` | **New** — all wizard components |
| `backend/convex/` | **Unchanged** — no backend changes |

### Incremental Rollout

**Phase 1 (can ship independently):**
- Registry in eval-lib (all files)
- Wizard Step 1 (presets) + Step 6 (review/create)
- Steps 2-5 show read-only summaries with "this stage uses: X" for preset-based configs

**Phase 2:**
- Full Steps 2-5 with all form fields driven by registry
- Remove old `PipelineConfigModal`

**Phase 3 (polish):**
- Drag-to-reorder refinement steps
- LLM cost/latency estimates per strategy
- "Compare configs" side-by-side view

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| Registry lives in eval-lib, not backend | Pure data, no latency, type-safe, one place to update |
| Separate `registry` sub-path | Zero runtime deps, safe for browser import |
| Wizard replaces modal (not page) | Keeps the two-panel layout (wizard left, retrievers right) |
| Non-linear step navigation | Power users can jump directly; beginners follow the flow |
| Presets as starting points (not immutable) | Most users want "hybrid but with bigger chunks" |
| Frontend imports types from eval-lib | Eliminates duplication; registry sub-path is browser-safe |
| Backend unchanged | Config stored as opaque JSON blob; registry is frontend/eval-lib concern |
