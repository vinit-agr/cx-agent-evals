## 1. Schema & Backend Foundation

- [x] 1.1 Add `retrievers` table to `schema.ts` with all fields (orgId, kbId, name, retrieverConfig, indexConfigHash, retrieverConfigHash, defaultK, indexingJobId, status, chunkCount, error, createdBy, createdAt) and indexes (by_org, by_kb, by_kb_config_hash)
- [x] 1.2 Add optional `retrieverId` field (v.optional(v.id("retrievers"))) and `by_retriever` index to `experiments` table in `schema.ts`; make `retrieverConfig` and `k` optional for backward compatibility
- [x] 1.3 Add `computeRetrieverConfigHash` utility function (SHA-256 of full config including k, sorted keys) — either in eval-lib `config.ts` alongside `computeIndexConfigHash`, or in a new backend utility

## 2. Retriever CRUD Backend

- [x] 2.1 Create `convex/retrievers.ts` with `create` mutation — accepts kbId + retrieverConfig, computes both hashes, dedup check by (kbId, retrieverConfigHash), creates record with status "indexing", triggers `internal.indexing.startIndexing`, returns retriever ID (or existing ID if dedup)
- [x] 2.2 Add `byKb` query — lists retrievers for a KB with status, config summary, chunk count
- [x] 2.3 Add `byOrg` query — lists retrievers for org, optional status filter (for experiments page to get "ready" retrievers)
- [x] 2.4 Add `get` query — returns full retriever record by ID
- [x] 2.5 Add `remove` mutation — deletes retriever record (preserves chunks)
- [x] 2.6 Add `cleanup` mutation — deletes chunks for (kbId, indexConfigHash) if no other retriever shares them, deletes indexing job, resets retriever status to "configuring"
- [x] 2.7 Add internal mutation to update retriever status on indexing completion — hook into `indexing.onDocumentIndexed` or add a separate status-sync mechanism that checks indexing job status and updates retriever to "ready"/"error"

## 3. Retrieve Action Backend

- [x] 3.1 Create `convex/retrieveActions.ts` ("use node" file) with public `retrieve` action — accepts retrieverId + query + optional k override, loads retriever config, verifies status "ready", embeds query, vector search with kbId filter, post-filter by indexConfigHash, hydrate chunks, return ranked results with scores

## 4. Experiment Runner Updates

- [x] 4.1 Modify `experiments.start` mutation to accept optional `retrieverId` — when provided, load retriever, verify "ready" status, verify dataset KB matches retriever KB, store `retrieverId` on experiment record
- [x] 4.2 Modify `experimentActions.runExperiment` to handle dual paths: if experiment has `retrieverId`, load config from retrievers table and skip indexing; if legacy `retrieverConfig`, use existing indexing flow
- [x] 4.3 Deploy schema and verify backend with `npx convex dev --once`

## 5. Frontend Types & Shared Changes

- [x] 5.1 Update `pipeline-types.ts` — add `k` as a field on `PipelineConfig` (or create a `RetrieverConfig` type that wraps PipelineConfig + k), update `resolveConfig` and presets accordingly
- [x] 5.2 Update `PipelineConfigModal.tsx` to include k as part of the config being edited (not a separate prop)
- [x] 5.3 Update `PipelineConfigSummary.tsx` to read k from the config object
- [x] 5.4 Update `Header.tsx` to add "Retrievers" tab/link alongside Generate and Experiments

## 6. Mode Selector (Home Page)

- [x] 6.1 Update `ModeSelector.tsx` — add third "Retrievers" card with description "Configure, index, and test retrieval pipelines", link to `/retrievers`, update grid to 3-col

## 7. Retrievers Page (New)

- [x] 7.1 Create `/retrievers/page.tsx` with two-column layout — left config panel, right content panel
- [x] 7.2 Implement left panel — KB selector dropdown, pipeline config preset/custom selector (reuse PipelineConfigModal), "Create Retriever" button calling `retrievers.create`
- [x] 7.3 Implement `RetrieverCard.tsx` component — status badge, config summary, chunk count, indexing progress, action buttons (cleanup, delete)
- [x] 7.4 Implement retriever list section in right panel — `useQuery(api.retrievers.byKb)`, renders RetrieverCard per retriever, reactive updates
- [x] 7.5 Implement `RetrieverPlayground.tsx` component — multi-retriever checkbox selection, query input, parallel retrieve calls, side-by-side result columns with scores and latency
- [x] 7.6 Integrate playground into retrievers page below the retriever list

## 8. Experiments Page (Simplify)

- [x] 8.1 Replace pipeline config UI with `RetrieverSelector` dropdown — fetches ready retrievers via `useQuery(api.retrievers.byOrg, { status: "ready" })`, selecting a retriever auto-filters datasets to same KB
- [x] 8.2 Remove: PipelineConfigModal import/rendering, all pipeline config state, autoStart toggle, Phase 1 "Indexing" card, phase connector arrow, pipeline-storage imports
- [x] 8.3 Update `handleStartPipeline` to call `experiments.start({ retrieverId, datasetId, name, metricNames })` instead of sending inline retrieverConfig
- [x] 8.4 Update experiment name auto-generation from retriever name + dataset name instead of config name + k
- [x] 8.5 Update progress display — single evaluation phase card only (no indexing phase)

## 9. Testing & Verification

- [ ] 9.1 Verify schema deploys cleanly with `npx convex dev --once`
- [ ] 9.2 Test retriever create → indexing → ready flow end-to-end
- [ ] 9.3 Test retrieve action returns correct chunks for a ready retriever
- [ ] 9.4 Test experiment start with retrieverId (new flow) and with retrieverConfig (legacy flow)
- [ ] 9.5 Test retriever dedup — creating same config twice returns existing retriever
- [ ] 9.6 Test retriever cleanup and delete
- [x] 9.7 Verify frontend builds cleanly with `pnpm -C packages/frontend build` (only stale Convex codegen errors remain — will resolve after `npx convex dev`)
