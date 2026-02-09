## Purpose

Modifications to LangSmith integration to support dataset metadata and listing APIs.

## MODIFIED Requirements

### Requirement: Upload dataset to LangSmith
The system SHALL provide `uploadDataset(groundTruth: GroundTruth[], options?: UploadOptions): Promise<UploadResult>` that creates a LangSmith dataset and uploads examples in batches. `UploadOptions` SHALL include `datasetName` (optional, defaults to `"rag-eval-dataset"`), `description` (optional, for dataset description with generation metadata), `metadata` (optional `Record<string, unknown>` for structured dataset-level metadata like `folderPath` and `strategy`), `batchSize` (optional, defaults to 20), `maxRetries` (optional, defaults to 3), and `onProgress` (optional callback). `UploadResult` SHALL include `datasetName`, `datasetUrl` (direct link to LangSmith UI), `uploaded` (count of successful examples), and `failed` (count of failed examples). The `langsmith` package SHALL be loaded via dynamic `import()`. Examples SHALL be created using the SDK's bulk `createExamples()` method. Each batch that fails SHALL be retried up to `maxRetries` times before being counted as failed. The dataset URL SHALL be constructed as `${client.getHostUrl()}/datasets/${dataset.id}`. The `metadata` option SHALL be passed to `client.createDataset()`.

#### Scenario: Upload creates dataset and examples in batches
- **WHEN** calling `uploadDataset(groundTruth)` with 47 ground truth entries and default batch size of 20
- **THEN** a LangSmith dataset SHALL be created, examples SHALL be uploaded in 3 batches (20, 20, 7), and the result SHALL contain `uploaded: 47, failed: 0`

#### Scenario: Upload preserves span data
- **WHEN** uploading ground truth with spans
- **THEN** each example's `outputs.relevantSpans` SHALL contain the full span data including `docId`, `start`, `end`, and `text`

#### Scenario: Default dataset name
- **WHEN** calling `uploadDataset(groundTruth)` without options
- **THEN** the dataset SHALL be named `"rag-eval-dataset"`

#### Scenario: Custom dataset name and description
- **WHEN** calling `uploadDataset(groundTruth, { datasetName: "my-dataset", description: "Strategy: dim-driven..." })`
- **THEN** the dataset SHALL be created with the given name and description

#### Scenario: Dataset metadata stored
- **WHEN** calling `uploadDataset(groundTruth, { metadata: { folderPath: "/data/corpus", strategy: "dimension-driven" } })`
- **THEN** the dataset SHALL be created with the provided metadata accessible via the LangSmith SDK

#### Scenario: Progress callback invoked after each batch
- **WHEN** calling `uploadDataset(groundTruth, { onProgress })` with 47 entries
- **THEN** `onProgress` SHALL be called after each batch with `{ uploaded, total, failed }`

#### Scenario: Retry on batch failure
- **WHEN** a batch of 20 examples fails on first attempt but succeeds on second
- **THEN** the batch SHALL be retried and all 20 examples SHALL be counted as uploaded

#### Scenario: Batch fails after max retries
- **WHEN** a batch of 20 examples fails 3 times consecutively
- **THEN** the batch SHALL be counted as failed (failed += 20), and upload SHALL continue with the next batch

#### Scenario: Dataset URL returned
- **WHEN** upload completes
- **THEN** `UploadResult.datasetUrl` SHALL be a valid URL to the dataset in the LangSmith web UI

## ADDED Requirements

### Requirement: List LangSmith datasets
The system SHALL provide `listDatasets(): Promise<DatasetInfo[]>` that returns all datasets from LangSmith, ordered by creation date (most recent first). Each `DatasetInfo` SHALL include `id`, `name`, `createdAt`, `exampleCount`, and `metadata` (including `folderPath` if present).

#### Scenario: List datasets returns ordered results
- **WHEN** calling `listDatasets()`
- **THEN** the result SHALL be an array of datasets ordered by creation date descending

#### Scenario: Dataset metadata included
- **WHEN** a dataset has metadata with `folderPath`
- **THEN** the `DatasetInfo.metadata.folderPath` SHALL contain the stored path

### Requirement: List experiments for dataset
The system SHALL provide `listExperiments(datasetId: string): Promise<ExperimentInfo[]>` that returns all experiments (projects) associated with a dataset. Each `ExperimentInfo` SHALL include `id`, `name`, `createdAt`, `url` (deep link to LangSmith), and `scores` (aggregate metric scores if available). The `createdAt` field SHALL be derived from the LangSmith project's `start_time` field (not `created_at`, which does not exist on project objects).

#### Scenario: List experiments for dataset
- **WHEN** calling `listExperiments(datasetId)`
- **THEN** the result SHALL include all experiments that used that dataset

#### Scenario: Experiment creation date from start_time
- **WHEN** listing experiments
- **THEN** each `ExperimentInfo.createdAt` SHALL be parsed from the project's `start_time` field

#### Scenario: Experiment scores included
- **WHEN** an experiment has feedback scores
- **THEN** the `ExperimentInfo.scores` SHALL contain the aggregate scores keyed by metric name

### Requirement: Get experiment comparison URL
The system SHALL provide `getCompareUrl(datasetId: string): string` that returns a LangSmith URL for comparing all experiments on a dataset.

#### Scenario: Compare URL generated
- **WHEN** calling `getCompareUrl(datasetId)`
- **THEN** the result SHALL be a valid LangSmith URL that opens the comparison view
