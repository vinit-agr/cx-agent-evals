## 1. Convex Initialization & Project Setup

- [x] 1.1 Run `npx convex init` in `packages/backend/`, configure `convex/` directory, add Convex dependencies to package.json
- [x] 1.2 Add `convex` and `@clerk/nextjs` dependencies to `packages/frontend/package.json`, configure ConvexProviderWithClerk in layout.tsx
- [x] 1.3 Set up Clerk middleware in `packages/frontend/src/middleware.ts`
- [x] 1.4 Configure environment variables: Convex deployment URL in frontend `.env.local`, Clerk publishable key, Clerk secret key; configure Clerk JWT issuer URL in Convex dashboard
- [x] 1.5 Update `pnpm-workspace.yaml` and root `package.json` scripts for Convex dev/deploy commands

## 2. Convex Schema & Auth

- [x] 2.1 Define full schema in `convex/schema.ts` — all tables (users, knowledgeBases, documents, datasets, questions, experiments, experimentResults, jobs, jobItems, documentChunks) with validators, indexes, vector indexes, and search indexes
- [x] 2.2 Implement `getAuthContext(ctx)` helper in `convex/lib/auth.ts` — extract userId, orgId, orgRole from Clerk JWT
- [x] 2.3 Implement user sync mutation `users.getOrCreate` — lookup by clerkId, create if not found
- [x] 2.4 Deploy schema to Convex dev instance, verify all tables and indexes are created (MANUAL: run `pnpm dev:backend` to login and deploy)

## 3. eval-lib Refactoring (Remove Node APIs)

- [x] 3.1 Refactor `src/types/documents.ts` — keep `corpusFromFolder` for CLI/test use, add `createCorpusFromDocuments(docs: Array<{id: string, content: string, metadata?: Record<string, unknown>}>)` convenience function that doesn't use `node:fs` or `node:path`
- [x] 3.2 Refactor `src/synthetic-datagen/strategies/dimension-driven/dimensions.ts` — make `loadDimensions` accept raw JSON data (string or object) in addition to file path, or split into `loadDimensionsFromFile` and `parseDimensions`
- [x] 3.3 Refactor `src/synthetic-datagen/strategies/dimension-driven/discovery.ts` — make `writeFile` call optional (skip if no `outputPath` provided), return dimensions directly
- [x] 3.4 Refactor `src/utils/hashing.ts` — replace `node:crypto` createHash with FNV-1a pure-JS hash (no crypto dependency needed for chunk IDs)
- [x] 3.5 Run `pnpm test` to verify all eval-lib tests still pass after refactoring

## 4. File Upload & Knowledge Base Management

- [x] 4.1 Implement `convex/knowledgeBases.ts` — `create` mutation, `list` query (by org), `get` query
- [x] 4.2 Implement `convex/documents.ts` — `generateUploadUrl` mutation, `create` mutation (with content extraction from storage), `listByKb` query, `get` query
- [x] 4.3 Build file upload UI component in frontend — drag-and-drop / file picker for `.md` files, calls generateUploadUrl → POST file → create mutation, shows upload progress
- [x] 4.4 Build knowledge base management UI — create KB form, list KBs, select KB, show documents in selected KB
- [x] 4.5 Remove `/api/browse/route.ts` and `/api/corpus/load/route.ts` from frontend

## 5. Job Pipeline Infrastructure

- [x] 5.1 Implement `convex/jobs.ts` — `create` mutation, `get` query (reactive), `update` internal mutation, `watchdog` internal mutation
- [x] 5.2 Implement `convex/jobItems.ts` — `initPhase` internal mutation, `getPending` internal query, `markDone` internal mutation, `markFailed` internal mutation, `getProgress` internal query
- [x] 5.3 Implement `convex/lib/batchProcessor.ts` — shared batch processing logic with time budget (8 min), per-item try/catch, progress updates, continuation scheduling, watchdog scheduling
- [x] 5.4 Test batch processor with a simple mock action — verify time budget, checkpointing, continuation, and watchdog recovery

## 6. Question Generation Actions

