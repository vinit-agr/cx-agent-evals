## Context

The RAG evaluation system currently runs all backend logic in Next.js API routes (`packages/frontend/src/app/api/`). There are 9 routes — 3 use SSE streaming for long-running operations (question generation, experiment execution, dataset upload) and 6 return regular JSON. All routes run server-side in Node.js.

Two routes (`/api/browse`, `/api/corpus/load`) access the local filesystem, making the app non-deployable to cloud. The remaining routes call external APIs (OpenAI, LangSmith) or import eval-lib for computation.

There is no persistence between sessions, no multi-user support, and no way to recover from mid-pipeline failures. The eval-lib has 4 files with Node-specific imports (`node:fs`, `node:path`, `node:crypto`) that need refactoring.

## Goals / Non-Goals

**Goals:**
- Org-scoped persistence — all resources belong to a Clerk organization, not individual users
- Cloud-deployable — no filesystem dependencies, users upload files via browser
- Resumable pipelines — long-running operations survive timeouts, failures, and browser disconnects via batch checkpointing
- Real-time progress — reactive queries replace SSE streaming
- Scale to 1000s of documents and 1000s of questions per job
- Keep eval-lib as an independent, runtime-agnostic library

**Non-Goals:**
- Replacing LangSmith entirely — keep as sync target for their comparison UI
- Building a custom auth system — use Clerk's hosted auth
- Rewriting eval-lib strategies — adapt their interfaces (accept data instead of file paths) but keep core logic unchanged
- Role-based access control within orgs — all org members have full access for now
- Real-time collaborative editing — single-user operation within org context

## Decisions

### 1. Convex as sole backend (no Next.js API routes)

**Decision:** Remove all 9 Next.js API routes. All backend logic lives in Convex functions (queries, mutations, actions).

**Why over keeping Next.js routes alongside Convex:** Two backend systems creates confusion about where logic lives, duplicates auth handling, and complicates deployment. Convex provides everything needed — database, file storage, compute, scheduling, real-time.

**Why over traditional Express/Fastify + database:** Convex provides real-time reactive queries, built-in file storage, scheduled functions, and zero infrastructure management. Much faster to iterate on than managing a server + database + deployment pipeline.

### 2. Clerk organizations for resource scoping

**Decision:** Every resource (knowledgeBase, dataset, experiment, etc.) carries an `orgId` from Clerk. Auth context is extracted from JWT claims, not client parameters.

**Why organizations over users:** B2B product — resources belong to teams, not individuals. Clerk orgs provide the multi-tenancy boundary. The `orgId` in the JWT is cryptographically signed and cannot be spoofed by clients.

**Why Clerk over Convex Auth or custom:** Clerk provides hosted login UI, org management, member invitations, and JWT templates purpose-built for Convex. Eliminates building auth flows from scratch.

### 3. Batch-checkpointed action pipeline with watchdog recovery

**Decision:** Long-running operations are broken into batch actions processing N items each. Each item's result is persisted individually via `ctx.runMutation()`. A `jobs` table tracks overall progress, and a `jobItems` table tracks per-item status. Each batch schedules a watchdog mutation as a safety net.

**Why over single long-running actions:** Convex actions timeout at 10 minutes. A dimension-driven generation over 1000 docs with 5000 questions would take ~6 hours. Must be broken into hundreds of small actions.

**Why per-item checkpointing over batch-level cursors:** If an action dies mid-batch (timeout, OOM, transient API error), only the in-progress item is lost — all previously completed items in the batch survive. Next batch action queries for `status: "pending"` items, naturally skipping completed ones.

**Why watchdog mutations:** If an action times out before scheduling its continuation, the pipeline stalls silently. A delayed watchdog mutation (scheduled at batch start, fires after 11 minutes) detects this stall and re-schedules the batch.

**Batch sizing:** Self-imposed 8-minute time budget per action (2-minute safety margin). Process items until budget exhausted, then schedule continuation. Typical batch: 20-40 LLM calls per action.

### 4. Native Convex vector index over @convex-dev/rag component

