## Why

The system currently runs all backend logic (question generation, experiment execution, dataset upload, file browsing) inside Next.js API routes that execute on the local machine. This means: no persistence between sessions, no deployability to the cloud, no multi-user/org support, no scheduled jobs, and SSE-based streaming that is fragile (browser tab close = lost work). We need a proper backend that supports org-scoped data persistence, authenticated access, long-running batch operations with checkpointing, and real-time progress — all deployable to the cloud.

## What Changes

- **Add Convex backend** with org-scoped schema (knowledgeBases, documents, datasets, questions, experiments, experimentResults, jobs, jobItems, documentChunks) with Clerk authentication
- **Replace filesystem-based corpus loading** with browser file upload to Convex file storage — users upload .md files directly, content is extracted and stored in the documents table
- **Replace all 9 Next.js API routes** with Convex queries, mutations, and actions — zero `/api/` routes remain in the frontend
- **Replace SSE streaming** with Convex reactive queries on job/jobItems tables for real-time progress
- **Add batch-level checkpointed action pipeline** for long-running operations (generation, ground truth, experiments) with per-item persistence, self-imposed time budgets, and watchdog recovery — designed for 1000s of documents/questions
- **Add custom position-aware RAG** using Convex native vector indexes that preserves character-level start/end positions for span-based evaluation
- **Add LangSmith hybrid sync** — Convex as source of truth, fire-and-forget sync to LangSmith for their UI/comparison features
- **Refactor eval-lib** to remove Node-specific APIs (`node:fs`, `node:path`, `node:crypto`) so it can run in Convex's V8 runtime — `corpusFromFolder` replaced by constructing Corpus objects from DB data, `loadDimensions` accepts JSON directly, `generatePaChunkId` uses Web Crypto API
- **BREAKING**: All Next.js API routes removed — frontend communicates exclusively via Convex hooks (`useQuery`, `useMutation`, `useAction`)
- **BREAKING**: Filesystem-based corpus loading replaced by file upload — no more folder browsing

## Capabilities

### New Capabilities
- `convex-schema`: Org-scoped Convex schema definition — knowledgeBases, documents, datasets, questions, experiments, experimentResults, jobs, jobItems, documentChunks tables with indexes, vector indexes, and search indexes
- `convex-auth`: Clerk + Convex authentication — JWT verification, org context extraction, auth helper used by all functions
- `convex-file-upload`: File upload flow — browser uploads .md files to Convex storage, content extracted and stored in documents table, replaces filesystem browsing
- `convex-job-pipeline`: Batch-checkpointed action pipeline — job/jobItem tracking, batch processing with time budgets, per-item persistence, watchdog recovery, retry with backoff, designed for 1000s of items
- `convex-question-generation`: Question generation as Convex actions — all 3 strategies (simple, dimension-driven, real-world-grounded) run as chained batch actions with progress tracking
- `convex-experiment-runner`: Experiment execution as Convex actions — retriever setup, per-query evaluation, metric computation, results persistence
- `convex-position-aware-rag`: Custom position-aware RAG using Convex vector indexes — chunking with character positions, embedding storage, vector search filtered by knowledgeBase, returns CharacterSpan-compatible results
- `convex-langsmith-sync`: Fire-and-forget LangSmith sync — datasets and experiment results synced to LangSmith as background actions, sync status tracked, retry on failure

### Modified Capabilities
- `corpus-loader`: **BREAKING** — Filesystem-based loading replaced by file upload; `corpusFromFolder` no longer used from frontend/backend, Corpus constructed from DB documents
- `backend-api`: **BREAKING** — All Next.js API routes removed entirely, replaced by Convex functions

## Impact

- **packages/backend/**: New Convex backend package with `convex/` directory, schema, functions, and auth helpers
- **packages/frontend/**: Remove all `src/app/api/` routes, add Convex + Clerk providers to layout, replace all `fetch()` calls with Convex hooks, replace file browser with file upload UI
- **packages/eval-lib/**: Remove `node:fs`, `node:path`, `node:crypto` imports from 4 files; add pure-JS alternatives; `corpusFromFolder` kept for CLI/test use but not used by frontend/backend
- **Dependencies**: Add `convex`, `@clerk/nextjs`, `@clerk/clerk-react` to frontend; add `convex` to backend
- **Environment**: New env vars for Convex deployment URL, Clerk publishable key, Clerk secret key, Clerk JWT issuer URL configured in Convex dashboard
