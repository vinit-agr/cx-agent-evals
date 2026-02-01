## 1. Types and Shared Definitions

- [x] 1.1 Add `Dimension`, `StrategyType`, and updated `GenerateConfig` types to `frontend/src/lib/types.ts`

## 2. API Endpoints

- [x] 2.1 Create `frontend/src/app/api/discover-dimensions/route.ts` — accepts URL, calls `discoverDimensions()`, returns dimensions JSON
- [x] 2.2 Update `frontend/src/app/api/generate/route.ts` — accept `strategy`, `dimensions`, `totalQuestions` params; use `DimensionDrivenStrategy` when strategy is "dimension-driven"; write temp dimensions file, clean up after

## 3. Strategy Selector Component

- [x] 3.1 Create `frontend/src/components/StrategySelector.tsx` — two compact selectable cards ("Simple" and "Dimension-Driven") with accent highlight on selection

## 4. Dimension Wizard Modal

- [x] 4.1 Create `frontend/src/components/DimensionWizard.tsx` — modal overlay with 3-step wizard, step indicator, Back/Next/Close navigation
- [x] 4.2 Implement Step 1 (Discovery) — URL input, "Discover Dimensions" button with loading state, "Skip — define manually" link
- [x] 4.3 Implement Step 2 (Review & Edit) — editable dimension list with name/description inputs, value tags with add/remove, add/remove dimensions, validation before advancing
- [x] 4.4 Implement Step 3 (Configure & Save) — dimension summary, total questions input, "Save & Close" button that passes dimensions + totalQuestions to parent

## 5. Dimension Summary Component

- [x] 5.1 Create `frontend/src/components/DimensionSummary.tsx` — compact display of configured dimensions (count, names) with "Edit" button that re-opens wizard at Step 2

## 6. Wire Into GenerateConfig and Page

- [x] 6.1 Update `frontend/src/components/GenerateConfig.tsx` — integrate StrategySelector, show conditional config (simple inline vs dimension summary), pass strategy-specific params to onGenerate
- [x] 6.2 Update `frontend/src/app/page.tsx` — add state for strategy, dimensions, totalQuestions, wizardOpen; update handleGenerate to send strategy-specific request body

## 7. Build and Verify (initial)

- [x] 7.1 Rebuild the `rag-evaluation-system` package (`npm run build`) and reinstall in frontend
- [x] 7.2 Verify simple strategy still works end-to-end (no regression)
- [x] 7.3 Verify dimension-driven flow works: discover → edit → generate

## 8. Backend: Progress callback and per-document batching

- [x] 8.1 Add `ProgressCallback` type to `strategies/types.ts` and optional `onProgress` to `DimensionDrivenStrategyOptions`
- [x] 8.2 Update `DimensionDrivenStrategy.generate()` to emit phase progress events via callback and batch question generation per document
- [x] 8.3 Export new types from `synthetic-datagen/index.ts` and `src/index.ts`

## 9. Frontend: Stream phase events and per-doc questions

- [x] 9.1 Update `/api/generate` route to decompose dimension-driven flow: call strategy with progress callback, stream phase events and per-doc question batches via SSE
- [x] 9.2 Add `phase` SSE event type to `page.tsx` stream parser, add `phaseName` state
- [x] 9.3 Update `QuestionList` to show current phase status when generating

## 10. Build and Verify (streaming)

- [x] 10.1 Rebuild package, reinstall in frontend, verify Next.js build passes
- [x] 10.2 Verify dimension-driven flow shows phase progress and streams questions per document

## 11. Parallelize pipeline LLM calls

- [x] 11.1 Parallelize pairwise filter calls in `filtering.ts` with `Promise.all`
- [x] 11.2 Parallelize document summarization calls in `relevance.ts` with `Promise.all`
- [x] 11.3 Parallelize combo assignment batch calls in `relevance.ts` with `Promise.all`
- [x] 11.4 Rebuild package, run tests (22/22 pass), reinstall in frontend

## 12. Persist dimension config in localStorage

- [x] 12.1 Save `{ dimensions, totalQuestions }` to localStorage on wizard save
- [x] 12.2 Load saved config on page mount, auto-select dimension-driven strategy if config exists
- [x] 12.3 Verify Next.js build passes
