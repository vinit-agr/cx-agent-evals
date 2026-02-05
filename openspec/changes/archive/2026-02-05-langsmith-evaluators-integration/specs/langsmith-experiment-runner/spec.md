## ADDED Requirements

### Requirement: LangSmith experiment runner function
The system SHALL provide an async `runLangSmithExperiment(config: LangSmithExperimentConfig)` function that orchestrates a full evaluation experiment through LangSmith. The config SHALL include `corpus: Corpus`, `retriever: Retriever`, `k: number`, `datasetName: string`, `metrics: Metric[]` (default: `[recall, precision, iou, f1]`), and optional `experimentPrefix: string` and `metadata: Record<string, unknown>`.

#### Scenario: Full experiment lifecycle
- **WHEN** calling `runLangSmithExperiment(config)`
- **THEN** the function SHALL (1) initialize the retriever with the corpus, (2) create a target function closure over the initialized retriever, (3) wrap metrics as LangSmith evaluators, (4) call LangSmith's `evaluate()` with the target, dataset, and evaluators, (5) clean up the retriever

#### Scenario: Retriever cleanup on success
- **WHEN** the experiment completes successfully
- **THEN** `retriever.cleanup()` SHALL be called

#### Scenario: Retriever cleanup on error
- **WHEN** an error occurs during evaluation
- **THEN** `retriever.cleanup()` SHALL still be called (via finally block)

### Requirement: Target function shape
The target function passed to LangSmith's `evaluate()` SHALL accept `{ query: string }` as input and return `{ retrievedSpans: Array<{ docId: string, start: number, end: number, text: string }> }`. It SHALL call `retriever.retrieve(query, k)` and convert the resulting `PositionAwareChunk[]` to serialized span objects.

#### Scenario: Target function retrieves and serializes
- **WHEN** LangSmith calls the target function with `{ query: "What is X?" }`
- **THEN** it SHALL call `retriever.retrieve("What is X?", k)` and return the chunks converted to span objects in `retrievedSpans`

### Requirement: Experiment naming
The experiment SHALL be named using `experimentPrefix` if provided. If not provided, the system SHALL generate a prefix from the retriever's `name` property. Experiment metadata SHALL include the retriever name, k value, corpus size, and any user-provided metadata.

#### Scenario: Custom experiment prefix
- **WHEN** `experimentPrefix: "recursive-512-openai-k5"` is provided
- **THEN** the LangSmith experiment SHALL use that as its prefix

#### Scenario: Auto-generated prefix
- **WHEN** no `experimentPrefix` is provided and the retriever name is `"vector-rag"`
- **THEN** the system SHALL use `"vector-rag"` as the experiment prefix

#### Scenario: Metadata includes config dimensions
- **WHEN** running an experiment with `k: 5` on a corpus of 10 documents
- **THEN** the experiment metadata SHALL include `{ retriever: retriever.name, k: 5, corpusSize: 10 }` merged with any user-provided metadata

### Requirement: LangSmithExperimentConfig type
The system SHALL define a `LangSmithExperimentConfig` interface with `corpus: Corpus`, `retriever: Retriever`, `k: number`, `datasetName: string`, optional `metrics: Metric[]`, optional `experimentPrefix: string`, and optional `metadata: Record<string, unknown>`.

#### Scenario: Minimal config
- **WHEN** creating a config with only required fields
- **THEN** TypeScript SHALL accept `{ corpus, retriever, k: 5, datasetName: "my-dataset" }`

#### Scenario: Full config with all options
- **WHEN** creating a config with all fields
- **THEN** TypeScript SHALL accept metrics, experimentPrefix, and metadata alongside required fields
