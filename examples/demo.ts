/**
 * End-to-end demo of the RAG evaluation library.
 * Uses InMemoryVectorStore and a mock embedder — no API keys needed.
 *
 * Run with: npx tsx examples/demo.ts
 */

import {
  createDocument,
  createCorpus,
  RecursiveCharacterChunker,
  InMemoryVectorStore,
  ChunkLevelEvaluation,
  TokenLevelEvaluation,
  chunkRecall,
  chunkPrecision,
  chunkF1,
  spanRecall,
  spanPrecision,
  spanIoU,
  generateChunkId,
  createCharacterSpan,
  ChunkId,
  QueryId,
  QueryText,
} from "../src/index.js";
import type { Embedder } from "../src/embedders/embedder.interface.js";

// ---------------------------------------------------------------------------
// 1. Build a corpus
// ---------------------------------------------------------------------------

const docs = [
  createDocument({
    id: "machine-learning.md",
    content:
      "Machine learning is a subset of artificial intelligence. " +
      "It allows systems to learn from data without being explicitly programmed. " +
      "Common approaches include supervised learning, unsupervised learning, and reinforcement learning. " +
      "Deep learning uses neural networks with many layers to model complex patterns.",
  }),
  createDocument({
    id: "retrieval-augmented-generation.md",
    content:
      "Retrieval-augmented generation (RAG) combines information retrieval with text generation. " +
      "A retriever finds relevant documents from a knowledge base. " +
      "The retrieved context is then passed to a language model to generate an answer. " +
      "RAG reduces hallucinations by grounding responses in factual sources.",
  }),
];

const corpus = createCorpus(docs);

console.log(`Corpus: ${corpus.documents.length} documents\n`);

// ---------------------------------------------------------------------------
// 2. Set up components
// ---------------------------------------------------------------------------

// Bag-of-words embedder — produces meaningful similarity without external APIs.
// Builds a shared vocabulary across all texts seen, then represents each text
// as a normalized term-frequency vector.
function bagOfWordsEmbedder(): Embedder {
  const vocab = new Map<string, number>();

  function tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  }

  function vectorize(text: string): number[] {
    const tokens = tokenize(text);
    for (const t of tokens) {
      if (!vocab.has(t)) vocab.set(t, vocab.size);
    }
    const vec = new Array(vocab.size).fill(0);
    for (const t of tokens) vec[vocab.get(t)!]++;
    const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
    return norm > 0 ? vec.map((v: number) => v / norm) : vec;
  }

  // Pad all vectors to the same length (vocabulary grows over time)
  function pad(vec: number[]): number[] {
    if (vec.length < vocab.size) {
      return [...vec, ...new Array(vocab.size - vec.length).fill(0)];
    }
    return vec;
  }

  return {
    name: "BagOfWords",
    dimension: 0, // dynamic
    async embed(texts: readonly string[]) {
      const vecs = texts.map(vectorize);
      return vecs.map(pad);
    },
    async embedQuery(query: string) {
      const vec = vectorize(query);
      return pad(vec);
    },
  };
}

const chunker = new RecursiveCharacterChunker({ chunkSize: 120, chunkOverlap: 20 });
const embedder = bagOfWordsEmbedder();

// ---------------------------------------------------------------------------
// 3. Chunk-level evaluation
// ---------------------------------------------------------------------------

console.log("=== Chunk-Level Evaluation ===\n");

// Chunk the first doc so we can reference real chunk IDs in ground truth
const mlChunks = chunker.chunk(docs[0].content);
const mlChunkIds = mlChunks.map((text) => generateChunkId(text));

console.log(`Chunks from "${docs[0].id}":`);
mlChunks.forEach((text, i) => {
  console.log(`  [${mlChunkIds[i]}] "${text.substring(0, 60)}..."`);
});
console.log();

const chunkEval = new ChunkLevelEvaluation({
  corpus,
  langsmithDatasetName: "demo-chunk-eval",
});

const chunkResult = await chunkEval.run({
  chunker,
  embedder,
  k: 3,
  metrics: [chunkRecall, chunkPrecision, chunkF1],
  groundTruth: [
    {
      query: {
        id: QueryId("q1"),
        text: QueryText("What is machine learning?"),
        metadata: {},
      },
      relevantChunkIds: [mlChunkIds[0]],
    },
    {
      query: {
        id: QueryId("q2"),
        text: QueryText("What are common ML approaches?"),
        metadata: {},
      },
      relevantChunkIds: [mlChunkIds[0], mlChunkIds[1]],
    },
  ],
});

console.log("Chunk-level results:");
for (const [metric, score] of Object.entries(chunkResult.metrics)) {
  console.log(`  ${metric}: ${score.toFixed(4)}`);
}

// ---------------------------------------------------------------------------
// 4. Token-level evaluation
// ---------------------------------------------------------------------------

console.log("\n=== Token-Level Evaluation ===\n");

const ragDoc = docs[1];
const ragText = ragDoc.content;

// Ground truth: the first sentence is the relevant span
const spanText = "Retrieval-augmented generation (RAG) combines information retrieval with text generation.";
const spanStart = ragText.indexOf(spanText);

console.log(`Ground truth span: "${spanText.substring(0, 50)}..."`);
console.log(`  Position: [${spanStart}, ${spanStart + spanText.length}]\n`);

const tokenEval = new TokenLevelEvaluation({
  corpus,
  langsmithDatasetName: "demo-token-eval",
});

const tokenResult = await tokenEval.run({
  chunker,
  embedder,
  k: 3,
  metrics: [spanRecall, spanPrecision, spanIoU],
  groundTruth: [
    {
      query: {
        id: QueryId("q3"),
        text: QueryText("What is RAG?"),
        metadata: {},
      },
      relevantSpans: [
        createCharacterSpan({
          docId: String(ragDoc.id),
          start: spanStart,
          end: spanStart + spanText.length,
          text: spanText,
        }),
      ],
    },
  ],
});

console.log("Token-level results:");
for (const [metric, score] of Object.entries(tokenResult.metrics)) {
  console.log(`  ${metric}: ${score.toFixed(4)}`);
}

console.log("\nDone.");
