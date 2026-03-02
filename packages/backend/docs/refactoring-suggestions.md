# Refactoring Suggestions

> Actionable improvements for backend code health, structure, testability, and maintainability.

[Back to Architecture Overview](./architecture.md) | [Frontend Changes After Refactor](./frontend-changes-after-backend-refactor.md)

---

## Table of Contents

1. [Guiding Principle: Separation of Concerns](#1-guiding-principle-separation-of-concerns)
2. [Two-Package Architecture](#2-two-package-architecture)
3. [Convex Directory Reorganization](#3-convex-directory-reorganization)
4. [Dead Code & Deprecation Cleanup](#4-dead-code--deprecation-cleanup)
5. [Code Duplication Elimination](#5-code-duplication-elimination)
6. [Type Safety Improvements](#6-type-safety-improvements)
7. [Naming & Readability](#7-naming--readability)
8. [Unused Dependencies & Import Cleanup](#8-unused-dependencies--import-cleanup)
9. [Schema & Validator Improvements](#9-schema--validator-improvements)
10. [Architectural Refinements](#10-architectural-refinements)
11. [Testing Strategy](#11-testing-strategy)
12. [Priority Roadmap](#12-priority-roadmap)

---

## 1. Guiding Principle: Separation of Concerns

The backend mixes three layers of code in the same files:

1. **Convex orchestration** — mutations, queries, actions, WorkPool callbacks. These use Convex primitives (`ctx`, `v.object`, `internalMutation`, etc.) and **must** live in the `convex/` directory.
2. **External SDK wrappers** — LangSmith experiment runner, dataset uploader, OpenAI embedder factory. Pure Node.js code with zero Convex dependency.
3. **Bridge/adapter code** — converting between Convex DB records and eval-lib types (building `Corpus` from documents, creating `CallbackRetriever` backed by vector search).

The worst example is `experimentActions.ts` (489 lines) which contains 127 lines of inlined LangSmith code, a duplicated `createEmbedder()`, the experiment orchestrator, and the evaluation runner — all in one file.

**The goal**: establish a clear boundary so that:
- Convex files contain **only** Convex-specific orchestration
- Pure TypeScript / external SDK code lives in a separate workspace package
- Anyone new can immediately tell "this is Convex code" vs "this is just TypeScript"
- The non-Convex code is independently testable with simple mocks
- The codebase is structured to be portable (the non-Convex layer could theoretically run on Express, Fastify, etc.)

---

## 2. Two-Package Architecture

### Design

Split the backend into two packages:

**`packages/backend-lib/`** — Pure TypeScript + external SDK code. Zero Convex dependency.

**`packages/backend/convex/`** — Convex-specific orchestration only. Thin wrappers that import from `@rag-eval/backend-lib`.

The boundary rule: **if a function doesn't need `ctx` (Convex context), it belongs in backend-lib.**

This mirrors how the backend already imports from `rag-evaluation-system` (the eval-lib workspace package). The Convex bundler resolves workspace packages via `node_modules` — this is a proven, first-class pattern.

### `backend-lib/` Package Structure

```
packages/backend-lib/
├── src/
│   ├── langsmith/
│   │   ├── client.ts              # getLangSmithClient()
│   │   ├── experiment.ts          # runLangSmithExperiment(), evaluator helpers, types
│   │   ├── upload.ts              # uploadDataset(), UploadOptions, UploadResult
│   │   └── index.ts              # barrel export
│   ├── embedder.ts               # createEmbedder() — single copy, replaces 4 duplicates
│   ├── llm.ts                    # createLLMClient() — OpenAI adapter for eval-lib LLMClient
│   ├── config.ts                 # getModel(), config resolution helpers
│   ├── corpus.ts                 # buildCorpusFromDocs() — raw doc records → eval-lib Corpus
│   ├── types.ts                  # JobStatus, SerializedSpan, ExperimentResult
│   ├── constants.ts              # EMBED_BATCH_SIZE, CLEANUP_BATCH_SIZE, BATCH_SIZE, TIER_PARALLELISM
│   └── index.ts                  # root barrel export
├── tests/                        # Pure unit tests (no Convex needed)
│   ├── langsmith/
│   │   ├── experiment.test.ts    # Mock LangSmith evaluate(), test evaluator creation
│   │   └── upload.test.ts        # Mock LangSmith client, test batch upload
│   ├── embedder.test.ts          # Mock OpenAI, test error handling
│   ├── corpus.test.ts            # Test corpus building from raw doc records
│   └── config.test.ts            # Test config resolution
├── package.json                  # "@rag-eval/backend-lib"
├── tsconfig.json
└── tsup.config.ts
```

### What Moves

| Currently In | Moves To | What |
|---|---|---|
| `experimentActions.ts` lines 28-154 | `backend-lib/src/langsmith/experiment.ts` | `runLangSmithExperiment()`, `createLangSmithEvaluator()`, `createLangSmithEvaluators()`, `ExperimentResult`, `SerializedSpan`, `deserializeSpans()`, `LangSmithExperimentConfig`, `DEFAULT_METRICS` |
| `langsmithSync.ts` lines 15-102 | `backend-lib/src/langsmith/upload.ts` | `uploadDataset()`, `UploadProgress`, `UploadOptions`, `UploadResult` |
| `lib/langsmith.ts` (4 lines) | `backend-lib/src/langsmith/client.ts` | `getLangSmithClient()` |
| `lib/llm.ts` (20 lines) | `backend-lib/src/llm.ts` | `createLLMClient()` |
| 4 copies of `createEmbedder()` | `backend-lib/src/embedder.ts` | Single `createEmbedder()` |
| `generationActions.ts` `getModel()` | `backend-lib/src/config.ts` | Config resolution helpers |
| `generation.ts` `JobStatus` type | `backend-lib/src/types.ts` | Shared `JobStatus` type |
| Magic numbers across action files | `backend-lib/src/constants.ts` | `EMBED_BATCH_SIZE`, `CLEANUP_BATCH_SIZE`, `BATCH_SIZE`, `TIER_PARALLELISM` |

### What Stays in Convex

- `loadCorpusFromKb()` — needs `ctx.runQuery` to fetch documents from Convex
- `CallbackRetriever` creation — needs `ctx.vectorSearch` for Convex vector search
- All mutations, queries, actions — Convex primitives
- WorkPool callbacks — Convex-specific
- Auth (`getAuthContext`) — uses Convex ctx
- Schema, validators — Convex value system

### Package Wiring

```json
// packages/backend-lib/package.json
{
  "name": "@rag-eval/backend-lib",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "rag-evaluation-system": "workspace:*",
    "openai": "^4.x",
    "langsmith": "^0.x",
    "@langchain/core": "^0.x"
  }
}
```

```json
// packages/backend/package.json (add dependency)
{
  "dependencies": {
    "@rag-eval/backend-lib": "workspace:*"
  }
}
```

```json
// packages/backend/convex.json (add to externalPackages)
{
  "node": {
    "externalPackages": ["langsmith", "@langchain/core", "openai", "@rag-eval/backend-lib"]
  }
}
```

```yaml
# pnpm-workspace.yaml (add entry)
packages:
  - "packages/backend-lib"
```

### Impact on `experimentActions.ts`

Before: **489 lines** (inlined LangSmith code + duplicate embedder + orchestration + evaluation).

After: **~250 lines** (pure Convex orchestration + bridge code):

```typescript
"use node";
import { createEmbedder, runLangSmithExperiment, buildCorpusFromDocs } from "@rag-eval/backend-lib";
import { CallbackRetriever, DocumentId, PositionAwareChunkId, positionAwareChunkToSpan } from "rag-evaluation-system";
// ... Convex imports

// runExperiment — orchestrator (setup, indexing wait, sync, enqueue)
// runEvaluation — builds CallbackRetriever, delegates to runLangSmithExperiment()
```

---

## 3. Convex Directory Reorganization

### Rationale

Convex supports nested directories with file-based routing. A function `h` in `convex/foo/bar.ts` is referenced as `api.foo.bar.h` (public) or `internal.foo.bar.h` (internal). This is first-class and well-documented.

Currently all 26 source files sit flat in `convex/`. Reorganizing into domain folders makes the module boundaries explicit.

### Proposed Layout

```
packages/backend/convex/
├── schema.ts                      # Root (Convex requirement)
├── auth.config.ts                 # Root (Convex requirement)
├── convex.config.ts               # Root (WorkPool registration)
├── crons.ts                       # Root (Convex cron requirement)
├── test.setup.ts                  # Root
│
├── lib/                           # Shared Convex-specific helpers
│   ├── auth.ts                    # getAuthContext(), lookupUser()
│   ├── validators.ts              # shared spanValidator
│   └── workpool.ts                # shared applyResult()/counterPatch() helpers
│
├── generation/                    # Question generation module
│   ├── orchestration.ts           # startGeneration, callbacks, cancel, queries
│   └── actions.ts                 # "use node" strategy actions + GT assignment
│
├── retrieval/                     # Indexing + chunks
│   ├── indexing.ts                # Indexing orchestration + callbacks
│   ├── indexingActions.ts         # "use node" two-phase indexing + cleanup
│   ├── retrieverActions.ts        # "use node" create/startIndexing/retrieve
│   └── chunks.ts                  # Chunk CRUD (currently rag.ts)
│
├── experiments/                   # Experiment module
│   ├── orchestration.ts           # Start, enqueue, cancel, onComplete, queries
│   ├── actions.ts                 # "use node" runExperiment + runEvaluation
│   └── results.ts                 # Per-question result mutations/queries
│
├── crud/                          # Data layer CRUD
│   ├── knowledgeBases.ts
│   ├── documents.ts
│   ├── datasets.ts
│   ├── questions.ts
│   ├── users.ts
│   └── retrievers.ts             # Retriever CRUD + status sync
│
└── langsmith/                     # LangSmith Convex wrappers
    ├── sync.ts                    # Dataset sync action (thin: delegates to backend-lib)
    ├── retry.ts                   # Manual retry mutation
    └── syncRetry.ts               # Cron-driven auto-retry
```

### API Path Changes

All `internal.*` and `api.*` references change when files move. The `_generated/api.ts` auto-regenerates, but **all call sites** must be updated.

| Before (flat) | After (nested) |
|---|---|
| `api.generation.startGeneration` | `api.generation.orchestration.startGeneration` |
| `api.generation.getJob` | `api.generation.orchestration.getJob` |
| `internal.generationActions.generateForDocument` | `internal.generation.actions.generateForDocument` |
| `internal.generationActions.assignGroundTruthForQuestion` | `internal.generation.actions.assignGroundTruthForQuestion` |
| `api.indexing.getJob` | `api.retrieval.indexing.getJob` |
| `api.indexing.cancelIndexing` | `api.retrieval.indexing.cancelIndexing` |
| `internal.indexingActions.indexDocument` | `internal.retrieval.indexingActions.indexDocument` |
| `internal.indexingActions.cleanupAction` | `internal.retrieval.indexingActions.cleanupAction` |
| `api.retrieverActions.create` | `api.retrieval.retrieverActions.create` |
| `api.retrieverActions.startIndexing` | `api.retrieval.retrieverActions.startIndexing` |
| `api.retrieverActions.retrieve` | `api.retrieval.retrieverActions.retrieve` |
| `internal.rag.insertChunkBatch` | `internal.retrieval.chunks.insertChunkBatch` |
| `internal.rag.fetchChunksWithDocs` | `internal.retrieval.chunks.fetchChunksWithDocs` |
| `api.experiments.start` | `api.experiments.orchestration.start` |
| `api.experiments.byDataset` | `api.experiments.orchestration.byDataset` |
| `api.experiments.get` | `api.experiments.orchestration.get` |
| `internal.experimentActions.runExperiment` | `internal.experiments.actions.runExperiment` |
| `internal.experimentActions.runEvaluation` | `internal.experiments.actions.runEvaluation` |
| `internal.experimentResults.insert` | `internal.experiments.results.insert` |
| `api.knowledgeBases.list` | `api.crud.knowledgeBases.list` |
| `api.knowledgeBases.create` | `api.crud.knowledgeBases.create` |
| `api.documents.create` | `api.crud.documents.create` |
| `api.documents.listByKb` | `api.crud.documents.listByKb` |
| `api.documents.generateUploadUrl` | `api.crud.documents.generateUploadUrl` |
| `api.datasets.list` | `api.crud.datasets.list` |
| `api.datasets.get` | `api.crud.datasets.get` |
| `api.questions.byDataset` | `api.crud.questions.byDataset` |
| `api.users.getOrCreate` | `api.crud.users.getOrCreate` |
| `api.retrievers.byKb` | `api.crud.retrievers.byKb` |
| `api.retrievers.byOrg` | `api.crud.retrievers.byOrg` |
| `api.retrievers.remove` | `api.crud.retrievers.remove` |
| `api.retrievers.deleteIndex` | `api.crud.retrievers.deleteIndex` |
| `api.retrievers.resetAfterCancel` | `api.crud.retrievers.resetAfterCancel` |
| `internal.langsmithSync.syncDataset` | `internal.langsmith.sync.syncDataset` |
| `internal.langsmithSyncRetry.retryFailed` | `internal.langsmith.syncRetry.retryFailed` |

> **Impact**: This changes ~100+ internal references across backend files and ~25 `api.*` references in the frontend. See [Frontend Changes After Backend Refactor](./frontend-changes-after-backend-refactor.md) for the full frontend impact.

### Deleted Files

| File | Reason |
|---|---|
| `ragActions.ts` | Deprecated, no callers. `indexSingleDocument()` replaced by `indexingActions.indexDocument`. |
| `testing.ts` | Empty file. |
| `lib/llm.ts` | Moved to `backend-lib/src/llm.ts`. |
| `lib/langsmith.ts` | Moved to `backend-lib/src/langsmith/client.ts`. |
| `README.md` | Default Convex boilerplate. Replace with link to `docs/`. |

---

## 4. Dead Code & Deprecation Cleanup

### Items to Remove

| Item | File | Reason |
|------|------|--------|
| `ragActions.ts` (entire file) | `ragActions.ts` | Deprecated. `indexSingleDocument()` replaced by `indexingActions.indexDocument`. No callers remain. |
| `rag.insertChunk` | `rag.ts:147-165` | Deprecated. `insertChunkBatch` is the replacement. No callers in current code. |
| `rag.deleteKbChunks` | `rag.ts:189-202` | Deprecated (OOM risk). `deleteKbConfigChunks` is the paginated replacement. |
| `testing.ts` | `testing.ts` | Empty file — just a comment saying old tests were removed. |
| `README.md` | `README.md` | Default Convex boilerplate. Not project-specific documentation. |
| `MAX_AUTO_RETRIES` constant | `langsmithSyncRetry.ts:4` | Declared but never used. |
| Legacy experiment path | `experimentActions.ts:83-141` | The `experiment.retrieverConfig` path with polling loop. If no frontend code uses it, remove. |

### Verification Steps

Before removing any of the above:

```bash
# Check for callers of deprecated functions
grep -r "insertChunk\b" packages/backend/convex/ --include="*.ts"
grep -r "deleteKbChunks\b" packages/backend/convex/ --include="*.ts"
grep -r "indexSingleDocument" packages/backend/convex/ --include="*.ts"
grep -r "retrieverConfig" packages/backend/convex/ --include="*.ts"  # Check legacy path usage
```

---

## 5. Code Duplication Elimination

### 5.1 `createEmbedder()` — 4 Copies → 1

The exact same function appears in `indexingActions.ts`, `retrieverActions.ts`, `experimentActions.ts`, and `ragActions.ts` (deprecated).

**Fix**: Single copy in `backend-lib/src/embedder.ts`. All action files import from `@rag-eval/backend-lib`.

### 5.2 `spanValidator` — 3 Copies → 1

Defined identically in `schema.ts`, `questions.ts`, and `experimentResults.ts`.

**Fix**: Export from `convex/lib/validators.ts`, imported by all three.

### 5.3 `JobStatus` Type — 3 Copies → 1

Defined locally in `generation.ts`, `indexing.ts`, and inline in `experiments.ts`.

**Fix**: Define once in `backend-lib/src/types.ts`.

### 5.4 `applyResult` / `counterPatch` Logic — 2 Copies → 1

The counter-update pattern in `generation.ts` is structurally identical to `indexing.ts:onDocumentIndexed`.

**Fix**: Create a generic helper in `convex/lib/workpool.ts`:
```typescript
export function applyWorkResult<T extends { processed: number; failed: number; skipped: number }>(
  counters: T,
  result: RunResult,
): T { ... }
```

### 5.5 Batch Question Insert — 3 Copies → 1

The `BATCH_SIZE=100` loop for inserting questions is copy-pasted across all three generation actions in `generationActions.ts`.

**Fix**: Extract to a shared helper in `generationActions.ts` or `backend-lib/src/constants.ts` for the constant + inline a single helper function.

### 5.6 Vector Search Pattern — 2 Copies → 1

The "embed query → vectorSearch → fetchChunksWithDocs → post-filter by indexConfigHash → take topK" pipeline appears in both `retrieverActions.ts` and `experimentActions.ts`.

**Fix**: Extract the common logic into a shared helper in `convex/retrieval/` that both call sites use.

### 5.7 User Lookup Pattern — 3 Copies → 1

The `ctx.db.query("users").withIndex("by_clerk_id", ...).unique()` pattern appears in `knowledgeBases.ts`, `generation.ts`, and `experiments.ts`.

**Fix**: Extract to `convex/lib/auth.ts` as `lookupUser(ctx, userId)`.

### 5.8 Test Helpers — Duplicated Across Test Files

`seedUser`, `seedKB`, `seedDataset`, `setupTest`, `TEST_ORG_ID`, `TEST_CLERK_ID`, `testIdentity` are copy-pasted between `generation.test.ts` and `experiments.test.ts`.

**Fix**: Extract to `tests/helpers.ts`.

---

## 6. Type Safety Improvements

### 6.1 Excessive Use of `v.any()`

| Field | Table | Better Type |
|-------|-------|-------------|
| `metadata` | knowledgeBases, documents, datasets, questions, experimentResults | `v.record(v.string(), v.any())` or specific shape |
| `strategyConfig` | datasets | `v.union(simpleConfig, dimensionConfig, rwgConfig)` |
| `retrieverConfig` | retrievers, experiments | Define a `PipelineConfig` validator |
| `scores` | experiments, experimentResults | `v.record(v.string(), v.number())` |
| `indexConfig` | indexingJobs | Define an `IndexConfig` validator |

### 6.2 Type Assertions in Actions

Strategy config is cast with `as Record<string, unknown>` throughout `generationActions.ts` and `experimentActions.ts`. Proper validators would replace these casts with typed access.

### 6.3 `status` Uses `v.string()` in Internal Mutations

`experiments.updateStatus` accepts `status: v.string()` — should use `v.union(...)` matching the schema. Same for `retrievers.insertRetriever` and `updateIndexingStatus`.

---

## 7. Naming & Readability

### 7.1 File Renames

| Current | Issue | New Name |
|---------|-------|----------|
| `rag.ts` | Vague. Contains chunk CRUD, not RAG logic. | `retrieval/chunks.ts` |
| `ragActions.ts` | Deprecated and misnamed. | Delete entirely |

### 7.2 Inconsistent Function Naming

| Pattern | Examples | Issue |
|---------|----------|-------|
| Start functions | `startGeneration`, `experiments.start`, `indexing.startIndexing` | Inconsistent: verb+noun vs bare verb |
| Internal variants | `getInternal`, `byDatasetInternal` | Consistent but verbose |

### 7.3 Comments Reference Change IDs

Comments reference cryptic IDs like `I1`, `I3`, `I9`, `C1`, `C3`, `S3`. Expand to self-documenting:

```typescript
// Before:
// I9: Guard against stale Phase 1 callbacks after Phase 2 has started

// After:
// Guard: if Phase 2 has already started, ignore late Phase 1 callbacks
// to prevent counter corruption
```

---

## 8. Unused Dependencies & Import Cleanup

### `minisearch`

Listed in both `package.json` dependencies and `convex.json` externalPackages, but **not imported anywhere** in the backend code. Remove from both.

### eval-lib Import Surface

eval-lib no longer exports LangSmith utilities. The `src/langsmith/` directory was completely removed. The backend should only import from:
- `rag-evaluation-system` (main barrel) — types, strategies, metrics, chunkers, config hashing, `CallbackRetriever`, `openAIClientAdapter`
- `rag-evaluation-system/embedders/openai` — `OpenAIEmbedder` (tree-shakeable)

Other available sub-paths (`./pipeline/internals`, `./utils`, `./rerankers/cohere`) are not currently used by the backend.

---

## 9. Schema & Validator Improvements

### 9.1 Unused Schema Fields

Several fields on `experiments` are declared but never populated:

| Field | Status |
|-------|--------|
| `failedQuestions` | Never written to |
| `skippedQuestions` | Never written to |
| `indexConfigHash` | Never written to from experiments.ts |
| `langsmithExperimentId` | Never written to |
| `langsmithUrl` | Never written to |
| `langsmithSyncStatus` | Never written to |

**Options**: Remove if not planned, or populate them (e.g., capture LangSmith experiment URL from evaluate() results).

### 9.2 Dangling DocStrings

Misplaced docstrings in `datasets.ts:75-76` and `questions.ts:66-67`. Fix by moving/removing.

### 9.3 `indexConfigHash` is Optional on `documentChunks`

The `v.optional()` exists for backward compatibility. If legacy chunks are migrated, make it required.

---

## 10. Architectural Refinements

### 10.1 Polling Loop in Experiment Orchestrator

`experimentActions.runExperiment` (legacy path) polls indexing status with `setTimeout`. Fragile if indexing takes too long. Better approach: scheduler-based phases. Keep as-is unless timeouts occur.

### 10.2 `cancelIndexing` Uses `pool.cancelAll()`

Cancels ALL items in the indexing pool — not just this job's. Fix: store `workIds` on `indexingJobs` and cancel selectively.

### 10.3 LangSmith Sync Retry Full Table Scan

`getFailedDatasets` calls `ctx.db.query("datasets").collect()` without filtering. Add an index on `langsmithSyncStatus`.

### 10.4 `langsmithSyncRetry.ts` Missing `"use node"`

Contains an `internalAction` but is missing the `"use node"` directive. Verify and fix if needed.

---

## 11. Testing Strategy

### Two-Layer Testing

The refactor creates two testable layers:

**Layer 1: `backend-lib` tests** — Pure unit tests, no Convex required:

```
packages/backend-lib/tests/
├── langsmith/
│   ├── experiment.test.ts       # Mock LangSmith evaluate(), test evaluator creation, metric wiring
│   └── upload.test.ts           # Mock LangSmith client, test batch upload, retry behavior
├── embedder.test.ts             # Mock OpenAI, test embedder creation, error handling
├── corpus.test.ts               # Test corpus building from raw doc records
└── config.test.ts               # Test config resolution
```

These are the **easiest tests to write** because they test pure functions with mockable dependencies. No Convex runtime needed. Standard vitest.

**Layer 2: Convex tests** — `convex-test` integration tests:

```
packages/backend/tests/
├── helpers.ts                   # Shared seeders, test identity, setupTest
├── generation.test.ts           # WorkPool callbacks (Phase 1 + 2), queries (existing)
├── experiments.test.ts          # onExperimentComplete, queries (existing)
├── indexing.test.ts             # NEW: onDocumentIndexed, dedup, retriever sync
├── retrievers.test.ts           # NEW: CRUD, shared index protection, status transitions
├── crud.test.ts                 # NEW: KB, document, dataset, question CRUD
├── langsmith.test.ts            # NEW: Sync retry logic
└── workpool-helpers.test.ts     # NEW: Unit test shared counter logic
```

### Current State

| File | Tests | Focus |
|------|-------|-------|
| `generation.test.ts` | 13 | WorkPool callbacks (Phase 1 + 2), getJob query |
| `experiments.test.ts` | 6 | onExperimentComplete callback, get query |
| **Total** | **19** | |

### Coverage Gaps (Prioritized)

#### Critical — Test Before Refactoring

| Area | What to Test |
|------|-------------|
| `indexing.onDocumentIndexed` | Counter updates, completion detection, retriever status sync |
| `indexing.startIndexing` | Dedup logic (running/completed), force re-index |
| `retrievers.remove` | Cascade delete, shared index protection |
| `retrievers.deleteIndex` | Shared index guard, status reset |
| `experiments.start` | Validation (retriever ready, KB match), record creation |

#### Important — Improves Confidence

| Area | What to Test |
|------|-------------|
| `generation.startGeneration` | Dataset + job creation, strategy dispatch |
| `generation.cancelGeneration` | Status guard, selective cancel |
| `questions.insertBatch` | Batch creation |
| `questions.updateSpans` | Span patching |
| `rag.insertChunkBatch` | Bulk insert |
| `rag.patchChunkEmbeddings` | Embedding patching |
| `rag.deleteKbConfigChunks` | Paginated deletion, hasMore flag |

#### Nice to Have

| Area | What to Test |
|------|-------------|
| Auth guards | Every public function rejects unauthenticated/wrong-org calls |
| `langsmithSyncRetry.getFailedDatasets` | Correctly filters by prefix |
| `users.getOrCreate` | Create vs return existing |
| `documents.create` | Content storage, org scoping |

### Testing Principles

1. **backend-lib tests first** — Easiest to write, highest value. The hardest-to-test code (LangSmith, embedder, upload) moves here where it can be tested with simple mocks.
2. **Convex tests for orchestration only** — Test callbacks, status transitions, WorkPool interactions. Don't test LangSmith or OpenAI logic in Convex tests.
3. **Extract shared test helpers** — `tests/helpers.ts` with common seeders, eliminating duplication across test files.
4. **Integration tests later** — Full flow tests (create KB → upload → generate → verify) need action mocking and are lower priority.

---

## 12. Priority Roadmap

### Phase 1: Dead Code Cleanup (Low Risk)

Quick wins that reduce noise before the structural refactor:

- [ ] Remove `ragActions.ts` (deprecated, no callers)
- [ ] Remove `testing.ts` (empty file)
- [ ] Remove `rag.insertChunk` and `rag.deleteKbChunks` (deprecated)
- [ ] Remove `minisearch` from `package.json` and `convex.json`
- [ ] Remove `MAX_AUTO_RETRIES` unused constant
- [ ] Verify no remaining imports from `rag-evaluation-system/langsmith/*`
- [ ] Fix dangling docstrings in `datasets.ts` and `questions.ts`
- [ ] Replace boilerplate `README.md` with link to `docs/`

### Phase 2: Create `backend-lib` Package (Medium Risk)

Extract non-Convex code into a workspace package:

- [ ] Scaffold `packages/backend-lib/` (package.json, tsconfig, tsup.config)
- [ ] Add to `pnpm-workspace.yaml`
- [ ] Move `createEmbedder()` → `backend-lib/src/embedder.ts`
- [ ] Move `createLLMClient()` → `backend-lib/src/llm.ts`
- [ ] Move `getLangSmithClient()` → `backend-lib/src/langsmith/client.ts`
- [ ] Move inlined `runLangSmithExperiment()` → `backend-lib/src/langsmith/experiment.ts`
- [ ] Move inlined `uploadDataset()` → `backend-lib/src/langsmith/upload.ts`
- [ ] Move `getModel()` → `backend-lib/src/config.ts`
- [ ] Move `buildCorpusFromDocs()` → `backend-lib/src/corpus.ts`
- [ ] Consolidate `JobStatus`, `SerializedSpan`, constants → `backend-lib/src/types.ts`, `backend-lib/src/constants.ts`
- [ ] Add `@rag-eval/backend-lib` to backend `package.json` and `convex.json` externalPackages
- [ ] Update all import sites in `convex/` to use `@rag-eval/backend-lib`
- [ ] Delete `convex/lib/llm.ts` and `convex/lib/langsmith.ts`
- [ ] Verify `pnpm build` and `npx convex dev --once` succeed

### Phase 3: Convex Directory Reorganization (Higher Risk)

Move files into domain subfolders. **This changes all `api.*` and `internal.*` paths.**

- [ ] Extract shared helpers: `lib/validators.ts`, `lib/workpool.ts`, `lib/auth.ts` (add `lookupUser`)
- [ ] Create `generation/` — move `generation.ts` → `generation/orchestration.ts`, `generationActions.ts` → `generation/actions.ts`
- [ ] Create `retrieval/` — move `indexing.ts`, `indexingActions.ts`, `rag.ts` → `chunks.ts`
- [ ] Create `experiments/` — move `experiments.ts` → `orchestration.ts`, `experimentActions.ts` → `actions.ts`, `experimentResults.ts` → `results.ts`
- [ ] Create `crud/` — move `knowledgeBases.ts`, `documents.ts`, `datasets.ts`, `questions.ts`, `users.ts`, `retrievers.ts`
- [ ] Create `langsmith/` — move `langsmithSync.ts` → `sync.ts`, `langsmithRetry.ts` → `retry.ts`, `langsmithSyncRetry.ts` → `syncRetry.ts`
- [ ] Move `retrieverActions.ts` → `retrieval/retrieverActions.ts`
- [ ] Update ALL `internal.*` references across all backend files (~100+ references)
- [ ] Update ALL `api.*` references in frontend files (~25 references) — see [Frontend Changes](./frontend-changes-after-backend-refactor.md)
- [ ] Update `crons.ts` references
- [ ] Verify `pnpm build`, `npx convex dev --once`, and frontend build all succeed

### Phase 4: Type Safety & Schema (Medium Risk)

- [ ] Add proper validators for `strategyConfig`, `retrieverConfig`, `scores`
- [ ] Change `status: v.string()` in internal mutations to use union validators
- [ ] Audit `v.any()` fields — replace with specific validators
- [ ] Make `indexConfigHash` required on `documentChunks` (if legacy data migrated)
- [ ] Clean up unused experiment schema fields or populate them

### Phase 5: Testing (No Risk to Production)

- [ ] Add `backend-lib` unit tests (langsmith, embedder, corpus, config)
- [ ] Extract shared convex test helpers to `tests/helpers.ts`
- [ ] Add `indexing.test.ts` — callbacks, dedup, retriever sync
- [ ] Add `retrievers.test.ts` — CRUD, shared index protection
- [ ] Add `workpool-helpers.test.ts` — shared counter logic
- [ ] Expand existing test files (generation, experiments)
- [ ] Add `crud.test.ts` and `langsmith.test.ts`

### Phase 6: Architectural Polish (Long-Term)

- [ ] Fix `cancelIndexing` to use selective cancel (not `cancelAll`)
- [ ] Add index on `datasets.langsmithSyncStatus` for efficient retry queries
- [ ] Consider replacing experiment orchestrator polling with scheduler-based phases
- [ ] Extract common vector search pattern into shared helper
- [ ] Expand change ID comments into self-documenting form
- [ ] Remove legacy experiment path (`retrieverConfig` without `retrieverId`)
