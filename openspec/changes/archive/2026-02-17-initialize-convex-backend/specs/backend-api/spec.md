## REMOVED Requirements

### Requirement: POST /api/generate endpoint with SSE streaming
**Reason**: Replaced by Convex mutation `generation.start` and reactive queries on the `jobs` and `questions` tables. SSE streaming is no longer needed — Convex provides real-time updates via reactive `useQuery` hooks.
**Migration**: Frontend calls `useMutation(api.generation.start)` to start generation and `useQuery(api.jobs.get)` + `useQuery(api.questions.byDataset)` for real-time progress and results.

### Requirement: POST /api/discover-dimensions endpoint
**Reason**: Replaced by Convex generation pipeline. Dimension discovery runs as part of the dimension-driven strategy inside `generationActions.dimensionDrivenGenerate`. There is no standalone `dimensions.discover` action — dimensions are passed via `strategyConfig` when calling `generation.start`.
**Migration**: Frontend passes dimensions in `strategyConfig` when calling `useMutation(api.generation.start)`. Dimension discovery/filtering happens internally within the strategy pipeline.

### Requirement: POST /api/corpus/load endpoint
**Reason**: Replaced by file upload to Convex storage. Corpus documents are loaded from the `documents` table, not from the local filesystem.
**Migration**: Frontend uploads files via Convex file storage mutations and reads documents via `useQuery(api.documents.listByKb)`.

### Requirement: POST /api/browse endpoint
**Reason**: Filesystem browsing removed entirely. Users upload files directly instead of browsing server directories.
**Migration**: Use file upload UI with file picker or drag-and-drop.

### Requirement: GET /api/env/check endpoint
**Reason**: Environment variable checks are no longer exposed via a dedicated query. API keys (OPENAI_API_KEY, LANGSMITH_API_KEY) are set in the Convex dashboard as environment variables and accessed directly by server-side actions via `process.env`. There is no `config.checkEnv` query — actions fail at runtime if keys are missing.
**Migration**: Set required API keys in the Convex dashboard. The `ConvexClientProvider` in the frontend checks for `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at render time and shows a "Setup Required" UI if missing.

### Requirement: GET /api/datasets/list endpoint
**Reason**: Datasets are now stored in Convex DB. LangSmith listing is replaced by querying the `datasets` table directly.
**Migration**: Frontend calls `useQuery(api.datasets.list)` which reads from Convex DB. LangSmith data available via `langsmithUrl` field.

### Requirement: GET /api/experiments/list endpoint
**Reason**: Experiments are now stored in Convex DB. LangSmith experiment listing is replaced by querying the `experiments` table.
**Migration**: Frontend calls `useQuery(api.experiments.byDataset)` which reads from Convex DB.

### Requirement: POST /api/experiments/run endpoint with SSE streaming
**Reason**: Replaced by Convex mutation `experiments.start` and reactive queries. SSE streaming replaced by real-time `useQuery` on job progress.
**Migration**: Frontend calls `useMutation(api.experiments.start)` and observes progress via `useQuery(api.jobs.get)`.

### Requirement: POST /api/upload-dataset endpoint with SSE streaming
**Reason**: Dataset upload to LangSmith is now handled automatically by the LangSmith sync action after generation completes. No separate upload endpoint needed.
**Migration**: LangSmith sync happens automatically as a fire-and-forget action. Manual retry available via `langsmithSync.retry` mutation.
