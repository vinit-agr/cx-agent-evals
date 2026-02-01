## Context

The synthetic datagen module currently has two generators (`ChunkLevelSyntheticDatasetGenerator`, `TokenLevelSyntheticDatasetGenerator`) that each hardcode Strategy 1 (direct prompt-based generation) and their respective ground-truth assignment logic in a single class. This coupling means adding a new question-generation strategy requires duplicating the ground-truth logic, and vice versa.

The existing prompts are minimal — "generate N diverse questions" — with no few-shot examples, question-type constraints, or diversity guarantees. The dimension-driven approach structurally solves the diversity problem by explicitly varying user persona, intent, complexity, and other axes.

## Goals / Non-Goals

**Goals:**
- Restructure `src/synthetic-datagen/` to separate strategies from ground-truth assignment
- Implement dimension-driven generation strategy (auto-discovery, filtering, relevance matrix, sampling)
- Retain simple prompt-based strategy as a lightweight alternative
- Both strategies produce identical output types for both chunk-level and token-level evaluation

**Non-Goals:**
- Real-world question grounding (Strategy 3) — separate change
- Adversarial, topic-cluster, or user-journey strategies — deferred
- Frontend changes for strategy selection — separate change
- QA pipeline (answerability checks, deduplication) — can be added incrementally later

## Decisions

### Decision 1: Module structure separates strategies from ground-truth assigners

**Choice:** Organize as `strategies/` (what questions to generate) and `ground-truth/` (how to label them).

```
src/synthetic-datagen/
├── strategies/
│   ├── types.ts              ← QuestionStrategy interface, GeneratedQuery type
│   ├── simple/
│   │   └── generator.ts      ← improved prompt-based, queriesPerDoc
│   └── dimension-driven/
│       ├── discovery.ts       ← auto-discover dimensions from website
│       ├── filtering.ts       ← pairwise combo filtering
│       ├── relevance.ts       ← doc-combo relevance matrix
│       ├── sampling.ts        ← stratified sampling
│       └── generator.ts       ← orchestrates the pipeline
│
├── ground-truth/
│   ├── types.ts               ← GroundTruthAssigner interface
│   ├── chunk-level.ts         ← chunk ID assignment (extracted from existing)
│   └── token-level.ts         ← char span extraction (extracted from existing)
│
├── base.ts                    ← LLMClient, openAIClientAdapter (unchanged)
└── index.ts                   ← public API
```

**Alternative considered:** Keep the current eval-type-first structure and add strategy as a config option inside each generator. Rejected because it would require duplicating all strategy logic in both chunk-level and token-level generators.

**Key interface:**

```typescript
// strategies/types.ts
interface QuestionStrategy {
  generate(context: StrategyContext): Promise<GeneratedQuery[]>;
}

interface GeneratedQuery {
  query: string;
  targetDocId: string;
  metadata: Record<string, string>;
}

// ground-truth/types.ts
interface GroundTruthAssigner<T> {
  assign(queries: GeneratedQuery[], corpus: Corpus): Promise<T[]>;
}
```

Strategies produce queries (just text + target doc). Ground-truth assigners take those queries and produce labeled output. They compose cleanly.

### Decision 2: Pairwise filtering for unrealistic combinations

**Choice:** Filter at the pairwise dimension level, then compose only from valid pairs.

With 5 dimensions × 5 values = 3,125 full combos. Sending all to an LLM is expensive. Instead:
1. For each pair of dimensions (e.g., persona × intent), ask the LLM which value pairs are realistic.
2. With 5 dimensions, that's C(5,2) = 10 pairwise checks — manageable.
3. A full combo is valid only if ALL its pairwise projections are valid.

**Alternative considered:** Send all combos to LLM in batches. Simpler but O(n^k) in LLM calls. Pairwise filtering is O(k^2) and catches most unrealistic combos because they usually fail on a specific pair (e.g., new_user + advanced is invalid regardless of tone).

**Trade-off:** Misses rare 3-way interactions where A+B is fine, B+C is fine, A+C is fine, but A+B+C is nonsensical. Acceptable — the LLM generating the question will naturally soften these edge cases.

### Decision 3: Doc-combo relevance via document summaries

