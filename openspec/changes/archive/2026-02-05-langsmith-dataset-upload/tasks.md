## 1. Refactor eval-lib uploadDataset

- [x] 1.1 Define `UploadOptions` and `UploadResult` types in `packages/eval-lib/src/langsmith/upload.ts` — options: `datasetName`, `description`, `batchSize`, `maxRetries`, `onProgress`; result: `datasetName`, `datasetUrl`, `uploaded`, `failed`
- [x] 1.2 Refactor `uploadDataset()` to accept `UploadOptions`, create dataset with description, batch examples into groups of `batchSize` (default 20), use `client.createExamples()` bulk API, retry each batch up to `maxRetries` (default 3), call `onProgress` after each batch, construct dataset URL via `client.getHostUrl()`, and return `UploadResult`
- [x] 1.3 Export new types (`UploadOptions`, `UploadResult`) from `packages/eval-lib/src/langsmith/index.ts`
- [x] 1.4 Build eval-lib (`pnpm build`) and verify no type errors

## 2. Upload dataset API route

- [x] 2.1 Create `packages/frontend/src/app/api/upload-dataset/route.ts` with `POST` handler that validates `LANGSMITH_API_KEY` is set, parses request body (`questions`, `datasetName`, `metadata`), converts `GeneratedQuestion[]` to `GroundTruth[]` using branded type factories, builds dataset description from metadata, and calls `uploadDataset()` with `onProgress`
- [x] 2.2 Implement SSE streaming in the route: relay `onProgress` as `{ type: "progress", uploaded, total, failed }` events, emit `{ type: "done", datasetName, datasetUrl, uploaded, failed }` on completion, emit `{ type: "error", error }` on failure

## 3. Frontend types

- [x] 3.1 Add upload-related types to `packages/frontend/src/lib/types.ts` — upload SSE event types, upload metadata interface

## 4. UploadDatasetModal component

- [x] 4.1 Create `packages/frontend/src/components/UploadDatasetModal.tsx` with three states: confirm (editable dataset name input, generation summary, Cancel/Upload buttons), uploading (progress bar with uploaded/total count and failed count), complete (final counts, dataset name, "View in LangSmith" link opening in new tab, Done button)
- [x] 4.2 Implement dataset name auto-generation: `{strategyShort}_{corpusFolder}_{count}q_{YYYY-MM-DD}` with strategy mapping (`simple` → `simple`, `dimension-driven` → `dim-driven`, `real-world-grounded` → `rwg`)
- [x] 4.3 Implement SSE consumption for upload progress — POST to `/api/upload-dataset`, read stream, update progress bar state on progress events, transition to complete state on done event, show error on error event

## 5. QuestionList footer and page integration

- [x] 5.1 Add sticky footer to `QuestionList.tsx` with "Upload to LangSmith" button, visible only when `questions.length > 0 && !generating`. Style consistently with existing design system (border-t, accent color)
- [x] 5.2 Add `onUpload` callback prop to `QuestionList` component, wire the footer button to call it
- [x] 5.3 Add upload modal state to `page.tsx` — `uploadModalOpen` boolean, handler to open modal passing current `questions`, `strategy`, `folderPath`, `documents`, and generation config as props
- [x] 5.4 Render `UploadDatasetModal` in `page.tsx` when modal is open

## 6. Verification

- [x] 6.1 Build frontend (`pnpm -C packages/frontend build`) and verify no TypeScript errors
- [x] 6.2 Manual test: generate questions, click upload, confirm name, verify progress bar updates, verify completion shows LangSmith link
