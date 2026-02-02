## Architecture

The real-world grounded strategy follows the same pattern as existing strategies: implements `QuestionStrategy`, returns `GeneratedQuery[]`, and lets the existing ground truth assigner handle chunk/token-level labeling.

```
src/synthetic-datagen/strategies/real-world-grounded/
├── generator.ts         ← RealWorldGroundedStrategy orchestrator
├── matching.ts          ← passage splitting + embedding + cosine matching
└── generation.ts        ← few-shot prompt construction + batch generation
```

### Pipeline Flow

```
Real Questions (string[]) + Corpus + Embedder
         │
         ▼
Phase 1: Split docs into passages (~500 char paragraphs)
         Embed all passages + all real questions
         │
         ▼
Phase 2: Cosine similarity matching
         Each question → best-matching passage → document
         Filter by threshold (default 0.35)
         │
         ▼
Phase 3a: Mode A (direct reuse)
          All matched questions become GeneratedQuery with mode="direct"
         │
Phase 3b: Mode B (few-shot generation)
          Per doc: top-K matched questions as few-shot examples
          Generate N synthetic questions per doc
          Budget distributed proportional to match count
         │
         ▼
Output: GeneratedQuery[] (direct + generated)
```

## Decisions

### Decision 1: Budget model — Approach D
All matched real questions are included (uncapped). The `totalSyntheticQuestions` parameter controls only how many additional synthetic questions to generate. Total output = matched_real + totalSyntheticQuestions.

### Decision 2: Embedder provided by integration layer
The strategy requires `context.embedder` to be set. It does not auto-create one. The frontend API route creates an `OpenAIEmbedder` (text-embedding-3-small) as default. This keeps the strategy pure and testable with mock embedders.

### Decision 3: Passage splitter is internal utility
A simple paragraph-based splitter (split on `\n\n`, cap at ~500 chars) is used only for matching. It is not the chunker being evaluated. It lives in `matching.ts` as a private function.

### Decision 4: Synthetic budget distribution
Synthetic questions are distributed across documents proportional to how many real questions matched each doc. Documents with zero matches get a minimum allocation (1 question) using the global top-K questions as generic few-shot examples.

### Decision 5: Embedding batching
Questions and passages are embedded in batches of 100 to avoid API rate limits. Batches are parallelized with `Promise.all`.

### Decision 6: Frontend input — CSV upload or paste
A modal with two tabs: "Upload CSV" (single column, one question per row) and "Paste" (textarea, one per line). Both produce `string[]`. Saved to localStorage under `rag-eval:real-world-questions`.

### Decision 7: StrategyContext extension
Add `readonly embedder?: Embedder` to `StrategyContext`. This is additive and non-breaking — existing strategies ignore it.

## Non-Goals

- BM25 / hybrid retrieval matching (embedding-only for v1)
- Deduplication between real and synthetic questions
- PII scrubbing of real questions
- Configurable passage splitter parameters from UI
