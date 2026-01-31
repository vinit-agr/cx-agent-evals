# rag-evaluation-system

A TypeScript framework for evaluating RAG (Retrieval-Augmented Generation) retrieval pipelines. Supports two evaluation paradigms: **chunk-level** (did we retrieve the right chunks?) and **token-level** (did we retrieve the right character spans?).

## Install

```bash
pnpm add rag-evaluation-system
```

The core library depends only on `zod`. Optional integrations require additional packages:

```bash
# OpenAI embeddings
pnpm add openai

# Chroma vector store
pnpm add chromadb

# Cohere reranker
pnpm add cohere-ai

# LangSmith dataset management
pnpm add langsmith
```

## Quick start

### Chunk-level evaluation

Measures whether your pipeline retrieves the correct chunks by comparing chunk IDs against ground truth.

```typescript
import {
  createDocument,
  createCorpus,
  RecursiveCharacterChunker,
  InMemoryVectorStore,
  ChunkLevelEvaluation,
  chunkRecall,
  chunkPrecision,
  chunkF1,
  ChunkId,
  QueryId,
  QueryText,
} from "rag-evaluation-system";
import { OpenAIEmbedder } from "rag-evaluation-system/embedders/openai";

// 1. Build a corpus
const doc = createDocument({
  id: "intro.md",
  content: "Your document text here...",
});
const corpus = createCorpus([doc]);

// 2. Set up components
const chunker = new RecursiveCharacterChunker({ chunkSize: 500, chunkOverlap: 50 });
const embedder = await OpenAIEmbedder.create({ model: "text-embedding-3-small" });

// 3. Run evaluation
const evaluation = new ChunkLevelEvaluation({
  corpus,
  langsmithDatasetName: "my-chunk-eval",
});

const result = await evaluation.run({
  chunker,
  embedder,
  k: 5,
  metrics: [chunkRecall, chunkPrecision, chunkF1],
  // Pass ground truth directly instead of loading from LangSmith:
  groundTruth: [
    {
      query: { id: QueryId("q1"), text: QueryText("What is RAG?"), metadata: {} },
      relevantChunkIds: [ChunkId("chunk_abc123")],
    },
  ],
});

console.log(result.metrics);
// { chunkRecall: 0.8, chunkPrecision: 0.6, chunkF1: 0.69 }
```

### Token-level evaluation

Measures retrieval precision at the character-span level, comparing exact text positions against ground truth spans.

```typescript
import {
  createDocument,
  createCorpus,
  RecursiveCharacterChunker,
  InMemoryVectorStore,
  TokenLevelEvaluation,
  spanRecall,
  spanPrecision,
  spanIoU,
  createCharacterSpan,
  DocumentId,
  QueryId,
  QueryText,
} from "rag-evaluation-system";
import { OpenAIEmbedder } from "rag-evaluation-system/embedders/openai";

const doc = createDocument({ id: "intro.md", content: "RAG combines retrieval with generation." });
const corpus = createCorpus([doc]);

const chunker = new RecursiveCharacterChunker({ chunkSize: 500, chunkOverlap: 50 });
const embedder = await OpenAIEmbedder.create();

const evaluation = new TokenLevelEvaluation({
  corpus,
  langsmithDatasetName: "my-span-eval",
});

const result = await evaluation.run({
  chunker,
  embedder,
  k: 5,
  metrics: [spanRecall, spanPrecision, spanIoU],
  groundTruth: [
    {
      query: { id: QueryId("q1"), text: QueryText("What does RAG combine?"), metadata: {} },
      relevantSpans: [
        createCharacterSpan({
          docId: "intro.md",
          start: 0,
          end: 39,
          text: "RAG combines retrieval with generation.",
        }),
      ],
    },
  ],
});

console.log(result.metrics);
// { spanRecall: 1.0, spanPrecision: 0.8, spanIoU: 0.75 }
```

## Loading a corpus from files

```typescript
import { corpusFromFolder } from "rag-evaluation-system";

// Load all markdown files from a directory
const corpus = await corpusFromFolder("./docs");

// Or with a custom glob pattern
const corpus = await corpusFromFolder("./data", "**/*.txt");
```

## Synthetic data generation

Generate evaluation datasets automatically using an LLM.

### Chunk-level

```typescript
import {
  createCorpus,
  createDocument,
  RecursiveCharacterChunker,
  ChunkLevelSyntheticDatasetGenerator,
  openAIClientAdapter,
} from "rag-evaluation-system";
import OpenAI from "openai";

const llm = openAIClientAdapter(new OpenAI());
const corpus = createCorpus([createDocument({ id: "doc.md", content: "..." })]);
const chunker = new RecursiveCharacterChunker();

const generator = new ChunkLevelSyntheticDatasetGenerator({
  llmClient: llm,
  corpus,
  chunker,
  model: "gpt-4o",
});

const groundTruth = await generator.generate({
  queriesPerDoc: 5,
  uploadToLangsmith: true, // uploads to LangSmith automatically
  datasetName: "my-eval-dataset",
});
```