**Choice:** Two-step approach:
1. LLM generates a one-line summary per document (topic, audience, purpose). This is D calls.
2. LLM assigns combos to documents using summaries (batched). A few calls total.

This avoids D × C individual checks. The summary step is cheap and cacheable.

**Output:** A list of `(docId, combo)` pairs that are plausible. This becomes the sampling universe.

### Decision 4: Stratified sampling within a question budget

**Choice:** User specifies `totalQuestions`. Sampling ensures:
1. Every combo that appears in the relevance matrix is sampled at least once (if budget allows).
2. Every document has at least 1 question.
3. Remaining budget distributed proportionally across documents (larger docs get more).

If `totalQuestions` < number of unique combos in the matrix, prioritize document coverage first, then maximize combo coverage.

### Decision 5: Dimensions file format

**Choice:** JSON file saved after auto-discovery, editable by the user.

```json
{
  "dimensions": [
    {
      "name": "User Persona",
      "description": "Who is asking the question",
      "values": ["new_user", "power_user", "admin", "developer"]
    },
    {
      "name": "Query Intent",
      "description": "What the user is trying to accomplish",
      "values": ["troubleshooting", "how_to", "conceptual", "comparison"]
    }
  ]
}
```

The file is the source of truth after manual review. Auto-discovery writes this file; the generation pipeline reads it.

### Decision 6: Website crawling for auto-discovery

**Choice:** Accept a URL, fetch the page content (and optionally linked pages like /pricing, /docs, /features), convert to text, and send to the LLM with a prompt asking it to identify relevant question dimensions and values.

The fetching is lightweight — just HTML-to-text, not a full crawler. The user provides the URL; we fetch a bounded number of pages (e.g., up to 5 linked pages from the same domain).

### Decision 7: Simple strategy gets improved prompts

**Choice:** The existing simple strategy prompts are upgraded with:
- Few-shot examples (2-3 high-quality question/answer pairs in the system prompt)
- Question-type constraints (factoid, comparison, procedural, multi-hop, yes/no)
- Anti-patterns ("do not paraphrase source text", "do not ask about document structure")
- Difficulty distribution guidance

This is a low-effort improvement that benefits users who don't want to configure dimensions.

### Decision 8: Ground-truth assignment extracted into separate modules

**Choice:** Extract the ground-truth logic from the existing generators:
- **Chunk-level:** Chunking + chunk ID generation + LLM-based chunk ID assignment. Receives a query + document, returns `ChunkLevelGroundTruth`.
- **Token-level:** Two-step (excerpt extraction + span position finding). Receives a query + document, returns `TokenLevelGroundTruth`.

The existing `_generateQAPairs` method in `ChunkLevelSyntheticDatasetGenerator` currently does question generation AND ground-truth assignment in a single LLM call. This will be split: strategies generate queries, then the chunk-level assigner calls the LLM separately to identify relevant chunk IDs for each query.

**Trade-off:** This means an extra LLM call per question for chunk-level (previously one call did both). Acceptable for cleaner architecture. Can be optimized later by batching multiple queries per LLM call.

## Risks / Trade-offs

- **[Increased LLM costs]** → The dimension-driven pipeline has more LLM calls (discovery, filtering, relevance matrix, generation, ground-truth assignment). Mitigation: document the cost profile; the simple strategy remains available as a cheaper option.
- **[Pairwise filtering misses 3-way interactions]** → Some unrealistic combos may pass. Mitigation: the generation LLM naturally softens these; if quality is poor, can add a post-generation QA step later.
- **[Document summary quality affects relevance matrix]** → Bad summaries → wrong combo-doc assignments. Mitigation: summaries are one-line and easy for LLMs; can be manually overridden.
- **[Breaking change to public API]** → Existing `ChunkLevelSyntheticDatasetGenerator` and `TokenLevelSyntheticDatasetGenerator` classes change. Mitigation: the main consumers are the frontend API route and tests; both are in this repo.
- **[Website auto-discovery depends on website quality]** → Sparse or marketing-heavy websites may produce poor dimensions. Mitigation: auto-discovery is a starting point; the user always reviews/edits the dimensions file.
