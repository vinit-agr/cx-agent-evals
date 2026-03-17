# Chunk Inspector Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Chunk Inspector for clarity (clean doc view, stats banner, click-to-highlight, parent-child support), fix two bugs (MarkdownViewer `<last>` tag, RecursiveCharacterChunker overlap duplication), and add index→search interaction notes.

**Architecture:** The IndexTab.tsx (~1100 lines) gets a major rewrite: `IndexConfigBanner` → `StatsBanner` with metric cards, `buildSegments`/`renderAnnotatedContent`/`ChunkPill` → click-to-highlight with margin hairlines, `ChunkInspectorPanel` → searchable chunk list + revised detail panel. Backend gets parent-child indexing (metadata-based) and retrieval (child→parent swap). Two independent bug fixes in MarkdownViewer and RecursiveCharacterChunker.

**Tech Stack:** React, TypeScript, Tailwind CSS, Convex (existing); `rehype-sanitize` (new)

**Design doc:** `docs/plans/2026-03-17-chunk-inspector-redesign-design.md`

---

### Task 1: Fix MarkdownViewer `<last>` tag error

**Files:**
- Modify: `packages/frontend/src/components/MarkdownViewer.tsx:294-297`

**Context:** Document content (legal docs) contains non-standard HTML tags like `<last>`, `<first>`. `rehypeRaw` parses them as valid HTML, React creates native DOM elements, browser logs warnings. Fix: add `rehype-sanitize` to strip unknown tags.

**Step 1: Install rehype-sanitize**

Run: `pnpm -C packages/frontend add rehype-sanitize`

**Step 2: Add the import and plugin**

In `packages/frontend/src/components/MarkdownViewer.tsx`, add import after the existing rehype-raw import (line 6):

```tsx
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
```

Then create a permissive schema that allows standard HTML but strips unknown tags. Add after the imports (before `interface MarkdownViewerProps`):

```tsx
/** Allow all standard HTML + GFM elements but strip unknown tags like <last>, <party> */
const sanitizeSchema = {
  ...defaultSchema,
  // Keep rehype-raw's permissiveness for standard elements
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "details", "summary", "mark", "abbr", "sub", "sup",
  ],
};
```

Then update the `rehypePlugins` array on line 296:

Replace:
```tsx
rehypePlugins={[rehypeRaw]}
```

With:
```tsx
rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
```

**Step 3: Build and verify**

Run: `pnpm -C packages/frontend build`
Expected: Compiles successfully.

**Step 4: Commit**

```bash
git add packages/frontend/src/components/MarkdownViewer.tsx packages/frontend/package.json packages/frontend/pnpm-lock.yaml
git commit -m "fix(frontend): add rehype-sanitize to strip unknown HTML tags in MarkdownViewer"
```

---

### Task 2: Fix RecursiveCharacterChunker overlap duplication bug

**Files:**
- Modify: `packages/eval-lib/src/chunkers/recursive-character.ts:128-139`
- Modify: `packages/eval-lib/tests/unit/chunkers/recursive-character.test.ts`

**Context:** When paragraph sizes are near `chunkSize` (e.g., 400/80 config), the overlap retention keeps entire paragraphs, causing merged content to exceed `chunkSize`, triggering recursive re-splitting of already-emitted content — producing duplicate chunks. With 400/80 on 10 docs, this causes 14,109 chunks instead of ~4,500.

**Step 1: Add a failing test**

In `packages/eval-lib/tests/unit/chunkers/recursive-character.test.ts`, add:

```typescript
describe("overlap duplication bug", () => {
  it("should not produce duplicate chunks with paragraph sizes near chunkSize", () => {
    const chunker = new RecursiveCharacterChunker({
      chunkSize: 400,
      chunkOverlap: 80,
    });

    // Two paragraphs of ~300 chars each, separated by \n\n
    const paraA = "A".repeat(298);
    const paraB = "B".repeat(298);
    const text = paraA + "\n\n" + paraB;

    const chunks = chunker.chunk(text);

    // Should be 2-3 chunks (one per paragraph, maybe one overlap), NOT 4+
    expect(chunks.length).toBeLessThanOrEqual(3);

    // No exact duplicates
    const unique = new Set(chunks);
    expect(unique.size).toBe(chunks.length);
  });

  it("should produce roughly proportional chunk counts for smaller chunkSize", () => {
    const large = new RecursiveCharacterChunker({ chunkSize: 1000, chunkOverlap: 200 });
    const small = new RecursiveCharacterChunker({ chunkSize: 400, chunkOverlap: 80 });

    // Generate a document with many paragraphs of varied sizes
    const paragraphs = Array.from({ length: 50 }, (_, i) =>
      String.fromCharCode(65 + (i % 26)).repeat(150 + (i * 7) % 200)
    );
    const text = paragraphs.join("\n\n");

    const largeChunks = large.chunk(text);
    const smallChunks = small.chunk(text);

    // With 2.5x smaller chunks, expect roughly 2-4x more chunks, not 8x
    const ratio = smallChunks.length / largeChunks.length;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/eval-lib test -- --grep "overlap duplication"`