- [x] 6.1 Implement `convex/generation.ts` — `start` mutation that creates dataset + job, schedules first phase based on strategy
- [x] 6.2 Implement simple strategy actions — batch action that processes docs, generates questions via eval-lib SimpleStrategy, inserts questions per-item
- [x] 6.3 Implement dimension-driven strategy actions — phase1 (filter), phase2 (summarize, batched), phase3 (assign, batched), phase4 (sample), phase5 (generate, batched)
- [x] 6.4 Implement real-world-grounded strategy actions — phase1 (embed questions), phase2 (embed passages), phase3 (match), phase4 (generate, batched)
- [x] 6.5 Implement ground truth assignment batch action — shared across all strategies, processes questions individually, updates relevantSpans via mutation
- [x] 6.6 Implement `convex/questions.ts` — `byDataset` query, `insertBatch` internal mutation, `updateSpans` internal mutation
- [x] 6.7 Remove `/api/generate/route.ts` and `/api/discover-dimensions/route.ts` from frontend
- [x] 6.8 Update generation page to use Convex hooks — `useMutation(api.generation.start)`, `useQuery(api.jobs.get)`, `useQuery(api.questions.byDataset)` — replace SSE EventSource logic

## 7. Position-Aware RAG & Vector Search

- [x] 7.1 Implement `convex/rag.ts` — `indexDocument` internal action (chunk with RecursiveCharacterChunker, embed, insert into documentChunks), `indexKnowledgeBase` action (batch process all docs), `deleteChunks` internal mutation
- [x] 7.2 Implement `convex/rag.ts` — `retrieve` internal action (embed query, vector search on documentChunks filtered by kbId, optional reranking, return CharacterSpan-compatible results)
- [x] 7.3 Verify retrieved chunks are directly usable with eval-lib metric functions (recall, precision, iou, f1) — write integration test

## 8. Experiment Runner Actions

- [x] 8.1 Implement `convex/experiments.ts` — `start` mutation (creates experiment + job, schedules indexing), `byDataset` query, `get` query
- [x] 8.2 Implement experiment indexing phase — check for existing chunks, skip if same config, otherwise index KB via rag.indexKnowledgeBase
- [x] 8.3 Implement experiment evaluation phase — batch action that processes questions, retrieves chunks, computes metrics, saves per-question results to experimentResults
- [x] 8.4 Implement experiment aggregation phase — compute average scores, update experiment record
- [x] 8.5 Implement `convex/experimentResults.ts` — `byExperiment` query, `insert` internal mutation
- [x] 8.6 Remove `/api/experiments/run/route.ts` and `/api/experiments/list/route.ts` and `/api/datasets/list/route.ts` from frontend
- [x] 8.7 Update experiments page to use Convex hooks — replace fetch calls with useQuery/useMutation, remove SSE EventSource logic

## 9. LangSmith Sync

- [x] 9.1 Implement `convex/langsmithSync.ts` — `syncDataset` internal action (read questions, convert to GroundTruth[], call eval-lib uploadDataset, update dataset record with LangSmith ID/URL/status)
- [x] 9.2 Implement `convex/langsmithSync.ts` — `syncExperiment` internal action (read experiment results, push to LangSmith, update experiment record)
- [x] 9.3 Implement `convex/langsmithSync.ts` — `retry` mutation for manual retry of failed syncs
- [x] 9.4 Wire auto-sync — schedule `syncDataset` at end of generation pipeline, schedule `syncExperiment` at end of experiment pipeline
- [x] 9.5 Add cron job in `convex/crons.ts` — hourly retry of failed syncs (max 3 auto-retries)
- [x] 9.6 Remove `/api/upload-dataset/route.ts` and `/api/env/check/route.ts` from frontend

## 10. Frontend Cleanup & Integration

- [x] 10.1 Remove all remaining files in `packages/frontend/src/app/api/` directory
- [x] 10.2 Update frontend layout with ClerkProvider + ConvexProviderWithClerk wrappers, organization switcher component
- [x] 10.3 Add sign-in/sign-up pages using Clerk components
- [x] 10.4 Update all pages to gate content behind auth (redirect to sign-in if unauthenticated, require active org)
- [ ] 10.5 Verify the full flow end-to-end: sign in → select org → create KB → upload docs → generate questions → run experiment → view results → LangSmith sync
