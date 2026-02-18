## ADDED Requirements

### Requirement: Start generation mutation
The system SHALL provide a Convex mutation `generation.start` in `convex/generation.ts` (a regular file, NOT `"use node"`) that accepts `kbId`, `name` (dataset name), `strategy` (one of `"simple"`, `"dimension-driven"`, `"real-world-grounded"`), and `strategyConfig` (v.any() — an opaque object containing strategy-specific config like `queriesPerDoc`, `dimensions`, `totalQuestions`, etc.). It SHALL verify the KB belongs to the user's org, create a `datasets` record with the strategy and config, create a `jobs` record with `type: "generation"`, and schedule the appropriate generation action via `ctx.scheduler.runAfter(0, ...)` based on the strategy: `simpleGenerate` for simple, `dimensionDrivenGenerate` for dimension-driven, `realWorldGroundedGenerate` for real-world-grounded. It SHALL return `{ jobId, datasetId }`.

Note: Generation functions are split across two files due to Convex's `"use node"` constraint — `generation.ts` contains the `start` mutation, `generationActions.ts` (a `"use node"` file) contains all generation and ground truth actions.

#### Scenario: Start simple strategy generation
- **WHEN** calling `generation.start` with `strategy: "simple"`, `kbId`, and `questionsPerDoc: 10`
- **THEN** a dataset and job SHALL be created, and the simple generation action SHALL be scheduled

#### Scenario: Start dimension-driven generation
- **WHEN** calling `generation.start` with `strategy: "dimension-driven"`, `dimensions`, and `totalQuestions: 100`
- **THEN** a dataset and job SHALL be created, and the filtering phase action SHALL be scheduled

#### Scenario: Start real-world-grounded generation
- **WHEN** calling `generation.start` with `strategy: "real-world-grounded"`, `realWorldQuestions`, and `totalSyntheticQuestions: 50`
- **THEN** a dataset and job SHALL be created, and the embedding phase action SHALL be scheduled

### Requirement: Simple strategy generation actions
The system SHALL implement the simple strategy as batch actions. For each document in the knowledge base, the action SHALL: (1) load the document content from DB, (2) construct a Corpus with that document, (3) call eval-lib's `SimpleStrategy.generate()` to produce questions, (4) insert each question into the `questions` table via mutation, (5) proceed to ground truth assignment. Documents SHALL be processed in batches within the time budget.

#### Scenario: Generate questions for single document
- **WHEN** processing a document with `questionsPerDoc: 5`
- **THEN** 5 questions SHALL be generated and inserted into the `questions` table with `sourceDocId` set to that document's ID

#### Scenario: Questions visible in real-time
- **WHEN** questions are inserted during generation
- **THEN** a frontend component using `useQuery(api.questions.byDataset, { datasetId })` SHALL receive the new questions automatically

### Requirement: Dimension-driven strategy generation actions
The system SHALL implement the dimension-driven strategy as a single action `generationActions.dimensionDrivenGenerate` that runs the full eval-lib `DimensionDrivenStrategy.generate()` pipeline in one action call. The action loads the corpus from the KB, parses dimensions from `strategyConfig`, creates the strategy with an `onProgress` callback that fires-and-forgets job progress updates, and runs the full pipeline (filtering, summarization, assignment, sampling, generation). Generated questions are inserted in batches of 100 via `internal.questions.insertBatch`. After generation, it schedules `assignGroundTruth` as the next phase.

Note: This single-action approach works for KBs with < ~50 docs that complete within the 10-minute Convex action timeout. For larger KBs, decomposed phased actions would be needed but are not yet implemented.

#### Scenario: Pipeline completes for small knowledge base
- **WHEN** a dimension-driven generation job runs against a KB with < 50 documents
- **THEN** the full pipeline (filter, summarize, assign, sample, generate) SHALL complete in a single action, then ground truth assignment SHALL run as batched follow-up

#### Scenario: Progress updates during pipeline
- **WHEN** the dimension-driven strategy progresses through phases
- **THEN** the `onProgress` callback SHALL fire-and-forget job progress updates with phase name messages

### Requirement: Real-world-grounded strategy generation actions
The system SHALL implement the real-world-grounded strategy as a single action `generationActions.realWorldGroundedGenerate` that runs the full eval-lib `RealWorldGroundedStrategy.generate()` pipeline in one action call. The action loads the corpus, creates an `OpenAIEmbedder`, runs the full pipeline (embed questions, embed passages, match, generate), and inserts generated questions in batches of 100. After generation, it schedules `assignGroundTruth` as the next phase. Errors are caught and the job is marked as failed.

Note: Like dimension-driven, this single-action approach works for smaller KBs within the 10-minute timeout.

#### Scenario: Real-world-grounded pipeline completes
- **WHEN** a real-world-grounded generation job runs with real-world questions against a knowledge base
- **THEN** the pipeline SHALL embed, match, generate in a single action, then ground truth assignment SHALL run as batched follow-up

### Requirement: Ground truth assignment as batch action
The system SHALL implement ground truth assignment as a batch action phase. For each question, it SHALL: (1) load the source document content from DB, (2) call eval-lib's `GroundTruthAssigner.assign()` to find relevant character spans, (3) update the question record with `relevantSpans` via mutation. Questions SHALL be processed individually within the time budget.

#### Scenario: Ground truth assigns character spans
- **WHEN** processing a question "What is RAG?" against its source document
- **THEN** the question's `relevantSpans` SHALL be populated with character-level spans where the answer appears, each with `docId`, `start`, `end`, and `text`

#### Scenario: Ground truth for 5000 questions
- **WHEN** the ground truth phase starts with 5000 questions
- **THEN** questions SHALL be processed in batches of ~40 per action, with each question's spans saved individually, and the pipeline SHALL complete across ~125 actions

### Requirement: Finalize generation action
The system SHALL provide an internal action `generationActions.finalizeGeneration` that runs after the ground truth phase completes. It SHALL: (1) count all questions for the dataset, (2) update the dataset's `questionCount` via `internal.datasets.updateQuestionCount`, (3) mark the job as completed with `result: { datasetId, questionCount }`, (4) fire-and-forget schedule `internal.langsmithSync.syncDataset` for automatic LangSmith sync.

#### Scenario: Generation finalized with LangSmith sync
- **WHEN** the ground truth phase completes for a generation job
- **THEN** the dataset's question count SHALL be updated, the job SHALL be marked completed, and a LangSmith sync action SHALL be scheduled

### Requirement: List generated questions query
The system SHALL provide a Convex query `questions.byDataset` that accepts a `datasetId` and returns all questions for that dataset. The query SHALL verify the dataset belongs to the user's organization.

#### Scenario: List questions with spans
- **WHEN** calling `questions.byDataset` for a completed dataset
- **THEN** the query SHALL return all questions with their `queryText`, `sourceDocId`, and `relevantSpans`
