## ADDED Requirements

### Requirement: Dataset sync to LangSmith action
The system SHALL provide an internal action `langsmithSync.syncDataset` in `convex/langsmithSync.ts` (a `"use node"` file) that accepts a `datasetId`. It SHALL: (1) set `langsmithSyncStatus` to `"syncing"`, (2) read all questions for the dataset, (3) convert them to eval-lib's `GroundTruth[]` format using `QueryId`, `QueryText`, `DocumentId` branded types, (4) call eval-lib's `uploadDataset()` to create/update the LangSmith dataset, (5) update the `datasets` record with `langsmithDatasetId`, `langsmithUrl`, and `langsmithSyncStatus: "synced"`. If no questions exist, it SHALL set status to `"skipped"`. If the sync fails, it SHALL set `langsmithSyncStatus: "failed: <error message>"` (prefixed with "failed:" for cron retry detection).

#### Scenario: Successful dataset sync
- **WHEN** `langsmithSync.syncDataset` is called for a dataset with 100 questions
- **THEN** a LangSmith dataset SHALL be created with 100 examples, and the Convex dataset record SHALL be updated with the LangSmith ID and URL

#### Scenario: Sync failure does not affect Convex data
- **WHEN** `langsmithSync.syncDataset` fails due to LangSmith API error
- **THEN** the dataset's `langsmithSyncStatus` SHALL be set to `"failed"`, but all questions and data in Convex SHALL remain intact

### Requirement: Experiment sync to LangSmith action
The system SHALL provide an internal action `langsmithSync.syncExperiment` that accepts an `experimentId`. It SHALL: (1) ensure the parent dataset is synced first (calling `syncDatasetDirect` helper if `langsmithDatasetId` is missing), (2) read experiment results, (3) for each result, create a LangSmith run via `client.createRun()` with `run_type: "chain"`, the question's query text as input, retrieved spans as output, and scores as metadata. The project name is `"<experiment-name>-<timestamp>"`. Sync failures are non-critical — errors are logged but don't fail the experiment.

#### Scenario: Successful experiment sync
- **WHEN** `langsmithSync.syncExperiment` is called for a completed experiment
- **THEN** individual runs SHALL be pushed to LangSmith for each question result

#### Scenario: Dataset synced first if needed
- **WHEN** the parent dataset is not yet synced to LangSmith
- **THEN** the dataset SHALL be synced first before pushing experiment results

### Requirement: Automatic sync after completion
The system SHALL automatically schedule a LangSmith sync action when a generation job or experiment job completes. The sync SHALL be scheduled via `ctx.scheduler.runAfter(0, internal.langsmithSync.syncDataset, { datasetId })` or equivalent as the final step of the job pipeline.

#### Scenario: Sync scheduled after generation completes
- **WHEN** a question generation job reaches `status: "completed"`
- **THEN** a LangSmith dataset sync action SHALL be automatically scheduled

#### Scenario: Sync scheduled after experiment completes
- **WHEN** an experiment job reaches `status: "completed"`
- **THEN** a LangSmith experiment sync action SHALL be automatically scheduled

### Requirement: Manual sync retry
The system SHALL provide Convex mutations in `convex/langsmithRetry.ts` (a regular file, NOT `"use node"`, since mutations cannot be in `"use node"` files): `langsmithRetry.retryDatasetSync` (accepts `datasetId`) and `langsmithRetry.retryExperimentSync` (accepts `experimentId`). Each SHALL verify the resource belongs to the user's org and schedule the corresponding sync action via `ctx.scheduler.runAfter(0, ...)`.

#### Scenario: Retry failed dataset sync
- **WHEN** a user calls `langsmithRetry.retryDatasetSync` for a dataset
- **THEN** a new `langsmithSync.syncDataset` action SHALL be scheduled

#### Scenario: Retry failed experiment sync
- **WHEN** a user calls `langsmithRetry.retryExperimentSync` for an experiment
- **THEN** a new `langsmithSync.syncExperiment` action SHALL be scheduled

### Requirement: Sync status visible in queries
All queries that return datasets or experiments SHALL include the `langsmithSyncStatus` and `langsmithUrl` fields, allowing the frontend to show sync status and provide "View in LangSmith" links.

#### Scenario: Dataset query includes sync status
- **WHEN** querying datasets for an organization
- **THEN** each dataset SHALL include `langsmithSyncStatus` (null, "syncing", "synced", "skipped", or "failed: <message>") and `langsmithUrl` (if synced)

### Requirement: Cron job for failed sync retry
The system SHALL define a cron job in `convex/crons.ts` that runs every hour via `crons.interval("retry failed langsmith syncs", { hours: 1 }, internal.langsmithSyncRetry.retryFailed)`. The `langsmithSyncRetry.retryFailed` internal action in `convex/langsmithSyncRetry.ts` (a `"use node"` file) SHALL: (1) query for datasets with `langsmithSyncStatus` starting with `"failed:"` via `langsmithSyncRetry.getFailedDatasets` internal query, (2) schedule `langsmithSync.syncDataset` for each.

Note: The current implementation scans all datasets (no dedicated index on sync status). A `MAX_AUTO_RETRIES` constant is defined but retry counting is not yet tracked per-resource.

#### Scenario: Cron retries failed syncs
- **WHEN** the hourly cron runs and finds datasets with `langsmithSyncStatus` starting with `"failed:"`
- **THEN** sync actions SHALL be scheduled for those datasets
