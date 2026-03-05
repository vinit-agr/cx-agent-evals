# Slice 2 — Sync Chunkers

> Part of the [Pipeline Retrievers Plan](./pipeline-retrievers-shared-context.md). See shared context for codebase state and design decisions.

**Unlocks**: Previous 36 configs x 4 chunkers = **144 experiment configs**

All implement the existing `PositionAwareChunker` interface (synchronous). No new dependencies except `js-tiktoken` for the token chunker.

### 2a. Sentence Chunker

**File**: `packages/eval-lib/src/chunkers/sentence.ts`

```typescript
export interface SentenceChunkerOptions {
  maxChunkSize?: number;       // default 1000
  overlapSentences?: number;   // default 0
}

export class SentenceChunker implements PositionAwareChunker {
  readonly name: string; // "Sentence(size=1000)"

  constructor(options?: SentenceChunkerOptions);

  chunkWithPositions(doc: Document): PositionAwareChunk[];

  // Algorithm:
  // 1. Split text into sentences using regex
  //    Pattern: /(?<=[.!?])\s+(?=[A-Z])/ with abbreviation handling
  //    Track character offset of each sentence
  // 2. Group adjacent sentences until total length approaches maxChunkSize
  // 3. If overlapSentences > 0, keep last N sentences as overlap for next chunk
  // 4. Each chunk: start = first sentence start, end = last sentence end
  // 5. Generate chunk ID via generatePaChunkId(content, docId, start) — same as RecursiveCharacterChunker
}
```

### 2b. Token Chunker

**File**: `packages/eval-lib/src/chunkers/token.ts`

```typescript
export interface TokenChunkerOptions {
  maxTokens?: number;      // default 256
  overlapTokens?: number;  // default 0
  encoding?: string;       // default "cl100k_base"
}

export class TokenChunker implements PositionAwareChunker {
  readonly name: string; // "Token(tokens=256)"

  constructor(options?: TokenChunkerOptions);

  chunkWithPositions(doc: Document): PositionAwareChunk[];

  // Algorithm:
  // 1. Tokenize full text with js-tiktoken
  // 2. Group tokens into chunks of maxTokens with overlapTokens overlap
  // 3. Decode each group back to text
  // 4. Map token boundaries to character offsets for position tracking
  //    start = charOffset(firstToken), end = charOffset(lastToken) + lastTokenLength
  // 5. Generate chunk ID via generatePaChunkId(content, docId, start)
}
```

**New dependency**: `js-tiktoken` (add to `dependencies`, not optional — it's lightweight and wasm-based)

```json
{
  "dependencies": {
    "@langchain/core": "^1.1.0",
    "js-tiktoken": "^1.0",
    "langsmith": "^0.5.0",
    "minisearch": "^7.2.0",
    "zod": "^3.23"
  }
}
```

### 2c. Markdown Chunker

**File**: `packages/eval-lib/src/chunkers/markdown.ts`

```typescript
export interface MarkdownChunkerOptions {
  maxChunkSize?: number;          // default 1000
  headerLevels?: number[];        // default [1, 2, 3] (# ## ###)
  mergeSmallSections?: boolean;   // default true
}

export class MarkdownChunker implements PositionAwareChunker {
  readonly name: string; // "Markdown(size=1000)"

  constructor(options?: MarkdownChunkerOptions);

  chunkWithPositions(doc: Document): PositionAwareChunk[];

  // Algorithm:
  // 1. Scan text for header lines matching configured levels
  //    Pattern: /^(#{1,6})\s+(.+)$/gm
  // 2. Split into sections at header boundaries
  // 3. Each section includes its header as first line
  // 4. If mergeSmallSections: merge adjacent sections under maxChunkSize
  // 5. If section > maxChunkSize: sub-split using the same recursive splitting algorithm
  //    NOTE: RecursiveCharacterChunker._splitTextWithPositions is private.
  //    Options: (a) extract a public chunkText(text, docId, baseOffset) method from
  //    RecursiveCharacterChunker, (b) inline the recursive splitting logic, or
  //    (c) create a synthetic Document and call chunkWithPositions (loses position offset).
  //    Recommended: option (a) — add a public helper to RecursiveCharacterChunker.
  // 6. Position tracking: each section's start/end from regex match positions
  // 7. Generate chunk ID via generatePaChunkId(content, docId, start)
}
```

### 2d. Chunker Index Exports

**File**: `packages/eval-lib/src/chunkers/index.ts` — re-export all new chunkers:

```typescript
// Add to existing exports:
export { SentenceChunker } from "./sentence.js";
export type { SentenceChunkerOptions } from "./sentence.js";
export { TokenChunker } from "./token.js";
export type { TokenChunkerOptions } from "./token.js";
export { MarkdownChunker } from "./markdown.js";
export type { MarkdownChunkerOptions } from "./markdown.js";
```

**File**: `packages/eval-lib/src/index.ts` — add to Chunkers section:

```typescript
export type { ..., SentenceChunkerOptions, TokenChunkerOptions, MarkdownChunkerOptions } from "./chunkers/index.js";
export { ..., SentenceChunker, TokenChunker, MarkdownChunker } from "./chunkers/index.js";
```

---

## Testing (Slice 2)

```typescript
// Pattern: verify positions match source text, chunk sizes respect limits
// Follow the existing chunkers.test.ts pattern

describe("SentenceChunker", () => {
  it("should produce chunks whose start/end positions match source text", () => {
    const doc = createDocument({
      id: DocumentId("d1"),
      content: "First sentence. Second sentence. Third sentence.",
      metadata: {},
    });
    const chunker = new SentenceChunker({ maxChunkSize: 50 });
    const chunks = chunker.chunkWithPositions(doc);

    for (const chunk of chunks) {
      expect(doc.content.slice(chunk.start, chunk.end)).toBe(chunk.content);
    }
  });

  it("should not exceed maxChunkSize", () => {
    // ... verify all chunks <= maxChunkSize
  });
});
```

### New Files (Slice 2)
- `src/chunkers/sentence.ts`
- `src/chunkers/token.ts`
- `src/chunkers/markdown.ts`

### New Test Files (Slice 2)
- `tests/unit/chunkers/sentence.test.ts`
- `tests/unit/chunkers/token.test.ts`
- `tests/unit/chunkers/markdown.test.ts`

### Modified Files (Slice 2)
- `src/chunkers/index.ts` — re-exports
- `src/index.ts` — root barrel
- `package.json` — add js-tiktoken dependency
