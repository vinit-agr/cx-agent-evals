## Context

The frontend is a Next.js 16 app with custom-built components, Tailwind CSS v4, and a dark monospaced design system. The current generation flow is: Mode Select → Load Corpus → GenerateConfig (queriesPerDoc + chunker settings) → Generate → View Results. All state lives in `page.tsx` via React hooks.

The backend now supports two strategies (`SimpleStrategy` and `DimensionDrivenStrategy`) via the `generate()` function. A `discoverDimensions()` function auto-discovers dimensions from a URL. These need to be exposed in the frontend.

## Goals / Non-Goals

**Goals:**
- Let users choose between Simple and Dimension-Driven strategies
- Provide a wizard modal for the dimension-driven setup flow (discover → review/edit → configure budget)
- Show a configured summary in the sidebar after wizard completion with an Edit button to re-open the wizard
- Add a `/api/discover-dimensions` endpoint
- Update `/api/generate` to accept strategy-specific parameters

**Non-Goals:**
- Wizard for the simple strategy (it stays as inline config)
- Dimension-driven strategy without auto-discovery (manual-only creation) — auto-discovery is the entry point, manual editing happens in step 2

## Decisions

### Decision 1: Strategy selector as toggle cards in sidebar

Two small cards in the GenerateConfig area, styled like the ModeSelect cards but compact. Selecting "Simple" shows the existing queriesPerDoc input inline. Selecting "Dimension-Driven" shows a summary if configured, or a "Set Up Dimensions" button if not.

**Alternative considered:** Dropdown select. Rejected because the two-card pattern is already established in the app (ModeSelect) and provides better visual affordance.

### Decision 2: Wizard as modal overlay (3 steps)

The dimension-driven setup uses a modal wizard with 3 steps:

- **Step 1 — Discover:** URL input + "Discover" button. Loading state during LLM processing. "Skip — define manually" link adds one empty dimension.
- **Step 2 — Review & Edit:** List of dimensions, each expandable with editable name, description, and value tags. Add/remove dimensions. Add/remove values. This is the core editing surface.
- **Step 3 — Configure:** Total questions input + summary of dimension counts + "Generate" or "Save & Close" button.

The wizard modal follows the existing FolderBrowser modal pattern: fixed overlay, backdrop blur, centered card.

**Alternative considered:** Inline sidebar accordion. Rejected — 320px is too narrow for editing dimension names, descriptions, and value lists.

### Decision 3: State management stays in page.tsx

Add new state: `strategy` ("simple" | "dimension-driven"), `dimensions` (array), `totalQuestions` (number), `wizardOpen` (boolean). No global state library needed — the state is localized to the generation flow.

### Decision 4: Dimension types shared between frontend and backend

Define a `Dimension` interface in `frontend/src/lib/types.ts` matching the backend's shape: `{ name: string, description: string, values: string[] }`. The API endpoints send/receive this shape directly.

### Decision 5: API endpoints

**`POST /api/discover-dimensions`** — Non-streaming. Accepts `{ url: string }`, returns `{ dimensions: Dimension[] }`. Uses the backend's `discoverDimensions()`. May take 10-30 seconds, so the frontend shows a loading state.

**`POST /api/generate`** — Updated to accept:
```typescript
{
  folderPath: string;
  mode: "chunk" | "token";
  strategy: "simple" | "dimension-driven";
  // Simple strategy:
  questionsPerDoc?: number;
  // Dimension-driven strategy:
  dimensions?: Dimension[];
  totalQuestions?: number;
  // Shared (chunk mode):
  chunkSize?: number;
  chunkOverlap?: number;
}
```

When strategy is "dimension-driven", the route writes dimensions to a temp file, creates a `DimensionDrivenStrategy`, and passes it to `generate()`. Streaming behavior stays the same.

### Decision 6: Wizard re-entry for editing

After the wizard completes, the sidebar shows a compact summary: dimension count, value count, and an "Edit" button. Clicking "Edit" re-opens the wizard at Step 2 (Review & Edit) with the previously configured dimensions pre-loaded. The user can navigate forward/backward within the wizard.

### Decision 7: Streaming progress and per-document question batching

The dimension-driven pipeline has a long silent phase (filtering, relevance matrix, sampling) before questions are generated. Two improvements:

**Phase progress events (Option 1):** The backend `DimensionDrivenStrategy` accepts an `onProgress` callback. It emits phase events during pipeline stages (filtering, summarizing, assigning relevance, sampling, generating). The API route forwards these as SSE events. The frontend shows them as a status line in the QuestionList panel.

**Per-document question batching (Option 4):** Instead of generating one question per LLM call (50 calls for 50 questions), group sampled assignments by document. For each document, generate all its questions in a single LLM call (send doc content once, ask for N questions). Then assign ground truth per question and stream results per document batch. This reduces LLM calls (doc content sent once instead of N times) and gives natural per-document streaming.

**Alternative considered:** Per-question streaming (Option 3). Rejected because it sends the same doc content N times in separate LLM calls, costing more tokens with no material UX improvement over per-document batches.

### Decision 8: Parallelized LLM calls in pipeline stages

The filtering, summarization, and combo assignment stages originally ran sequential `for` loops with `await` inside each iteration. Since each call within a stage is independent, they are now parallelized with `Promise.all`:

- **Pairwise filtering**: All dimension-pair filter calls run concurrently
- **Document summarization**: All document summaries run concurrently
- **Combo-to-doc assignment**: All assignment batches run concurrently

This reduces pipeline latency from `O(N)` sequential round-trips per stage to a single round-trip (bounded by the slowest call in each group).

### Decision 9: Persist dimension config in localStorage

Dimension configuration is saved to `localStorage` under the key `rag-eval:dimension-config` as `{ dimensions, totalQuestions }`. On page mount, if saved config exists, it is restored and the strategy is auto-set to "dimension-driven". This avoids re-running discovery or manually re-entering dimensions after a page refresh or app restart.

**Alternative considered:** Backend file or database. Rejected — unnecessary complexity for a single-user local tool. localStorage is sufficient and requires zero backend changes.

## Risks / Trade-offs

- **[Discovery latency]** → Auto-discovery fetches a website + makes LLM calls, taking 10-30s. Mitigation: clear loading state with progress text in the wizard.
- **[Temp file for dimensions]** → The generate route writes dimensions to a temp file because `DimensionDrivenStrategy` reads from a file path. Mitigation: use a temp directory, clean up after generation. Could be refactored later to accept dimensions directly.
- **[Wizard complexity]** → Step 2 (dimension editor) is the most complex UI in the app. Mitigation: keep it simple — text inputs for name/description, tag-style chips for values with add/remove.
- **[Batch generation quality]** → Generating multiple questions in one LLM call may slightly reduce individual question quality vs one-at-a-time. Mitigation: keep batch sizes reasonable (per-document grouping is natural), include per-question profiles in the prompt.