Expected: FAIL — duplicate chunks or count > 3.

**Step 3: Fix the overlap retention logic**

In `packages/eval-lib/src/chunkers/recursive-character.ts`, replace lines 128-139:

```typescript
        // Keep overlap: drop from front until under overlap threshold
        if (this._chunkOverlap > 0) {
          while (currentParts.length > 0) {
            const dropLen = currentParts[0].text.length + separator.length;
            if (currentLen - dropLen <= this._chunkOverlap) break;
            currentLen -= dropLen;
            currentParts.shift();
          }
        } else {
          currentParts = [];
          currentLen = 0;
        }
```

With:

```typescript
        // Keep overlap: retain at most chunkOverlap characters from the tail
        if (this._chunkOverlap > 0) {
          // Drop parts from the front until the remaining fits within chunkOverlap
          while (currentParts.length > 0) {
            const dropLen = currentParts[0].text.length + separator.length;
            if (currentLen - dropLen <= this._chunkOverlap) break;
            currentLen -= dropLen;
            currentParts.shift();
          }
          // Safety: if the remaining content still exceeds chunkOverlap
          // (single large paragraph), clear it to prevent re-splitting
          if (currentLen > this._chunkOverlap) {
            currentParts = [];
            currentLen = 0;
          }
        } else {
          currentParts = [];
          currentLen = 0;
        }
```

The key addition is the safety guard: if after dropping parts from the front, the remaining content still exceeds `chunkOverlap` (a single part is larger than the overlap threshold), clear everything. This prevents the retained content + next part from exceeding `chunkSize` and triggering recursive re-splitting.

**Step 4: Run tests to verify the fix**

Run: `pnpm -C packages/eval-lib test`
Expected: All tests pass, including the new overlap duplication tests.

**Step 5: Commit**

```bash
git add packages/eval-lib/src/chunkers/recursive-character.ts packages/eval-lib/tests/unit/chunkers/recursive-character.test.ts
git commit -m "fix(eval-lib): prevent RecursiveCharacterChunker overlap from producing duplicate chunks"
```

---

### Task 3: Parent-child backend indexing

**Files:**
- Modify: `packages/backend/convex/retrieval/retrieverActions.ts:103-112`
- Modify: `packages/backend/convex/retrieval/indexingActions.ts:68-98`
- Create: `packages/backend/tests/parent-child-indexing.test.ts` (optional — if time permits)

**Context:** Backend always uses `strategy: "plain"` for indexing. For parent-child, it needs to create two levels of chunks: parents (large, no embedding) and children (small, embedded) with `metadata.parentChunkId` linking children to parents.

**Step 1: Update retrieverActions.ts to detect parent-child strategy**

In `packages/backend/convex/retrieval/retrieverActions.ts`, replace lines 103-112:

```typescript
    // Resolve index config for the indexing service
    const indexSettings = (config.index ?? {}) as Record<string, unknown>;
    const indexConfig = {
      strategy: "plain" as const,
      chunkSize: (indexSettings.chunkSize as number) ?? 1000,
      chunkOverlap: (indexSettings.chunkOverlap as number) ?? 200,
      separators: indexSettings.separators as string[] | undefined,
      embeddingModel:
        (indexSettings.embeddingModel as string) ?? "text-embedding-3-small",
    };
```

With:

```typescript
    // Resolve index config for the indexing service
    const indexSettings = (config.index ?? {}) as Record<string, unknown>;
    const strategy = (indexSettings.strategy as string) ?? "plain";

    const indexConfig = strategy === "parent-child"
      ? {
          strategy: "parent-child" as const,
          childChunkSize: (indexSettings.childChunkSize as number) ?? 200,
          parentChunkSize: (indexSettings.parentChunkSize as number) ?? 1000,
          childOverlap: (indexSettings.childOverlap as number) ?? 0,
          parentOverlap: (indexSettings.parentOverlap as number) ?? 100,
          embeddingModel:
            (indexSettings.embeddingModel as string) ?? "text-embedding-3-small",
        }
      : {
          strategy: "plain" as const,
          chunkSize: (indexSettings.chunkSize as number) ?? 1000,
          chunkOverlap: (indexSettings.chunkOverlap as number) ?? 200,
          separators: indexSettings.separators as string[] | undefined,
          embeddingModel:
            (indexSettings.embeddingModel as string) ?? "text-embedding-3-small",
        };
```