**Decision:** Use Convex's built-in `vectorIndex` on a `documentChunks` table, with custom chunking via eval-lib's `RecursiveCharacterChunker`.

**Why over @convex-dev/rag:** The RAG component doesn't preserve character-level `start`/`end` positions, which are fundamental to the span-based evaluation system. Every chunk must carry its character offset for metrics to work. Custom table gives full control over the schema.

**Why over external vector DB (Pinecone, Weaviate):** Keeping everything in Convex simplifies the architecture — one system for data, compute, and vector search. Convex vector search supports filtering by `kbId`, which naturally scopes search to a knowledge base.

### 5. LangSmith hybrid sync (fire-and-forget)

**Decision:** Convex DB is the source of truth for datasets and experiment results. After creation, a background action syncs to LangSmith. Sync status is tracked per-resource (`synced`, `pending`, `failed`). Sync failures don't block the primary flow.

**Why not LangSmith as source of truth:** Creates an external dependency for core operations. If LangSmith is down, the system stops working. With Convex as truth, LangSmith is a nice-to-have visualization layer.

**Why not drop LangSmith entirely:** Their experiment comparison UI is valuable and would take significant effort to replicate. Hybrid gives the best of both.

### 6. File upload replacing filesystem access

**Decision:** Users upload `.md` files via browser. Files go to Convex file storage (`_storage`). A follow-up action extracts text content and stores it in the `documents` table. No filesystem access from any backend function.

**Why not keep filesystem access for local dev:** Maintaining two code paths (filesystem for dev, upload for prod) doubles complexity. File upload works in all environments consistently.

### 7. eval-lib refactoring approach

**Decision:** Minimal, targeted changes to 4 files. Replace `node:fs/promises` imports with parameter-based alternatives (accept data instead of file paths). Replace `node:crypto` with Web Crypto API. Keep `corpusFromFolder` for CLI/test use but don't call it from frontend or backend.

**Why not fork eval-lib for Convex:** Maintaining two versions is worse than making the library runtime-agnostic. The changes are small (6 import replacements across 4 files) and benefit all consumers.

### 8. File splitting for `"use node"` constraint

**Decision:** Split Convex functions into paired files — a regular file for mutations/queries and a `"use node"` file for actions. Example: `rag.ts` (mutations/queries) + `ragActions.ts` (actions).

**Why:** Convex enforces that files with the `"use node"` directive can ONLY contain actions (`action`/`internalAction`). Mutations and queries must be in separate files without `"use node"`. This is a hard constraint of the Convex bundler — mixing them causes deployment errors.

**File pairs in this project:**
- `rag.ts` (insertChunk, deleteDocumentChunks, deleteKbChunks, isIndexed, fetchChunksWithDocs) + `ragActions.ts` (indexSingleDocument helper)
- `experiments.ts` (start, byDataset, get, updateStatus, getInternal) + `experimentActions.ts` (runIndexing, runEvaluation, runAggregation)
- `generation.ts` (start mutation) + `generationActions.ts` (strategy actions)
- `langsmithSync.ts` (sync actions) — standalone `"use node"` file (no paired queries needed)

### 9. Vector search hydration pattern

**Decision:** `ctx.vectorSearch()` is called in the action, then results are hydrated via an `internalQuery` that fetches full records by ID.

**Why:** Convex's `ctx.vectorSearch()` is only available in actions (ActionCtx), not in queries or mutations. The query `fetchChunksWithDocs` takes an array of chunk IDs (from vectorSearch results) and returns full chunk records with the parent document's `docId` joined.

**Pattern:**
```typescript
// In action:
const searchResults = await ctx.vectorSearch("documentChunks", "by_embedding", { vector, limit: k, filter });
const chunks = await ctx.runQuery(internal.rag.fetchChunksWithDocs, { ids: searchResults.map(r => r._id) });
```

### 10. Storage access in mutations via URL fetch

**Decision:** Mutations read file content via `ctx.storage.getUrl(storageId)` + `fetch(url)` instead of `ctx.storage.get(storageId)`.

