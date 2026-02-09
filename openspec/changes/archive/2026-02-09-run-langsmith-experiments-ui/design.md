## Context

The RAG evaluation system currently supports generating synthetic questions and uploading them as datasets to LangSmith. Running experiments against these datasets requires writing code using `runLangSmithExperiment()`. Users need a UI to configure retrievers, run experiments, and view results without coding.

The existing frontend is a single-page app with 3-column layout for question generation. The experiment runner already exists in `eval-lib` at the `langsmith/experiment-runner` entry point.

## Goals / Non-Goals

**Goals:**
- Add mode selection between "Generate Questions" and "Run Experiments"
- Provide UI to select LangSmith datasets and configure VectorRAG retriever
- Run experiments via SSE streaming with real-time progress
- Show headline metrics and link to LangSmith for detailed analysis
- Store corpus folder path in dataset metadata for later retrieval

**Non-Goals:**
- Background job infrastructure (experiments require tab to stay open for v1)
- Multiple retriever types (BM25, HyDE, etc.) — VectorRAG only for now
- Retriever registry pattern — hardcode VectorRAG but design extensible API contract
- Fetching detailed per-query results from LangSmith (link out instead)

## Decisions

### Decision 1: Two-column layout for experiments page
**Choice**: Configuration panel (left, fixed width) + Console panel (right, flex)
**Rationale**: Matches existing app's visual pattern. Configuration is naturally left-to-right (setup → execute → results). Console shows live status, progress, and experiment history.
**Alternatives**: Single column (rejected — too much scrolling), Three columns (rejected — no third content type like document viewer).

### Decision 2: SSE streaming for experiment execution
**Choice**: Use Server-Sent Events for real-time progress, same pattern as question generation.
**Rationale**: Already proven pattern in the app. Works with Next.js API routes. Provides good UX for long-running operations.
**Trade-off**: Experiment stops if tab closes. Acceptable for v1; background jobs deferred.

### Decision 3: Re-load corpus from folder path for each experiment
**Choice**: Store folder path in dataset metadata, re-load corpus when running experiments.
**Rationale**: Self-contained and simpler than passing corpus state between pages. Folder path is already in the upload metadata, just needs to be stored on the dataset itself.
**Alternatives**: Pass corpus in URL state (rejected — fragile, doesn't work for returning to previously uploaded datasets).

### Decision 4: Auto-generate experiment name from config
**Choice**: Generate descriptive name like `recursive-512-50-openai-small-k5`, allow user edit.
**Rationale**: Descriptive names help identify experiments in LangSmith. Auto-generation reduces friction while edit allows customization.

### Decision 5: Dataset picker ordered by creation date
**Choice**: Always show dataset picker (no special "just uploaded" flow), ordered most recent first.
**Rationale**: Simpler UX, single path to experiments. Most recent datasets are most likely to be used.

### Decision 6: API key checking via dedicated endpoint
**Choice**: Add `/api/env/check` that returns which API keys are configured.
**Rationale**: Frontend needs to show warnings for missing keys before user tries to run. Server-side check is authoritative.

### Decision 7: Extensible retriever config contract
**Choice**: Use discriminated union for retriever config (`{ type: "vector-rag", ... }`), even though only VectorRAG exists now.
**Rationale**: Adding new retrievers later only requires adding to the union and implementing the factory case. No API contract changes needed.
**Future Note**: When adding BM25, HyDE, Hybrid, etc., create a retriever registry pattern with config schemas per type.

## Risks / Trade-offs

**[Tab must stay open]** → Acceptable for v1. Document in UI that closing stops the experiment. Partial results persist in LangSmith.

**[Corpus loading adds latency]** → Chunking and embedding happen at experiment start. Mitigated by showing clear phase progress ("Initializing...", "Chunking...", "Embedding...").

**[Dataset metadata schema change]** → Adding `metadata` field to `uploadDataset()` is backwards compatible. Existing datasets won't have folderPath; UI should handle gracefully with manual path input fallback.

**[LangSmith API rate limits]** → Fetching dataset list and experiment results could hit limits with many datasets. Mitigated by reasonable page sizes and caching.