Also update the `startIndexing` call to pass the full indexConfig (the type will need to be updated in `indexing.ts` to accept both shapes — or pass the strategy-specific fields as separate args).

**Step 2: Update indexingActions.ts to handle parent-child chunking**

In `packages/backend/convex/retrieval/indexingActions.ts`, update the Phase A section (lines 68-98) to detect the strategy and create both parent and child chunks.

Add after the existing `RecursiveCharacterChunker` import:

```typescript
import { RecursiveCharacterChunker } from "rag-evaluation-system";
```

Then replace the chunking section:

```typescript
    } else {
      // ── PHASE A: Chunk & Store (pure compute, atomic) ──
      const doc = await ctx.runQuery(internal.crud.documents.getInternal, {
        id: args.documentId,
      });

      const evalDoc = createDocument({ id: doc.docId, content: doc.content });

      if (args.strategy === "parent-child") {
        // Parent-child: two-level chunking
        const parentChunker = new RecursiveCharacterChunker({
          chunkSize: args.parentChunkSize ?? 1000,
          chunkOverlap: args.parentOverlap ?? 100,
        });
        const childChunker = new RecursiveCharacterChunker({
          chunkSize: args.childChunkSize ?? 200,
          chunkOverlap: args.childOverlap ?? 0,
        });

        const parentChunks = parentChunker.chunkWithPositions(evalDoc);
        const childChunks = childChunker.chunkWithPositions(evalDoc);

        if (parentChunks.length === 0 && childChunks.length === 0) {
          return { skipped: false, chunksInserted: 0, chunksEmbedded: 0 };
        }

        // Insert parent chunks (no embedding — level: "parent")
        const parentIds = await ctx.runMutation(internal.retrieval.chunks.insertChunkBatch, {
          chunks: parentChunks.map((c) => ({
            documentId: args.documentId,
            kbId: args.kbId,
            indexConfigHash: args.indexConfigHash,
            chunkId: c.id,
            content: c.content,
            start: c.start,
            end: c.end,
            metadata: { level: "parent" },
          })),
        });

        // Map each child to its enclosing parent
        const childChunksMapped = childChunks.map((child) => {
          const parentIndex = parentChunks.findIndex(
            (p) => p.start <= child.start && p.end >= child.end,
          );
          return {
            documentId: args.documentId,
            kbId: args.kbId,
            indexConfigHash: args.indexConfigHash,
            chunkId: child.id,
            content: child.content,
            start: child.start,
            end: child.end,
            metadata: {
              level: "child" as const,
              parentChunkId: parentIndex >= 0 && parentIds
                ? parentIds[parentIndex]
                : undefined,
            },
          };
        });

        // Insert child chunks (will be embedded in Phase B)
        await ctx.runMutation(internal.retrieval.chunks.insertChunkBatch, {
          chunks: childChunksMapped,
        });
      } else {
        // Plain: standard single-level chunking
        const chunker = new RecursiveCharacterChunker({
          chunkSize: args.chunkSize ?? 1000,
          chunkOverlap: args.chunkOverlap ?? 200,
        });

        const chunks = chunker.chunkWithPositions(evalDoc);

        if (chunks.length === 0) {
          return { skipped: false, chunksInserted: 0, chunksEmbedded: 0 };
        }

        await ctx.runMutation(internal.retrieval.chunks.insertChunkBatch, {
          chunks: chunks.map((c) => ({
            documentId: args.documentId,
            kbId: args.kbId,
            indexConfigHash: args.indexConfigHash,
            chunkId: c.id,
            content: c.content,
            start: c.start,
            end: c.end,
            metadata: c.metadata ?? {},
          })),
        });
      }
    }
```

**Important:** The `insertChunkBatch` mutation needs to return the inserted `_id`s so parent IDs can be passed to children. Check if it already returns IDs — if not, update it to return them.

**Step 3: Update Phase B to skip embedding parent chunks**

In the Phase B embedding loop, add a filter to skip chunks with `metadata.level === "parent"`:

```typescript
// In the paginated unembedded chunk collection loop:
// Filter out parent chunks (they don't get embedded)
const toEmbed = unembedded.filter(
  (c) => !c.metadata?.level || c.metadata.level !== "parent"
);
```