### Token-level

```typescript
import {
  TokenLevelSyntheticDatasetGenerator,
  openAIClientAdapter,
} from "rag-evaluation-system";
import OpenAI from "openai";

const generator = new TokenLevelSyntheticDatasetGenerator({
  llmClient: openAIClientAdapter(new OpenAI()),
  corpus,
  model: "gpt-4o",
});

const groundTruth = await generator.generate({
  queriesPerDoc: 5,
  uploadToLangsmith: true,
});
```

## Using LangSmith for dataset management

Upload ground truth datasets to LangSmith and load them back for evaluation runs.

```typescript
import {
  uploadChunkLevelDataset,
  uploadTokenLevelDataset,
  loadChunkLevelDataset,
  loadTokenLevelDataset,
} from "rag-evaluation-system";

// Upload
await uploadChunkLevelDataset(groundTruth, "my-chunk-dataset");
await uploadTokenLevelDataset(groundTruth, "my-span-dataset");

// Load
const chunkGT = await loadChunkLevelDataset("my-chunk-dataset");
const spanGT = await loadTokenLevelDataset("my-span-dataset");
```

When you configure `ChunkLevelEvaluation` or `TokenLevelEvaluation` with a `langsmithDatasetName` and don't pass `groundTruth` directly, the orchestrator loads the dataset from LangSmith automatically.

## Bring your own components

All retrieval components are defined as interfaces. Implement them to plug in any provider.

### Custom embedder

```typescript
import type { Embedder } from "rag-evaluation-system";

const myEmbedder: Embedder = {
  name: "MyEmbedder",
  dimension: 768,
  async embed(texts) {
    // Call your embedding API
    return texts.map(() => new Array(768).fill(0));
  },
  async embedQuery(query) {
    return (await this.embed([query]))[0];
  },
};
```

### Custom vector store

```typescript
import type { VectorStore } from "rag-evaluation-system";

const myStore: VectorStore = {
  name: "MyStore",
  async add(chunks, embeddings) { /* index chunks */ },
  async search(queryEmbedding, k) { /* return top-k chunks */ },
  async clear() { /* cleanup */ },
};
```

### Custom reranker

```typescript
import type { Reranker } from "rag-evaluation-system";

const myReranker: Reranker = {
  name: "MyReranker",
  async rerank(query, chunks, topK) {
    // Reorder chunks by relevance
    return chunks.slice(0, topK);
  },
};
```

### Custom chunker

```typescript
import type { Chunker, PositionAwareChunker } from "rag-evaluation-system";

// Basic chunker (text in, text[] out)
const myChunker: Chunker = {
  name: "MyChunker",
  chunk(text) {
    return text.split("\n\n");
  },
};

// For token-level evaluation, you can either:
// 1. Use a PositionAwareChunker directly
// 2. Pass a basic Chunker - it gets wrapped with ChunkerPositionAdapter automatically
```

## Built-in optional implementations

These are available as subpath imports to avoid bundling unnecessary dependencies.

```typescript
// OpenAI embeddings
import { OpenAIEmbedder } from "rag-evaluation-system/embedders/openai";
const embedder = await OpenAIEmbedder.create({ model: "text-embedding-3-small" });

// Chroma vector store
import { ChromaVectorStore } from "rag-evaluation-system/vector-stores/chroma";
const store = await ChromaVectorStore.create({ collectionName: "my-eval" });

// Cohere reranker
import { CohereReranker } from "rag-evaluation-system/rerankers/cohere";
const reranker = await CohereReranker.create({ model: "rerank-english-v3.0" });
```

## Metrics

### Chunk-level

| Metric | Description |
|--------|-------------|
| `chunkRecall` | Fraction of relevant chunks that were retrieved |
| `chunkPrecision` | Fraction of retrieved chunks that are relevant |
| `chunkF1` | Harmonic mean of chunk recall and precision |

### Token-level

| Metric | Description |
|--------|-------------|
| `spanRecall` | Fraction of ground truth character coverage retrieved |
| `spanPrecision` | Fraction of retrieved character coverage that is relevant |
| `spanIoU` | Intersection over union of retrieved vs ground truth spans |

## Evaluation options

Both `ChunkLevelEvaluation.run()` and `TokenLevelEvaluation.run()` accept:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chunker` | `Chunker` | required | Splits documents into chunks |
| `embedder` | `Embedder` | required | Generates embeddings |
| `k` | `number` | `5` | Number of chunks to retrieve per query |
| `vectorStore` | `VectorStore` | `InMemoryVectorStore` | Storage and retrieval backend |
| `reranker` | `Reranker` | none | Optional reranking after retrieval |
| `metrics` | metric array | all built-in | Metrics to compute |
| `batchSize` | `number` | `100` | Embedding batch size |
| `groundTruth` | ground truth array | loaded from LangSmith | Evaluation ground truth |

## License

MIT
