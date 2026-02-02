# rag-evaluation-system

Core TypeScript library for evaluating RAG retrieval pipelines. Supports **chunk-level** (chunk ID matching) and **token-level** (character span matching) evaluation.

## Install

```bash
pnpm add rag-evaluation-system
```

The core library depends only on `zod`. Optional integrations:

```bash
pnpm add openai        # OpenAI embeddings
pnpm add chromadb      # Chroma vector store
pnpm add cohere-ai     # Cohere reranker
pnpm add langsmith     # LangSmith dataset management
```

## Chunk-level evaluation

```typescript
import {
  createDocument, createCorpus, RecursiveCharacterChunker,
  ChunkLevelEvaluation, chunkRecall, chunkPrecision, chunkF1,
  ChunkId, QueryId, QueryText,
} from "rag-evaluation-system";
import { OpenAIEmbedder } from "rag-evaluation-system/embedders/openai";

const corpus = createCorpus([createDocument({ id: "intro.md", content: "..." })]);
const chunker = new RecursiveCharacterChunker({ chunkSize: 500, chunkOverlap: 50 });
const embedder = await OpenAIEmbedder.create({ model: "text-embedding-3-small" });

const result = await new ChunkLevelEvaluation({ corpus, langsmithDatasetName: "my-eval" })
  .run({
    chunker, embedder, k: 5,
    metrics: [chunkRecall, chunkPrecision, chunkF1],
    groundTruth: [{
      query: { id: QueryId("q1"), text: QueryText("What is RAG?"), metadata: {} },
      relevantChunkIds: [ChunkId("chunk_abc123")],
    }],
  });
```

## Token-level evaluation

```typescript
import {
  createDocument, createCorpus, RecursiveCharacterChunker,
  TokenLevelEvaluation, spanRecall, spanPrecision, spanIoU,
  createCharacterSpan, QueryId, QueryText,
} from "rag-evaluation-system";
import { OpenAIEmbedder } from "rag-evaluation-system/embedders/openai";

const result = await new TokenLevelEvaluation({ corpus, langsmithDatasetName: "my-eval" })
  .run({
    chunker, embedder, k: 5,
    metrics: [spanRecall, spanPrecision, spanIoU],
    groundTruth: [{
      query: { id: QueryId("q1"), text: QueryText("What does RAG combine?"), metadata: {} },
      relevantSpans: [createCharacterSpan({ docId: "intro.md", start: 0, end: 39, text: "..." })],
    }],
  });
```

## Synthetic data generation

Two strategies for generating evaluation datasets:

- **SimpleStrategy** — N questions per document via prompt-based generation
- **DimensionDrivenStrategy** — Diverse questions via dimension discovery, filtering, relevance matrix, and stratified sampling

```typescript
import { corpusFromFolder, RecursiveCharacterChunker, SimpleStrategy, generate, openAIClientAdapter } from "rag-evaluation-system";
import OpenAI from "openai";

const groundTruth = await generate({
  strategy: new SimpleStrategy({ queriesPerDoc: 5 }),
  evaluationType: "chunk-level",
  corpus: await corpusFromFolder("./docs"),
  llmClient: openAIClientAdapter(new OpenAI()),
  model: "gpt-4o-mini",
  chunker: new RecursiveCharacterChunker(),
});
```

## Built-in optional implementations

```typescript
import { OpenAIEmbedder } from "rag-evaluation-system/embedders/openai";
import { ChromaVectorStore } from "rag-evaluation-system/vector-stores/chroma";
import { CohereReranker } from "rag-evaluation-system/rerankers/cohere";
```

## Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `chunkRecall` | Chunk | Fraction of relevant chunks retrieved |
| `chunkPrecision` | Chunk | Fraction of retrieved chunks that are relevant |
| `chunkF1` | Chunk | Harmonic mean of recall and precision |
| `spanRecall` | Token | Fraction of ground truth character coverage retrieved |
| `spanPrecision` | Token | Fraction of retrieved coverage that is relevant |
| `spanIoU` | Token | Intersection over union of retrieved vs ground truth spans |

## Development

```bash
pnpm build       # Build with tsup
pnpm test        # Run vitest
pnpm typecheck   # TypeScript check
```
