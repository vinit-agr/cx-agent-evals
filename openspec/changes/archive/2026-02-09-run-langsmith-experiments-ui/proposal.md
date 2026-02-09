## Why

The system can generate evaluation datasets and upload them to LangSmith, but running experiments requires writing code. Users need a UI to configure and run retrieval experiments directly, seeing results in real-time and linking to LangSmith for detailed analysis.

## What Changes

- Add a mode selector landing page with "Generate Questions" and "Run Experiments" options
- Create a new experiments page with two-column layout (configuration + console)
- Add dataset picker that fetches LangSmith datasets ordered by creation date
- Add retriever configuration UI for VectorRAG (chunker, embedder, reranker, vector store, k)
- Add metrics selection (recall, precision, IoU, F1)
- Add auto-generated experiment name with edit capability
- Implement SSE-streaming experiment execution with real-time progress
- Show experiment results with aggregate scores and LangSmith deep links
- Display recent experiments list with "Compare in LangSmith" link
- Store corpus folder path in dataset metadata during upload (fix existing gap)
- Add API key status checking for required services

## Capabilities

### New Capabilities

- `experiments-ui`: Frontend page and components for configuring and running LangSmith experiments with real-time progress streaming
- `mode-selector-ui`: Landing page with mode selection cards for "Generate Questions" vs "Run Experiments" flows

### Modified Capabilities

- `langsmith-integration`: Add dataset metadata support (folderPath, strategy) and dataset listing API
- `frontend-app-shell`: Update to support mode-based navigation between generate and experiments flows

## Impact

- **Frontend**: New page at `/experiments`, mode selector on landing page, updated routing
- **API Routes**: New `/api/datasets/list`, `/api/experiments/run` (SSE), `/api/experiments/list`, `/api/env/check`
- **eval-lib**: Update `uploadDataset` to accept and store dataset-level metadata
- **Dependencies**: Uses existing `runLangSmithExperiment` from `langsmith/experiment-runner` entry point
