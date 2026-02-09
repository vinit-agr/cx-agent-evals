## 1. LangSmith Integration Updates

- [x] 1.1 Add `metadata` option to `UploadOptions` interface in `upload.ts`
- [x] 1.2 Pass `metadata` to `client.createDataset()` call
- [x] 1.3 Update frontend upload API route to pass `folderPath` and `strategy` in metadata
- [x] 1.4 Add `listDatasets()` function to langsmith module
- [x] 1.5 Add `listExperiments(datasetId)` function to langsmith module
- [x] 1.6 Add `getCompareUrl(datasetId)` function to langsmith module
- [x] 1.7 Add `DatasetInfo` and `ExperimentInfo` types to langsmith exports
- [x] 1.8 Write tests for new langsmith functions

## 2. Frontend API Routes

- [x] 2.1 Create `/api/datasets/list` route that calls `listDatasets()`
- [x] 2.2 Create `/api/experiments/list` route that calls `listExperiments()`
- [x] 2.3 Create `/api/env/check` route that returns configured API keys status
- [x] 2.4 Create `/api/experiments/run` SSE route for experiment execution

## 3. App Shell and Routing

- [x] 3.1 Create mode selector landing page at `/app/page.tsx`
- [x] 3.2 Move existing question generation UI to `/app/generate/page.tsx`
- [x] 3.3 Create experiments page shell at `/app/experiments/page.tsx`
- [x] 3.4 Update Header component with mode tabs for navigation
- [x] 3.5 Add shared layout handling for mode indication

## 4. Experiments Page - Configuration Panel

- [x] 4.1 Create `DatasetPicker` component with dropdown and loading state
- [x] 4.2 Create `CorpusInfo` component showing folder path and doc count
- [x] 4.3 Create `RetrieverConfig` component container
- [x] 4.4 Create `ChunkerConfig` component with type, size, overlap inputs
- [x] 4.5 Create `EmbedderSelect` component with dropdown and API key status
- [x] 4.6 Create `VectorStoreSelect` component with dropdown
- [x] 4.7 Create `RerankerSelect` component with dropdown and API key warning
- [x] 4.8 Create `ParameterInput` component for k value
- [x] 4.9 Create `MetricsSelector` component with checkboxes
- [x] 4.10 Create `ExperimentNameInput` component with auto-generation

## 5. Experiments Page - Console Panel

- [x] 5.1 Create `StatusPanel` component with idle/running/complete/error states
- [x] 5.2 Create `ProgressDisplay` component with phase, progress bar, elapsed time
- [x] 5.3 Create `RunButton` component with disabled states
- [x] 5.4 Create `ExperimentCard` component for experiment list items
- [x] 5.5 Create `ExperimentsList` component fetching from API
- [x] 5.6 Create `CompareLink` component for LangSmith comparison

## 6. Experiments Page - State and Integration

- [x] 6.1 Wire up dataset picker to fetch datasets on mount
- [x] 6.2 Wire up corpus info display from dataset metadata
- [x] 6.3 Implement experiment name auto-generation from config
- [x] 6.4 Implement Run Experiment SSE handler with progress updates
- [x] 6.5 Wire up experiments list to refresh on dataset change
- [x] 6.6 Implement error handling and retry functionality
- [x] 6.7 Add API key status fetching and display

## 7. Experiment Runner API Route

- [x] 7.1 Implement corpus loading from folder path in run route
- [x] 7.2 Implement VectorRAGRetriever construction from config
- [x] 7.3 Implement SSE streaming for experiment phases
- [x] 7.4 Implement progress callbacks during experiment execution
- [x] 7.5 Return experiment results and LangSmith URL on completion

## 8. Testing and Polish

- [x] 8.1 Test full experiment flow end-to-end (verified with LangSmith dataset)
- [x] 8.2 Test mode navigation between generate and experiments
- [x] 8.3 Test error states (missing API keys, failed experiments)
- [x] 8.4 Verify LangSmith deep links work correctly (experiments list shows working links)
- [x] 8.5 Build frontend and verify no type errors
