## Context

The eval-lib currently uses LangSmith only for dataset storage (upload/load ground truth). Experiments are run locally via `runExperiment()` in `experiments/runner.ts`, which calls the local `evaluate()` function in `evaluation/evaluator.ts`. Results are returned as a plain `ExperimentResult` object with averaged metric scores — no per-query visibility, no tracing, no persistent history.

LangSmith's `evaluate()` function provides a complete experiment execution engine: it iterates over dataset examples, calls a target function for each, runs evaluator functions on the results, and stores everything (traces, per-example scores, aggregates) in the LangSmith platform.

## Goals / Non-Goals

**Goals:**
- Migrate experiment execution to LangSmith's `evaluate()` function
- Wrap existing pure `Metric` functions as LangSmith evaluators without modifying metric logic
- Get per-query metric scores, full retrieval traces, and experiment comparison in LangSmith UI
- Keep core metric calculation functions vendor-agnostic (no LangSmith dependency)
- Make the integration modular: adapter layer, experiment runner, and dataset management are separate concerns

**Non-Goals:**
- Online evaluation (production trace scoring) — future work
- Summary evaluators (aggregate statistics beyond mean) — can be added later
- Storing corpus documents in LangSmith — corpus stays local
- Changing the `Retriever` interface or `VectorRAGRetriever` implementation
- Changing metric calculation logic

## Decisions

### Decision 1: Adapter pattern for metrics → LangSmith evaluators

A generic `createLangSmithEvaluator(metric: Metric)` function wraps any `Metric` into a LangSmith evaluator. The adapter handles deserializing spans from LangSmith's plain JSON objects back into typed `CharacterSpan[]`, then calls `metric.calculate()`, then reshapes the result into `{ key, score }`.

**Why this over embedding LangSmith logic directly in metrics**: Keeps metrics as pure TypeScript functions. Any new metric automatically works with LangSmith via the same adapter. If we ever switch platforms, only the adapter changes.

### Decision 2: Closure-based target function for retriever initialization

The retriever is initialized once (chunking + embedding the corpus), then a closure over the initialized retriever is passed as the target function to LangSmith's `evaluate()`. This avoids re-initializing on every dataset example.

**Why this over lazy init inside the target**: Simpler, more predictable. Initialization is explicit and happens before evaluation starts. No need for state management or caching inside the target function.

### Decision 3: Rename local `evaluate()` to `computeMetrics()`

The local evaluation function in `evaluator.ts` is renamed to `computeMetrics()` to avoid naming conflict with LangSmith SDK's `evaluate()`. The function logic is unchanged.

**Why rename ours instead of aliasing LangSmith's**: Our function is internal plumbing. LangSmith's `evaluate` is the primary API users will interact with. Giving LangSmith the canonical name reduces confusion.

### Decision 4: Fully replace local experiment runner with LangSmith runner

The local `runExperiment()` function is replaced entirely. All experiments go through LangSmith's `evaluate()`. There is no local-only experiment execution path.

**Why not keep both**: Maintaining two runners creates divergence — feature gaps, inconsistent results, confusion about which to use. LangSmith provides strictly more value (traces, comparison, persistence) with no downside for offline evaluation.

### Decision 5: Modular decomposition of the Evaluation class

The current `Evaluation` class couples three concerns: corpus/ground-truth loading, retriever creation, and experiment execution. Split into:
- Dataset management: existing `upload.ts` and `client.ts` (already separate)
- Evaluator adapters: new module for wrapping metrics
- Experiment runner: new module that composes retriever + target + evaluators and calls LangSmith's `evaluate()`

The `Evaluation` class is refactored into a simpler `runLangSmithExperiment()` function that composes these pieces.

**Why a function over a class**: The class adds no state management value — it just stores config and delegates. A function with a config parameter is simpler and more composable.

### Decision 6: Experiment naming convention

Experiments are named using the pattern: `{chunker}-{embedder}-k{k}[-{reranker}]`

Example: `recursive-512-openai-ada-k5-cohere-rerank`

Config dimensions are also stored in LangSmith experiment metadata for filtering.

## Risks / Trade-offs

**LangSmith becomes a required dependency for experiments** → This is intentional. The `langsmith` package was already an optional dependency; it now becomes required for experiment running. Core metrics remain independent. If LangSmith is unavailable, `computeMetrics()` can still be called directly on pre-collected results.

**Corpus must be available locally** → The dataset stores only queries and ground truth spans, not the corpus itself. The corpus is needed to initialize the retriever (chunking + embedding). This means experiments can only run where the corpus files are accessible. → Acceptable for now; corpus versioning can be added later if needed.

**Breaking change to experiment runner API** → `runExperiment()` is replaced. Any code calling it directly will need to migrate to `runLangSmithExperiment()`. → Impact is limited since this is an internal library API, not a public-facing one.

**Network dependency** → LangSmith experiments require network connectivity to upload traces and scores. → Acceptable trade-off for the benefits gained. The `computeMetrics()` function remains available for offline metric calculation if needed.
