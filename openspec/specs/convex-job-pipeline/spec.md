## ADDED Requirements

### Requirement: Job creation mutation
The system SHALL provide a Convex mutation `jobs.create` that accepts `type` (string) and `config` (object). It SHALL create a job record with `status: "pending"`, `retryCount: 0`, `maxRetries: 3`, `orgId` from auth context, and `createdBy` from auth context. It SHALL return the job ID.

#### Scenario: Create a generation job
- **WHEN** calling `jobs.create` with `type: "generation"` and config parameters
- **THEN** a job record SHALL be created with `status: "pending"` and the job ID SHALL be returned

### Requirement: Job status query (reactive)
The system SHALL provide a Convex query `jobs.get` that accepts a `jobId` and returns the job document including `status`, `phase`, `progress`, `error`, and `result`. This query SHALL be reactive — the frontend using `useQuery(api.jobs.get, { jobId })` SHALL automatically receive updates when the job document changes.

#### Scenario: Real-time job progress
- **WHEN** a frontend component subscribes to `jobs.get` for a running job
- **THEN** the component SHALL receive automatic updates as the job's `phase`, `progress`, or `status` changes without polling

### Requirement: Job item initialization
The system SHALL provide an internal mutation `jobItems.initPhase` that accepts `jobId`, `phase`, and `items` (array of `{ itemKey: string }`). It SHALL create one `jobItems` record per item with `status: "pending"`. If items for that `jobId` and `phase` already exist, it SHALL skip initialization (idempotent).

#### Scenario: Initialize 1000 items for summarization phase
- **WHEN** calling `jobItems.initPhase` with 1000 doc IDs for phase `"summarize"`
- **THEN** 1000 `jobItems` records SHALL be created with `status: "pending"`

#### Scenario: Re-initialization is idempotent
- **WHEN** calling `jobItems.initPhase` for a phase that already has items
- **THEN** no duplicate items SHALL be created

### Requirement: Batch processing action with time budget
The system SHALL provide a reusable `processBatch` helper function in `convex/lib/batchProcessor.ts` that accepts an `ActionCtx` and a `BatchProcessorConfig` object. The config includes `jobId`, `phase`, `batchSize`, `processItem` callback, `phaseMessage`, `continuationAction` (action to schedule for more items), `continuationArgs`, optional `nextPhaseAction`, and `nextPhaseArgs`. The helper SHALL: (1) set job status to running and schedule a watchdog, (2) query for the next N pending items via `internal.jobItems.getPending`, (3) process each item individually via the `processItem` callback, (4) mark each item as `"done"` or `"failed"` via `ctx.runMutation` immediately after processing, (5) enforce a self-imposed time budget of 8 minutes (480,000 ms), (6) stop processing when the budget is exhausted, (7) schedule the `continuationAction` if pending items remain, (8) schedule the `nextPhaseAction` or mark job completed if all items are done.

#### Scenario: Batch processes items within time budget
- **WHEN** a batch action starts with 30 pending items and each takes ~5 seconds
- **THEN** the action SHALL process all 30 items (total ~150 sec, well within 8 min budget) and schedule the next batch or phase

#### Scenario: Batch stops at time budget and continues
- **WHEN** a batch action starts with 200 pending items and each takes ~10 seconds
- **THEN** the action SHALL process approximately 48 items (480 sec / 10 sec each), then schedule a continuation action for the remaining items

#### Scenario: Batch handles individual item failure
- **WHEN** processing item 15 of 30 throws an error (e.g., OpenAI rate limit)
- **THEN** item 15 SHALL be marked as `"failed"` with the error message, and processing SHALL continue with item 16

### Requirement: Job progress updates
The system SHALL update the `jobs` table with progress information after each batch. The `progress` field SHALL contain `current` (number of done items), `total` (total items for this phase), and `message` (human-readable status). The `phase` field SHALL reflect the current pipeline phase.

#### Scenario: Progress visible during processing
- **WHEN** 247 of 1000 items are done in the summarize phase
- **THEN** the job document SHALL have `phase: "summarize"` and `progress: { current: 247, total: 1000, message: "Summarizing documents..." }`

### Requirement: Watchdog recovery
Each batch action SHALL schedule a delayed watchdog mutation via `ctx.scheduler.runAfter(11 * 60 * 1000, internal.jobs.watchdog, { jobId, expectedPhase, expectedProgress })` at the start of execution. The `expectedProgress` is the current `done` count at watchdog scheduling time. The watchdog mutation (`jobs.watchdog`) SHALL: (1) check if the job is still `status: "running"` and in the `expectedPhase`, (2) check if the job's progress has advanced beyond `expectedProgress`, (3) if stalled (no progress made), log an error message on the job. The watchdog SHALL be a no-op if the job has moved past the expected phase, completed, or made progress.

Note: The current watchdog implementation logs stalls but does not automatically re-schedule batch actions. Full automatic recovery would require storing the continuation action reference in the watchdog args.

#### Scenario: Action times out — watchdog detects stall
- **WHEN** a batch action is killed by the 10-minute timeout before scheduling its continuation
- **THEN** the watchdog mutation SHALL fire 11 minutes after the batch started, detect the stall, and log an error on the job

#### Scenario: Normal completion — watchdog is no-op
- **WHEN** a batch action completes normally and schedules its continuation
- **THEN** the watchdog mutation SHALL detect that the job has progressed past the expected phase and take no action

### Requirement: Retry with exponential backoff
**NOT YET IMPLEMENTED** at the `processBatch` helper level. The `jobs` table stores `retryCount` and `maxRetries` fields for future use. Currently, individual item failures are caught and the item is marked as `"failed"`, but the batch continues. Whole-batch failures in dimension-driven and real-world-grounded strategies are caught at the action level and the job is marked as `"failed"` with the error message. Automatic retry scheduling with exponential backoff may be added in a future change.

#### Scenario: Individual item failure does not stop batch
- **WHEN** a single item in a batch throws an error
- **THEN** that item SHALL be marked as `"failed"` with the error message, and processing SHALL continue with the next item

#### Scenario: Whole-action failure marks job as failed
- **WHEN** a generation action (dimension-driven or real-world-grounded) fails with an uncaught error
- **THEN** the job SHALL be marked as `status: "failed"` with the error message

### Requirement: Job completion
When all phases of a job are complete, the system SHALL update the job with `status: "completed"` and populate the `result` field with relevant output data (e.g., dataset ID for generation jobs, experiment scores for experiment jobs).

#### Scenario: Generation job completes
- **WHEN** all phases of a generation job finish (filtering, summarizing, generating, ground truth)
- **THEN** the job SHALL have `status: "completed"` and `result` SHALL contain the dataset ID and total question count