**Step 4: Update args validator for the indexing action**

Update the `args` validator in `indexingActions.ts` to accept the new parent-child fields:

```typescript
strategy: v.optional(v.string()),
childChunkSize: v.optional(v.number()),
parentChunkSize: v.optional(v.number()),
childOverlap: v.optional(v.number()),
parentOverlap: v.optional(v.number()),
```

**Step 5: Typecheck and test**

Run: `pnpm typecheck:backend && pnpm -C packages/backend test`
Expected: All pass.

**Step 6: Commit**

```bash
git add packages/backend/convex/retrieval/retrieverActions.ts packages/backend/convex/retrieval/indexingActions.ts packages/backend/convex/retrieval/chunks.ts
git commit -m "feat(backend): implement parent-child indexing with two-level chunking"
```

---

### Task 4: Parent-child backend retrieval

**Files:**
- Modify: `packages/backend/convex/experiments/actions.ts:243-266`
- Modify: `packages/backend/convex/retrieval/retrieverActions.ts` (standalone retrieve action)

**Context:** After vector search returns scored child chunks, look up their parents and deduplicate. The child→parent mapping uses `metadata.parentChunkId`.

**Step 1: Add parent-child swap to experiment retrieval**

In `packages/backend/convex/experiments/actions.ts`, after the `vectorSearchWithFilter` call returns `filtered` chunks, add parent-child swap logic:

```typescript
    // Parent-child swap: replace child chunks with their parent chunks
    const indexStrategy = (retrieverConfig?.index as Record<string, unknown>)?.strategy;
    if (indexStrategy === "parent-child") {
      const parentIds = new Set<string>();
      const deduped: typeof filtered = [];

      for (const child of filtered) {
        const parentId = child.metadata?.parentChunkId;
        if (parentId && !parentIds.has(parentId)) {
          parentIds.add(parentId);
          // Fetch parent chunk
          const parent = await ctx.runQuery(internal.retrieval.chunks.getChunkById, {
            chunkId: parentId,
          });
          if (parent) {
            deduped.push({
              ...parent,
              score: child.score, // Keep child's relevance score
            });
          } else {
            deduped.push(child); // Fallback to child if parent not found
          }
        } else if (!parentId) {
          deduped.push(child); // No parent mapping, keep as-is
        }
        // Skip if parent already added (deduplication)
      }
      filtered = deduped;
    }
```

**Step 2: Add getChunkById query to chunks.ts**

In `packages/backend/convex/retrieval/chunks.ts`, add:

```typescript
export const getChunkById = internalQuery({
  args: { chunkId: v.id("documentChunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chunkId);
  },
});
```

**Step 3: Typecheck and test**

Run: `pnpm typecheck:backend && pnpm -C packages/backend test`
Expected: All pass.

**Step 4: Commit**

```bash
git add packages/backend/convex/experiments/actions.ts packages/backend/convex/retrieval/chunks.ts
git commit -m "feat(backend): add parent-child retrieval swap in experiment execution"
```

---

### Task 5: Stats Banner component

**Files:**
- Modify: `packages/frontend/src/components/tabs/IndexTab.tsx:798-821`

**Context:** Replace the `IndexConfigBanner` (which hardcodes "recursive") with a `StatsBanner` that shows actual chunker name, metric cards (total chunks, avg size, min/max, overlap %), and a collapsible histogram.

**Step 1: Replace IndexConfigBanner with StatsBanner**

Replace the `IndexConfigBanner` component (lines 798-821) with a new `StatsBanner` component. It takes `retrieverConfig`, `chunks` (the loaded chunks array), and `chunkCount` (from retriever). The stats are computed client-side from the chunks array.