**Why:** `ctx.storage.get()` (which returns a Blob) is only available in actions. In mutations, we use `getUrl()` to get a temporary URL, then `fetch()` to read the content. This works because Convex mutations can call `fetch()`.

### 11. Clerk auth config for Convex

**Decision:** Added `convex/auth.config.ts` with a default export specifying the Clerk JWT issuer domain via `process.env.CLERK_JWT_ISSUER_DOMAIN` environment variable.

**Why:** Convex requires an `auth.config.ts` file to validate JWT tokens from external auth providers. The `CLERK_JWT_ISSUER_DOMAIN` must be set in the Convex dashboard environment variables (not in local `.env` files). The `applicationID: "convex"` must match the Clerk JWT template name.

### 12. Frontend Convex API imports via path alias

**Decision:** Frontend's `tsconfig.json` defines `@convex/*` path alias pointing to `../backend/convex/*`, allowing `import { api } from "@convex/_generated/api"`.

**Why:** In a monorepo, the frontend needs to import Convex's generated API types from the backend package. A TypeScript path alias is the cleanest solution — no extra build step needed.

### 13. Graceful fallback when Clerk/Convex not configured

**Decision:** `ConvexClientProvider` checks for `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at render time. If either is missing, it renders a "Setup Required" UI instead of crashing.

**Why:** During development or first-time setup, Clerk keys may not be configured yet. The fallback prevents build failures and gives clear instructions for what env vars are needed.

## Risks / Trade-offs

**[Risk] Convex action 1000-operation limit** → Actions can make at most 1000 `ctx.runMutation`/`ctx.runQuery`/`fetch` calls. With per-item checkpointing, a batch of 40 items = 40+ mutations. Well within limit per action, but batch sizes must stay under ~200 items to be safe.

**[Risk/Materialized] eval-lib bundling in Convex runtime** → The OpenAI SDK types between the version used by eval-lib and Convex's bundled version are slightly incompatible. Resolved with `as any` cast when passing the OpenAI client to eval-lib's `openAIClientAdapter`. The `"use node"` constraint also required splitting files that mix mutations with Node.js imports.

**[Risk] Vector index dimension lock-in** → Convex vector indexes are configured with a fixed dimension count (1536 for OpenAI text-embedding-3-small). Changing embedding models requires re-indexing all chunks. Mitigated by storing embedding model name in chunk metadata.

**[Risk] Large document content in DB** → Storing full markdown content in the `documents` table works for typical docs (< 100KB). For very large documents (> 1MB), may need to split into sub-documents or use file storage references. Start simple, optimize if needed.

**[Risk] Watchdog false positives** → If an action is legitimately slow (not stalled), the watchdog might re-schedule a duplicate batch. Mitigated by checking job phase + progress count in the watchdog, and by making batch processing idempotent (querying for pending items skips completed ones).

**[Trade-off] No offline/local mode** → Users can no longer point at a local folder. Must upload files through the browser. Drag-and-drop file upload is implemented for better UX.

**[Trade-off] Pipeline latency** → Chained actions add small scheduling overhead (~100ms between actions). For 300+ action chains, this adds ~30 seconds total. Negligible compared to LLM call latency.

## Resolved Questions

1. **Convex package placement:** Resolved — `convex/` directory lives inside `packages/backend/`. Works correctly in the pnpm monorepo. The backend package is `@rag-eval/backend` and the `convex dev` command runs from that directory.

2. **Clerk JWT custom claims:** Resolved — Clerk's Convex JWT template includes `org_id` and `org_role` as custom claims in the identity object. The `getAuthContext()` helper extracts them by casting `identity` to `Record<string, unknown>` and reading `org_id` and `org_role` properties. This works with Clerk's default Convex JWT template.

3. **Embedding model configurability:** Resolved — Fixed at 1536 dimensions (OpenAI `text-embedding-3-small`) for now. The vector index is defined with `dimensions: 1536`. Changing models would require re-indexing. The model name is parameterized in the action code so it can be changed per-call, but the vector index dimension is fixed in the schema.
