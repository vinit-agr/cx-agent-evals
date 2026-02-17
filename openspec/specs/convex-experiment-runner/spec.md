## ADDED Requirements

### Requirement: Start experiment mutation
The system SHALL provide a Convex mutation `experiments.start` in `convex/experiments.ts` (a regular file, NOT `"use node"`) that accepts `datasetId`, `name`, `retrieverConfig` (v.any() — an opaque config object), `k` (number), and `metricNames` (array of strings). It SHALL verify the dataset belongs to the user's org, create an `experiments` record with `status: "pending"`, create a `jobs` record with `type: "experiment"`, and schedule `internal.experimentActions.runIndexing` as the first phase. It SHALL return `{ jobId, experimentId }`.

Note: Experiment functions are split across two files due to Convex's `"use node"` constraint — `experiments.ts` contains mutations and queries, `experimentActions.ts` (a `"use node"` file) contains the pipeline actions.

#### Scenario: Start experiment with standard config
- **WHEN** calling `experiments.start` with a dataset, k=10, and metrics `["recall", "precision", "f1"]`
- **THEN** an experiment and job SHALL be created, and the indexing phase action SHALL be scheduled

### Requirement: Experiment execution as batch action pipeline
The system SHALL implement experiment execution in `convex/experimentActions.ts` (a `"use node"` file) as a multi-phase chained action pipeline: (1) **indexing** (`runIndexing`) — check if KB is already indexed via `rag.isIndexed`; if not, process all documents using `processBatch` with `indexSingleDocument` helper from `ragActions.ts`, (2) **evaluation** (`runEvaluation`) — for each question in the dataset, embed the query, call `ctx.vectorSearch("documentChunks", "by_embedding", ...)` inline in the action, hydrate results via `ctx.runQuery(internal.rag.fetchChunksWithDocs, { ids })`, convert to CharacterSpans (mapping chunk `content` to span `text`), compute metrics, and save to `experimentResults`, (3) **aggregation** (`runAggregation`) — compute average scores and update experiment record, then fire-and-forget schedule `internal.langsmithSync.syncExperiment`.

Note: LangSmith sync is NOT a formal pipeline phase — it is scheduled as a fire-and-forget action from the aggregation phase. Vector search is performed inline in the action because `ctx.vectorSearch()` is only available in ActionCtx.

#### Scenario: Experiment indexes and evaluates
- **WHEN** an experiment runs against a dataset with 100 questions
- **THEN** the pipeline SHALL index the corpus, evaluate each question, compute aggregate scores, and mark the experiment as completed

#### Scenario: Evaluation phase batches questions
- **WHEN** the evaluate phase starts with 1000 questions
- **THEN** questions SHALL be processed in batches within the time budget, with each result saved individually to `experimentResults`

### Requirement: Per-question evaluation results
For each question in the dataset, the evaluation action SHALL: (1) embed the query text using `OpenAIEmbedder`, (2) call `ctx.vectorSearch("documentChunks", "by_embedding", { vector, limit: k, filter: (q) => q.eq("kbId", kbId) })` inline in the action, (3) hydrate results via `ctx.runQuery(internal.rag.fetchChunksWithDocs, { ids: searchResults.map(r => r._id) })`, (4) convert each chunk to a CharacterSpan (mapping chunk's `content` field to span's `text` field, plus `docId`, `start`, `end`), (5) compute each configured metric by calling eval-lib's metric functions (recall, precision, iou, f1) with `retrievedSpans` and the question's `relevantSpans`, (6) save an `experimentResults` record via `ctx.runMutation(internal.experimentResults.insert, ...)` with the retrieved spans and per-question scores.

#### Scenario: Single question evaluation
- **WHEN** evaluating question "What is RAG?" with ground truth spans covering characters 100-250 in doc1
- **THEN** the system SHALL retrieve top-k chunks, compute recall/precision/etc against the ground truth spans, and save the result

#### Scenario: Retrieved spans are CharacterSpan-compatible
- **WHEN** chunks are retrieved from the vector search
- **THEN** each chunk's `docId`, `start`, `end`, and `content` SHALL directly map to the `CharacterSpan` interface used by eval-lib metrics

### Requirement: Aggregate metric computation
After all questions are evaluated, the system SHALL compute the average score for each metric across all questions and update the `experiments` record's `scores` field.

#### Scenario: Aggregate scores computed
- **WHEN** an experiment completes evaluation of 100 questions with metrics `["recall", "precision"]`
- **THEN** the experiment's `scores` SHALL contain `{ recall: <avg>, precision: <avg> }` averaged across all 100 questions

### Requirement: List experiments query
The system SHALL provide a Convex query `experiments.byDataset` that accepts a `datasetId` and returns all experiments for that dataset, including their `name`, `status`, `scores`, `retrieverConfig`, `k`, `langsmithUrl`, and `createdAt`.

#### Scenario: List experiments for dataset
- **WHEN** calling `experiments.byDataset` with a valid dataset ID
- **THEN** the query SHALL return all experiments for that dataset, ordered by creation date descending

### Requirement: Get experiment results query
The system SHALL provide a Convex query `experimentResults.byExperiment` that accepts an `experimentId` and returns all per-question results, including retrieved spans and scores.

#### Scenario: View per-question results
- **WHEN** calling `experimentResults.byExperiment` for a completed experiment
- **THEN** the query SHALL return all per-question results with retrieved spans and individual metric scores

### Requirement: Reuse existing document chunks
When starting an experiment, the `runIndexing` action SHALL check if the knowledge base already has any chunks via `ctx.runQuery(internal.rag.isIndexed, { kbId })`. If chunks exist, the indexing phase SHALL be skipped entirely and the evaluation phase SHALL start immediately. The check is presence-based (any chunks exist for that kbId), not config-based — re-indexing with different chunk sizes requires explicitly deleting existing chunks first via `rag.deleteKbChunks`.

#### Scenario: Skip indexing for previously chunked knowledge base
- **WHEN** starting an experiment on a knowledge base that already has chunks (regardless of chunker config)
- **THEN** the indexing phase SHALL be skipped, and the evaluate phase SHALL start immediately using existing chunks