```tsx
function StatsBanner({
  retrieverConfig,
  chunks,
  chunkCount,
}: {
  retrieverConfig: unknown;
  chunks: Chunk[];
  chunkCount?: number;
}) {
  const [showHistogram, setShowHistogram] = useState(false);
  const config = resolveConfig(retrieverConfig as PipelineConfig);
  const { embeddingModel } = config.index;
  const embedShort = embeddingModel.replace("text-embedding-", "");

  // Resolve actual chunker name from index strategy
  const strategy = config.index.strategy ?? "plain";
  const isParentChild = strategy === "parent-child";
  const chunkerLabel = isParentChild
    ? `Parent-child (${config.index.childChunkSize ?? 200}/${config.index.parentChunkSize ?? 1000})`
    : `Recursive (${config.index.chunkSize}/${config.index.chunkOverlap})`;

  // Compute stats from loaded chunks
  const stats = useMemo(() => {
    if (chunks.length === 0) return null;
    const sizes = chunks.map((c) => c.end - c.start);
    const total = chunkCount ?? chunks.length;
    const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);

    // Compute overlap %
    let overlapChars = 0;
    const sorted = [...chunks].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const overlap = sorted[i - 1].end - sorted[i].start;
      if (overlap > 0) overlapChars += overlap;
    }
    const overlapPct = avg > 0 ? Math.round((overlapChars / sorted.length / avg) * 100) : 0;

    // Histogram buckets (100-char width)
    const bucketWidth = 100;
    const buckets = new Map<number, number>();
    for (const s of sizes) {
      const bucket = Math.floor(s / bucketWidth) * bucketWidth;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    const sortedBuckets = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const maxCount = Math.max(...sortedBuckets.map(([, c]) => c));

    return { total, avg, min, max, overlapPct, sortedBuckets, maxCount };
  }, [chunks, chunkCount]);

  return (
    <div className="px-3 py-2 border-b border-border flex-shrink-0">
      <div className="bg-bg-surface border border-border rounded-lg p-2 space-y-2">
        {/* Config row */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-dim">
          <span className="text-text-muted font-medium">Index</span>
          <span>Chunking: <span className="text-text-muted">{chunkerLabel}</span></span>
          <span>Embedding: <span className="text-text-muted">{embedShort}</span></span>
          {isParentChild && (
            <span className="text-blue-400">
              Searched: child → Returns: parent
            </span>
          )}
        </div>

        {/* Metric cards */}
        {stats && (
          <div className="flex gap-3">
            {[
              { label: "chunks", value: stats.total.toLocaleString() },
              { label: "avg size", value: `${stats.avg}` },
              { label: "min/max", value: `${stats.min}–${stats.max}` },
              { label: "overlap", value: `${stats.overlapPct}%` },
            ].map((card) => (
              <div key={card.label} className="flex-1 bg-bg-elevated/50 rounded px-2 py-1 text-center">
                <div className="text-sm text-text font-medium">{card.value}</div>
                <div className="text-[10px] text-text-dim">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Histogram toggle */}
        {stats && (
          <button
            onClick={() => setShowHistogram(!showHistogram)}
            className="text-[10px] text-accent hover:text-accent-bright transition-colors cursor-pointer"
          >
            {showHistogram ? "▲ Hide" : "▼ Show"} distribution
          </button>
        )}

        {/* Histogram */}
        {showHistogram && stats && (
          <div className="space-y-0.5 pt-1">
            {stats.sortedBuckets.map(([bucket, count]) => (
              <div key={bucket} className="flex items-center gap-2 text-[10px]">
                <span className="w-16 text-right text-text-dim">{bucket}–{bucket + 100}</span>
                <div className="flex-1 h-3 bg-bg-elevated rounded overflow-hidden">
                  <div
                    className="h-full bg-accent/40 rounded"
                    style={{ width: `${(count / stats.maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-text-dim">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update IndexTab to pass chunks to StatsBanner**

The `StatsBanner` needs access to loaded chunks. The chunks are currently loaded inside `ChunkInspectorWrapper`. We need to lift the chunk loading to `IndexTab` level so both the banner and the inspector can use them. This will be done alongside Task 6/7 when the main component is restructured.

For now, pass `chunks={[]}` and `chunkCount={retriever.chunkCount}` — the stats will show total count from the retriever record. Full stats become available after Task 7 lifts chunk loading.

**Step 3: Build and verify**

Run: `pnpm -C packages/frontend build`
Expected: Compiles successfully.

**Step 4: Commit**

```bash
git add packages/frontend/src/components/tabs/IndexTab.tsx
git commit -m "feat(frontend): replace IndexConfigBanner with StatsBanner showing metrics and histogram"
```

---

### Task 6: Click-to-highlight document view

**Files:**
- Modify: `packages/frontend/src/components/tabs/IndexTab.tsx`

**Context:** Replace the current annotated document view (numbered pills + zebra stripes) with a clean document that highlights chunks on click. This is the largest single change — it replaces `buildSegments`, `renderAnnotatedContent`, `ChunkPill`, and parts of `DocumentViewerPanel`.

**Step 1: Remove old components**

Delete or replace these components/functions in `IndexTab.tsx`:
- `buildSegments()` (lines 56-136)
- `detectDiff()` (lines 147-164)
- `ChunkPill` (lines 179-211)
- `renderAnnotatedContent()` (lines 490-539)

**Step 2: Add click-to-highlight helper**

Add a new function `findChunksAtPosition` that binary-searches sorted chunks to find which chunk(s) contain a given character position:

```tsx
/** Find chunk(s) that contain the given character position. */
function findChunksAtPosition(
  chunks: Chunk[],
  position: number,
): { primary: number | null; overlap: number | null } {
  let primary: number | null = null;
  let overlap: number | null = null;

  for (let i = 0; i < chunks.length; i++) {
    if (position >= chunks[i].start && position < chunks[i].end) {
      if (primary === null) {
        primary = i;
      } else {
        overlap = i;
        break;
      }
    }
  }

  return { primary, overlap };
}
```

**Step 3: Rewrite DocumentViewerPanel**

Replace the center panel rendering. The new approach:

1. **Raw mode:** Render the document as plain `<pre>` text. On click, determine the character position from the click event (using a `data-offset` attribute on text spans). Highlight the clicked chunk by wrapping its character range in a `<span>` with a highlight class.

2. **Chunk boundary hairlines:** In a narrow left margin, render thin lines at chunk boundary positions.

3. **Click handler:** `onClick` on the text container determines which chunk was clicked and updates `selectedChunkIndex`.

Implementation approach for character-position detection:
- Split the document content into fixed-length segments (e.g., per line).
- Each `<span>` gets a `data-offset` attribute with its starting character position.
- On click, walk up from `event.target` to find the closest `data-offset`, then compute the exact position using `window.getSelection()`.

The full implementation of this component is substantial (~200 lines). The implementer should read the current `DocumentViewerPanel` (lines 272-484) and replace it with the click-to-highlight version, preserving:
- Document header (doc ID, chunk count, char count)
- Raw/Rendered toggle
- Load More Chunks pagination
- Scroll-to-chunk when selecting from the right panel

**Step 4: Build and verify**

Run: `pnpm -C packages/frontend build`
Expected: Compiles successfully.

**Step 5: Commit**

```bash
git add packages/frontend/src/components/tabs/IndexTab.tsx
git commit -m "feat(frontend): replace annotated document view with click-to-highlight interaction"
```

---

### Task 7: Revised chunk list & details panel

**Files:**
- Modify: `packages/frontend/src/components/tabs/IndexTab.tsx`

**Context:** Replace `ChunkInspectorPanel` (lines 545-792) with a two-section right panel: searchable chunk list (top) + chunk detail (bottom).

**Step 1: Create ChunkListPanel component**

Compact scrollable chunk list with:
- Search box filtering by content text match
- Jump-to-number input
- Each row: `#N`, char count, proportional size bar
- Click to select and highlight in document
- For parent-child: grouped by parent (collapsible)

```tsx
function ChunkListPanel({
  chunks,
  selectedIndex,
  onSelect,
}: {
  chunks: Chunk[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [jumpTo, setJumpTo] = useState("");

  const maxSize = useMemo(
    () => Math.max(...chunks.map((c) => c.end - c.start), 1),
    [chunks],
  );

  const filtered = useMemo(() => {
    if (!search) return chunks.map((c, i) => ({ chunk: c, index: i }));
    const lower = search.toLowerCase();
    return chunks
      .map((c, i) => ({ chunk: c, index: i }))
      .filter(({ chunk }) => chunk.content.toLowerCase().includes(lower));
  }, [chunks, search]);

  const handleJump = () => {
    const n = parseInt(jumpTo, 10);
    if (n >= 1 && n <= chunks.length) {
      onSelect(n - 1);
      setJumpTo("");
    }
  };

  return (
    <div className="flex flex-col h-1/2 border-b border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-bg-elevated/50 flex items-center gap-2">
        <span className="text-[11px] text-text-muted font-medium flex-shrink-0">
          Chunks ({chunks.length})
        </span>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 bg-bg-surface border border-border text-text text-[11px] rounded px-1.5 py-0.5 placeholder:text-text-dim focus:outline-none focus:border-accent/50"
        />
        <input
          type="text"
          placeholder="#"
          value={jumpTo}
          onChange={(e) => setJumpTo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJump()}
          className="w-10 bg-bg-surface border border-border text-text text-[11px] rounded px-1.5 py-0.5 placeholder:text-text-dim focus:outline-none focus:border-accent/50 text-center"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(({ chunk, index }) => {
          const size = chunk.end - chunk.start;
          const isSelected = selectedIndex === index;
          return (
            <button
              key={chunk._id}
              onClick={() => onSelect(index)}
              className={`w-full flex items-center gap-2 px-3 py-1 text-left transition-colors cursor-pointer ${
                isSelected
                  ? "bg-accent/10 border-l-2 border-accent"
                  : "hover:bg-bg-hover border-l-2 border-transparent"
              }`}
            >
              <span className="text-[10px] text-text-dim w-8 text-right flex-shrink-0">
                #{index + 1}
              </span>
              <span className="text-[10px] text-text-muted w-12 flex-shrink-0">
                {size}ch
              </span>
              <div className="flex-1 h-2 bg-bg-surface rounded overflow-hidden">
                <div
                  className="h-full bg-accent/30 rounded"
                  style={{ width: `${(size / maxSize) * 100}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Create ChunkDetailPanel component**

Simplified chunk detail view focused on extra content:

```tsx
function ChunkDetailPanel({
  chunk,
  index,
  total,
  documentContent,
  onPrev,
  onNext,
}: {
  chunk: Chunk;
  index: number;
  total: number;
  documentContent: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [showContent, setShowContent] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const size = chunk.end - chunk.start;
  const originalText = documentContent.slice(chunk.start, chunk.end);

  // Detect extra content (contextual prefix or summary replacement)
  const hasPrefix =
    chunk.content.length > originalText.length &&
    chunk.content.endsWith(originalText);
  const prefix = hasPrefix
    ? chunk.content.slice(0, chunk.content.length - originalText.length)
    : null;

  const isSummary =
    !hasPrefix && chunk.content !== originalText && chunk.content.length > 0;

  const metadataEntries = Object.entries(chunk.metadata ?? {}).filter(
    ([k]) => k !== "level" && k !== "parentChunkId",
  );

  return (
    <div className="flex flex-col h-1/2">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Header */}
        <div>
          <div className="text-xs text-text font-medium">Chunk #{index + 1}</div>
          <div className="text-[10px] text-text-dim">
            chars {chunk.start.toLocaleString()}→{chunk.end.toLocaleString()} · {size} chars
          </div>
        </div>

        {/* Contextual prefix */}
        {prefix && (
          <div>
            <div className="text-[10px] text-blue-400 font-medium uppercase tracking-wider mb-1">
              Contextual Prefix
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded p-2">
              <pre className="text-[11px] text-blue-300 whitespace-pre-wrap font-mono">
                {prefix.trim()}
              </pre>
            </div>
          </div>
        )}

        {/* Summary replacement */}
        {isSummary && (
          <div>
            <div className="text-[10px] text-yellow-400 font-medium uppercase tracking-wider mb-1">
              Embedded Summary
            </div>
            <p className="text-[10px] text-text-dim mb-1">
              This summary was embedded instead of the original text.
            </p>
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-2">
              <pre className="text-[11px] text-yellow-300 whitespace-pre-wrap font-mono">
                {chunk.content}
              </pre>
            </div>
          </div>
        )}

        {/* Chunk content divider */}
        {(prefix || isSummary) && (
          <div className="flex items-center gap-2 text-[10px] text-text-dim">
            <div className="flex-1 h-px bg-border" />
            chunk content follows
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Collapsible chunk text */}
        <button
          onClick={() => setShowContent(!showContent)}
          className="text-[10px] text-accent hover:text-accent-bright transition-colors cursor-pointer"
        >
          {showContent ? "▲ Hide" : "▶ Show"} chunk text ({size} chars)
        </button>
        {showContent && (
          <pre className="text-[11px] text-text-muted whitespace-pre-wrap font-mono bg-bg-surface rounded p-2 max-h-48 overflow-auto">
            {originalText}
          </pre>
        )}

        {/* Collapsible metadata */}
        {metadataEntries.length > 0 && (
          <>
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="text-[10px] text-text-dim hover:text-text transition-colors cursor-pointer"
            >
              {showMetadata ? "▲" : "▶"} Metadata ({metadataEntries.length} keys)
            </button>
            {showMetadata && (
              <div className="bg-bg-surface rounded p-2 space-y-1">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-[10px]">
                    <span className="text-text-dim font-mono flex-shrink-0">{key}:</span>
                    <span className="text-text-muted truncate">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="text-[10px] text-text-dim hover:text-text disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <span className="text-[10px] text-text-dim">
          {index + 1}/{total}
        </span>
        <button
          onClick={onNext}
          disabled={index === total - 1}
          className="text-[10px] text-text-dim hover:text-text disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Wire up the right panel**

Replace the current right panel logic in `IndexTab` to use `ChunkListPanel` (top half) + `ChunkDetailPanel` (bottom half) instead of `ChunkInspectorWrapper`.

**Step 4: Lift chunk loading to IndexTab level**

Move chunk pagination loading from `ChunkInspectorWrapper` up to `IndexTab` so both the `StatsBanner` and the right panel can access chunks. Pass chunks down to `StatsBanner`, `DocumentViewerPanel`, and the chunk panels.

**Step 5: Build and verify**

Run: `pnpm -C packages/frontend build`
Expected: Compiles successfully.

**Step 6: Commit**

```bash
git add packages/frontend/src/components/tabs/IndexTab.tsx
git commit -m "feat(frontend): add searchable chunk list and revised detail panel with extra content focus"
```

---

### Task 8: Index→search interaction notes

**Files:**
- Modify: `packages/frontend/src/components/tabs/QuerySearchTab.tsx`
- Modify: `packages/frontend/src/components/wizard/steps/SearchStep.tsx` (if exists, or wherever search strategy is configured in wizard)

**Context:** The search config UI (dense/BM25/hybrid) should communicate what's actually being searched, which varies by index strategy.

**Step 1: Add IndexSearchNote helper component**

Create a small helper that takes the index strategy and returns a contextual note:

```tsx
function IndexSearchNote({ indexStrategy, indexConfig }: {
  indexStrategy: string;
  indexConfig: Record<string, unknown>;
}) {
  if (indexStrategy === "parent-child") {
    const childSize = (indexConfig.childChunkSize as number) ?? 200;
    const parentSize = (indexConfig.parentChunkSize as number) ?? 1000;
    return (
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2 text-[11px] text-blue-400">
        Search runs on child chunks ({childSize} chars). Matching children are
        automatically mapped to parent chunks ({parentSize} chars).
      </div>
    );
  }
  if (indexStrategy === "contextual") {
    return (
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2 text-[11px] text-blue-400">
        Search runs on chunks with a contextual prefix — a few sentences
        situating the chunk in its document.
      </div>
    );
  }
  if (indexStrategy === "summary") {
    return (
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2 text-[11px] text-blue-400">
        Search runs on LLM-generated summaries. Matching summaries return the
        original chunk content.
      </div>
    );
  }
  return null; // Plain — no note needed
}
```

**Step 2: Insert into QuerySearchTab**

In `QuerySearchTab.tsx`, add the `IndexSearchNote` below the search strategy selector, passing the retriever's index strategy from its config.

**Step 3: Insert into wizard SearchStep**

In the wizard's search configuration step, add the same note below the search strategy buttons.

**Step 4: Build and verify**

Run: `pnpm -C packages/frontend build`
Expected: Compiles successfully.

**Step 5: Commit**

```bash
git add packages/frontend/src/components/tabs/QuerySearchTab.tsx packages/frontend/src/components/wizard/steps/
git commit -m "feat(frontend): add index→search interaction notes to search config UI"
```

---

### Task 9: End-to-end verification

**Step 1: Full build**

Run: `pnpm build && pnpm typecheck && pnpm typecheck:backend && pnpm -C packages/frontend build`
Expected: All pass.

**Step 2: Run tests**

Run: `pnpm test && pnpm -C packages/backend test`
Expected: All tests pass.

**Step 3: Manual E2E checklist**

- [ ] Open a retriever → Index tab shows StatsBanner with metric cards
- [ ] Click "Show distribution" → histogram appears
- [ ] Select a document → clean text renders without pills or stripes
- [ ] Click anywhere in the document → chunk highlights with accent background
- [ ] Click on overlap region → both chunks highlight in different colors
- [ ] Click Escape or elsewhere → highlight clears
- [ ] Right panel shows searchable chunk list with size bars
- [ ] Type in search box → chunks filter by content
- [ ] Type a number in jump-to → selects that chunk
- [ ] Click a chunk in list → document scrolls to and highlights that chunk
- [ ] Chunk detail shows contextual prefix (if contextual indexing)
- [ ] Chunk detail shows summary (if summary indexing)
- [ ] Chunk text is collapsible (collapsed by default)
- [ ] Metadata is collapsible
- [ ] MarkdownViewer no longer shows `<last>` tag error
- [ ] OpenClaw chunking (400/80) produces reasonable chunk counts (~4,500 not 14,000)
- [ ] Parent-child retriever shows "Searched: child → Returns: parent" in stats banner
- [ ] Search config shows interaction note for parent-child/contextual/summary
- [ ] Prev/Next navigation works in chunk detail

**Step 4: Commit**

Only if fixes were needed during E2E testing.
