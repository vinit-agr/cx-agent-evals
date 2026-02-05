## Why

After generating synthetic questions with ground truth spans, users have no way to push that data to LangSmith from the UI. The dataset must be uploaded to LangSmith so it can be used in downstream experimentation workflows. Currently `uploadDataset()` exists in eval-lib but is not exposed through the frontend, has no progress feedback, and creates examples one at a time.

## What Changes

- Refactor `uploadDataset()` in eval-lib to support batched uploads (20 examples per batch), retry logic (3 attempts per batch), progress callbacks, and return a dataset URL
- Add a new SSE API route `POST /api/upload-dataset` that converts frontend types to `GroundTruth[]`, calls the refactored `uploadDataset()`, and streams progress events
- Add an `UploadDatasetModal` component with three states: confirm (editable dataset name + summary), uploading (progress bar), and complete (success count + LangSmith link)
- Add a sticky footer button in `QuestionList` that triggers the upload modal when generation is complete
- Auto-generate dataset names from current strategy, corpus folder, question count, and date
- Embed generation metadata (strategy, corpus path, dimensions, question count) in the LangSmith dataset description

## Capabilities

### New Capabilities
- `dataset-upload-ui`: Frontend UI for uploading generated questions to LangSmith — modal with confirmation, progress bar, and completion with direct link to dataset

### Modified Capabilities
- `langsmith-integration`: Upload function gains batched creation (20 per batch), 3-retry error handling, `onProgress` callback, configurable dataset description, and returns dataset URL alongside name

## Impact

- **eval-lib**: `src/langsmith/upload.ts` signature changes — `uploadDataset()` returns `UploadResult` instead of `string`, accepts `UploadOptions` with callback. Existing callers (none in frontend currently) would need to adapt.
- **frontend**: New API route at `src/app/api/upload-dataset/route.ts`, new component `UploadDatasetModal.tsx`, modifications to `QuestionList.tsx` (footer button) and `page.tsx` (modal state/handlers)
- **Environment**: Requires `LANGSMITH_API_KEY` in `packages/frontend/.env`
- **Dependencies**: No new packages — uses existing `langsmith` SDK already in eval-lib
