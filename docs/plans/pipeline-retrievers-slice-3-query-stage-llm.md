# Slice 3 — Query Stage + LLM Interface

> Part of the [Pipeline Retrievers Plan](./pipeline-retrievers-shared-context.md). See shared context for codebase state and design decisions.

**Unlocks**: 144 configs x 5 query strategies = **720 experiment configs** (not all valid, ~400 interesting)

### 3a. PipelineLLM Interface

**File**: `packages/eval-lib/src/retrievers/pipeline/llm.interface.ts`

```typescript
/**
 * Minimal LLM interface for pipeline stages.
 * Provider-agnostic — callers provide their own implementation.
 */
export interface PipelineLLM {
  complete(prompt: string): Promise<string>;
}
```

### 3b. OpenAI LLM Implementation

**File**: `packages/eval-lib/src/retrievers/pipeline/llm-openai.ts`

```typescript
import type { PipelineLLM } from "./llm.interface.js";

// Structural typing — duck-typed against exactly the OpenAI surface area we use
// Follows the same pattern as OpenAIEmbedder and CohereReranker
interface OpenAIChatClient {
  chat: {
    completions: {
      create(opts: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

export class OpenAIPipelineLLM implements PipelineLLM {
  readonly name: string; // "OpenAI(gpt-4o-mini)"

  private constructor(client: OpenAIChatClient, model: string, temperature: number);

  static async create(options?: {
    model?: string;       // default "gpt-4o-mini"
    temperature?: number; // default 0.2
    apiKey?: string;
  }): Promise<OpenAIPipelineLLM>;

  complete(prompt: string): Promise<string>;
  // Uses: client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }], temperature })
}
```

### 3c. PipelineRetrieverDeps Update

**File**: `packages/eval-lib/src/retrievers/pipeline/pipeline-retriever.ts`

```typescript
export interface PipelineRetrieverDeps {
  readonly chunker: PositionAwareChunker;           // unchanged
  readonly embedder: Embedder;                       // unchanged
  readonly vectorStore?: VectorStore;                // unchanged
  readonly reranker?: Reranker;                      // unchanged
  readonly embeddingBatchSize?: number;              // unchanged
  readonly llm?: PipelineLLM;                        // NEW — required for hyde, multi-query, step-back, rewrite
}
```

Constructor validates: if config uses an LLM-requiring query strategy but no `llm` provided, throw:

```typescript
const llmStrategies = ["hyde", "multi-query", "step-back", "rewrite"];
if (llmStrategies.includes(queryConfig.strategy) && !deps.llm) {
  throw new Error(
    `PipelineRetriever: query strategy "${queryConfig.strategy}" requires an LLM but none was provided in deps.`
  );
}
```

### 3d. Query Stage Config Types

**File**: `packages/eval-lib/src/retrievers/pipeline/config.ts` — extend QueryConfig union:

```typescript
// EXISTING — keep as-is
export interface IdentityQueryConfig {
  readonly strategy: "identity";
}

// NEW
export interface HydeQueryConfig {
  readonly strategy: "hyde";
  readonly hydePrompt?: string;
  readonly numHypotheticalDocs?: number; // default 1
}

export interface MultiQueryConfig {
  readonly strategy: "multi-query";
  readonly numQueries?: number;           // default 3
  readonly generationPrompt?: string;
  readonly fusionMethod?: "rrf" | "weighted"; // default "rrf"
}

export interface StepBackQueryConfig {
  readonly strategy: "step-back";
  readonly stepBackPrompt?: string;
  readonly includeOriginal?: boolean;     // default true
}

export interface RewriteQueryConfig {
  readonly strategy: "rewrite";
  readonly rewritePrompt?: string;
}

// UPDATED — extend the union
export type QueryConfig =
  | IdentityQueryConfig
  | HydeQueryConfig
  | MultiQueryConfig
  | StepBackQueryConfig
  | RewriteQueryConfig;
```

### 3e. Multi-Query Pipeline Flow

The `retrieve()` method in `pipeline-retriever.ts` changes to handle multiple queries:

```typescript
async retrieve(query: string, k: number): Promise<PositionAwareChunk[]> {
  if (!this._initialized) {
    throw new Error("PipelineRetriever not initialized. Call init() first.");
  }

  // QUERY stage — always returns string[]
  const queries = await this._processQuery(query);

  // SEARCH stage — search for each query, fuse across queries
  let scoredResults: ScoredChunk[];
  if (queries.length === 1) {
    scoredResults = await this._searchStrategy.search(
      queries[0], k, this._searchStrategyDeps,
    );
  } else {
    // Run search for each query in parallel
    const perQueryResults = await Promise.all(
      queries.map(q => this._searchStrategy.search(q, k * 2, this._searchStrategyDeps))
    );
    // Fuse across queries using RRF
    scoredResults = this._fuseAcrossQueries(perQueryResults);
  }

  // REFINEMENT stage — unchanged
  scoredResults = await this._applyRefinements(query, scoredResults, k);
  return scoredResults.slice(0, k).map(({ chunk }) => chunk);
}

private async _processQuery(query: string): Promise<string[]> {
  const config = this._queryConfig;
  switch (config.strategy) {
    case "identity":
      return [query];
    case "hyde": {
      const prompt = config.hydePrompt ?? DEFAULT_HYDE_PROMPT;
      const n = config.numHypotheticalDocs ?? 1;
      if (n === 1) {
        const hypothetical = await this._llm!.complete(prompt + query);
        return [hypothetical];
      }
      // Multiple hypothetical docs: generate n, search each, fuse results
      const hypotheticals = await Promise.all(
        Array.from({ length: n }, () => this._llm!.complete(prompt + query))
      );
      return hypotheticals;
    }
    case "multi-query": {
      const n = config.numQueries ?? 3;
      const prompt = (config.generationPrompt ?? DEFAULT_MULTI_QUERY_PROMPT).replace("{n}", String(n));
      const variants = await this._llm!.complete(prompt + query);
      return parseVariants(variants, n); // see parseVariants below
    }
    case "step-back": {
      const prompt = config.stepBackPrompt ?? DEFAULT_STEP_BACK_PROMPT;
      const abstract = await this._llm!.complete(prompt + query);
      return config.includeOriginal !== false ? [query, abstract] : [abstract];
    }
    case "rewrite": {
      const prompt = config.rewritePrompt ?? DEFAULT_REWRITE_PROMPT;
      const rewritten = await this._llm!.complete(prompt + query);
      return [rewritten];
    }
  }
}

/** Fuse results from multiple queries using RRF. */
private _fuseAcrossQueries(perQueryResults: ScoredChunk[][]): ScoredChunk[] {
  // Reuse reciprocalRankFusion from search/fusion.ts
  // Each query's results are treated as a ranked list
  // RRF combines them: score = Σ 1/(60 + rank_in_list_i)
  // ...
}
```

### 3e-impl. Implementation Notes

**`parseVariants` utility** — needed by `_processQuery` for multi-query strategy. Define in `query/utils.ts` or inline:

```typescript
/** Parse newline-separated query variants from LLM output. */
function parseVariants(text: string, expectedCount: number): string[] {
  return text
    .split('\n')
    .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim()) // strip numbering
    .filter(line => line.length > 0)
    .slice(0, expectedCount);
}
```

**Constructor must store `_queryConfig`** — `_processQuery` references `this._queryConfig`, which doesn't exist on the current class. Add to constructor:

```typescript
// New private field:
private readonly _queryConfig: QueryConfig;
private readonly _llm: PipelineLLM | undefined;

// In constructor:
this._queryConfig = config.query ?? DEFAULT_QUERY_CONFIG;
this._llm = deps.llm;
```

### 3f. Default Prompts

**File**: `packages/eval-lib/src/retrievers/pipeline/query/prompts.ts`

```typescript
export const DEFAULT_HYDE_PROMPT =
  `Write a short passage (100-200 words) that would answer the following question. Do not include the question itself, just the answer passage.\n\nQuestion: `;

export const DEFAULT_MULTI_QUERY_PROMPT =
  `Generate {n} different search queries that would help find information to answer the following question. Return one query per line, no numbering.\n\nQuestion: `;

export const DEFAULT_STEP_BACK_PROMPT =
  `Given the following question, generate a more general, abstract version that would retrieve broader background knowledge. Return only the abstract question.\n\nOriginal question: `;

export const DEFAULT_REWRITE_PROMPT =
  `Rewrite the following question to be more precise and optimized for document retrieval. Return only the rewritten question.\n\nOriginal question: `;

// Used by Summary index strategy (Slice 4)
export const DEFAULT_SUMMARY_PROMPT =
  `Write a concise summary (2-3 sentences) of the following text passage. Focus on the key information that would help someone decide if this passage is relevant to their question.\n\nPassage: `;

// Used by Contextual index strategy (Slice 4)
export const DEFAULT_CONTEXT_PROMPT =
  `<document>\n{doc.content}\n</document>\n\nHere is the chunk we want to situate within the whole document:\n<chunk>\n{chunk.content}\n</chunk>\n\nPlease give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.`;
```

