## Context

The eval-lib has a working `uploadDataset()` function that creates LangSmith datasets with examples one at a time, returning just the dataset name. The frontend generates synthetic questions with character span ground truth via SSE streaming, but has no way to push that data to LangSmith. The next step in the evaluation workflow requires datasets to exist in LangSmith for experimentation.

The frontend state after generation holds `GeneratedQuestion[]` (with `SpanInfo[]` spans) — plain objects without branded types. The eval-lib expects `GroundTruth[]` with branded `QueryId`, `QueryText`, `DocumentId` types. The API route bridges this type gap.

## Goals / Non-Goals

**Goals:**
- Allow users to upload generated questions to LangSmith directly from the frontend UI
- Provide progress feedback during upload with a progress bar
- Handle failures gracefully with retries and final success/fail reporting
- Generate meaningful default dataset names and descriptions from generation context
- Return a direct link to the created dataset in LangSmith

**Non-Goals:**
- Browsing or managing existing LangSmith datasets from the UI
- Editing individual questions before upload
- Downloading or exporting datasets locally
- Loading datasets back from LangSmith into the UI

## Decisions

### 1. Batched upload with `createExamples()` (bulk API)

Upload examples in batches of 20 using the LangSmith SDK's `createExamples(ExampleCreate[])` method rather than individual `createExample()` calls.

**Rationale:** Reduces API calls from N to ceil(N/20). Each batch is a single HTTP request. Natural retry boundary — retry an entire batch of 20 rather than individual examples. The SDK already supports this via `createExamples(uploads: ExampleCreate[])`.

**Alternative considered:** Individual `createExample()` with per-item retry. Rejected — too many API calls for large datasets, and the SDK's bulk method is purpose-built for this.

### 2. SSE for progress streaming (same pattern as `/api/generate`)

Use Server-Sent Events from a new `POST /api/upload-dataset` route, matching the existing SSE pattern in `/api/generate`.

**Rationale:** Consistent with codebase architecture. The frontend already has SSE consumption logic. Progress events emit after each batch completes, giving real-time feedback.

**Alternative considered:** Simple POST that returns when done. Rejected — no progress visibility for potentially slow uploads.

### 3. Architecture: eval-lib owns upload logic, API route is thin wrapper

The refactored `uploadDataset()` in eval-lib accepts an `onProgress` callback. The API route converts frontend types to `GroundTruth[]`, calls `uploadDataset()`, and relays progress events as SSE.

**Rationale:** Consistent with existing architecture — eval-lib is the engine, API routes are thin adapters. Keeps upload logic testable and reusable outside the frontend.

### 4. Dataset URL construction

Construct the LangSmith dataset URL as `${client.getHostUrl()}/datasets/${dataset.id}`. The SDK's `Client` exposes `getHostUrl()` which returns the web-facing URL (defaults to `https://smith.langchain.com`).

**Rationale:** The `Dataset` object returned by `createDataset()` has `id` but no `url` property. The `getHostUrl()` method handles custom LangSmith deployments.

### 5. Retry strategy: 3 attempts per batch with the batch as the retry unit

When a batch fails, retry the entire batch up to 3 times. After 3 failures, mark the batch as failed, log the count, and continue with the next batch.

**Rationale:** LangSmith `createExamples()` is atomic per call — either all examples in a batch succeed or the call fails. No partial batch state to reconcile. Continuing after failures ensures maximum data upload even with intermittent issues.

### 6. Upload button placement: QuestionList sticky footer

The "Upload to LangSmith" button sits in a sticky footer at the bottom of the QuestionList panel. It appears only when questions exist and generation is not in progress. Clicking opens the `UploadDatasetModal`.

**Rationale:** The QuestionList shows the data being uploaded. A footer keeps the action visible regardless of scroll position without crowding the header. The button operates on "what you see" — the current `questions` state.

### 7. Dataset naming convention

Auto-generated as `{strategy}_{corpus-folder}_{count}q_{date}` where strategy is shortened (`dim-driven`, `simple`, `rwg`), corpus-folder is the last path segment, and date is `YYYY-MM-DD`. The name is editable in the confirmation modal.

### 8. Type conversion in API route

The API route converts `GeneratedQuestion[]` → `GroundTruth[]` using branded type factory functions (`QueryId()`, `QueryText()`, `DocumentId()`). Each `GeneratedQuestion` becomes a `GroundTruth` with `query.id` set to `q_{index}` and `query.metadata` capturing the `docId`.

## Risks / Trade-offs

- **[Duplicate dataset names]** LangSmith may reject dataset creation if a name already exists. → The modal shows the name and lets the user edit it. The error will surface via SSE if it still conflicts.
- **[Large datasets slow to upload]** 500+ questions at 20/batch = 25+ API calls. → Progress bar makes the wait visible. Batching reduces total calls vs individual creates.
- **[Partial upload on failure]** If batches 1-3 succeed but batch 4 fails after retries, the dataset has partial data. → The completion screen reports exact uploaded/failed counts. User can see the partial dataset in LangSmith and decide whether to retry or delete.
- **[LANGSMITH_API_KEY not set]** → API route checks for the env var early and returns a clear error before attempting upload.