**Note**: `DEFAULT_CONTEXT_PROMPT` and `DEFAULT_SUMMARY_PROMPT` are referenced in Slice 4 (`computeIndexConfigHash`) and index strategy implementations. They MUST be defined before those sections are implemented.

### 3g. Index Exports for Slice 3

**File**: `packages/eval-lib/src/retrievers/pipeline/query/index.ts` — new barrel:

```typescript
export { DEFAULT_HYDE_PROMPT, DEFAULT_MULTI_QUERY_PROMPT, DEFAULT_STEP_BACK_PROMPT, DEFAULT_REWRITE_PROMPT, DEFAULT_SUMMARY_PROMPT, DEFAULT_CONTEXT_PROMPT } from "./prompts.js";
```

**File**: `packages/eval-lib/src/retrievers/pipeline/index.ts` — add:

```typescript
export type { PipelineLLM } from "./llm.interface.js";
export { OpenAIPipelineLLM } from "./llm-openai.js";
export type {
  HydeQueryConfig,
  MultiQueryConfig,
  StepBackQueryConfig,
  RewriteQueryConfig,
} from "./config.js";
```

**File**: `packages/eval-lib/src/index.ts` — add to Pipeline Retriever section:

```typescript
export type {
  ...,
  PipelineLLM,
  HydeQueryConfig,
  MultiQueryConfig,
  StepBackQueryConfig,
  RewriteQueryConfig,
} from "./retrievers/index.js";
export {
  ...,
  OpenAIPipelineLLM,
} from "./retrievers/index.js";
```

---

## Testing (Slice 3)

```typescript
describe("Query strategies", () => {
  it("HyDE should call LLM and embed the hypothetical doc", async () => {
    const mockLlm = { complete: vi.fn().mockResolvedValue("hypothetical answer") };
    const mockEmbedder = createMockEmbedder();

    const retriever = new PipelineRetriever(
      { name: "test", query: { strategy: "hyde" }, search: { strategy: "dense" } },
      { chunker: mockChunker, embedder: mockEmbedder, llm: mockLlm }
    );

    await retriever.init(testCorpus);
    await retriever.retrieve("test query", 5);

    expect(mockLlm.complete).toHaveBeenCalledTimes(1);
    expect(mockEmbedder.embedQuery).toHaveBeenCalledWith("hypothetical answer");
  });

  it("multi-query should generate multiple queries and fuse results", async () => {
    const mockLlm = {
      complete: vi.fn().mockResolvedValue("query 1\nquery 2\nquery 3"),
    };
    // ... verify 3 search calls and fusion
  });

  it("cross-query fusion should deduplicate and rank across queries", async () => {
    // ... verify _fuseAcrossQueries produces correct merged ranking via RRF
  });

  it("should throw if LLM-requiring query strategy has no llm", () => {
    expect(() => new PipelineRetriever(
      { name: "test", query: { strategy: "hyde" } },
      { chunker: mockChunker, embedder: mockEmbedder /* no llm */ }
    )).toThrow(/requires an LLM/);
  });
});
```

### New Files (Slice 3)
- `src/retrievers/pipeline/llm.interface.ts`
- `src/retrievers/pipeline/llm-openai.ts`
- `src/retrievers/pipeline/query/prompts.ts`
- `src/retrievers/pipeline/query/index.ts`

### New Test Files (Slice 3)
- `tests/unit/retrievers/pipeline/query-strategies.test.ts`

### Modified Files (Slice 3)
- `src/retrievers/pipeline/config.ts` — QueryConfig union extension
- `src/retrievers/pipeline/pipeline-retriever.ts` — add `_queryConfig`, `_llm` fields to constructor; add `_processQuery()`, `_fuseAcrossQueries()` methods; LLM validation
- `src/retrievers/pipeline/index.ts` — re-exports
- `src/index.ts` — root barrel
