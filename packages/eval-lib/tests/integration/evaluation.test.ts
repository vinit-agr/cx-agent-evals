import { describe, it, expect } from "vitest";
import { ChunkLevelEvaluation } from "../../src/evaluation/chunk-level.js";
import { TokenLevelEvaluation } from "../../src/evaluation/token-level.js";
import { RecursiveCharacterChunker } from "../../src/chunkers/recursive-character.js";
import { InMemoryVectorStore } from "../../src/vector-stores/in-memory.js";
import { createDocument, createCorpus } from "../../src/types/documents.js";
import { generateChunkId } from "../../src/utils/hashing.js";
import { QueryId, QueryText, DocumentId } from "../../src/types/primitives.js";
import { mockEmbedder } from "../fixtures.js";
import type { ChunkLevelGroundTruth, TokenLevelGroundTruth } from "../../src/types/index.js";

const content =
  "Retrieval-Augmented Generation (RAG) combines retrieval with generation. " +
  "It retrieves relevant documents and uses them to generate answers. " +
  "RAG improves accuracy by grounding responses in real data. " +
  "The retrieval step is critical for RAG performance.";

const doc = createDocument({ id: "rag.md", content });
const corpus = createCorpus([doc]);
const chunker = new RecursiveCharacterChunker({ chunkSize: 80, chunkOverlap: 0 });
const embedder = mockEmbedder(64);

describe("ChunkLevelEvaluation", () => {
  it("should run end-to-end with provided ground truth", async () => {
    const chunks = chunker.chunk(content);
    const chunkIds = chunks.map((c) => generateChunkId(c));

    const groundTruth: ChunkLevelGroundTruth[] = [
      {
        query: {
          id: QueryId("q_0"),
          text: QueryText("What is RAG?"),
          metadata: {},
        },
        relevantChunkIds: [chunkIds[0]],
      },
    ];

    const evaluation = new ChunkLevelEvaluation({
      corpus,
      langsmithDatasetName: "test",
    });

    const result = await evaluation.run({
      chunker,
      embedder,
      k: 3,
      vectorStore: new InMemoryVectorStore(),
      groundTruth,
    });

    expect(result.metrics).toHaveProperty("chunk_recall");
    expect(result.metrics).toHaveProperty("chunk_precision");
    expect(result.metrics).toHaveProperty("chunk_f1");
    expect(result.metrics.chunk_recall).toBeGreaterThanOrEqual(0);
    expect(result.metrics.chunk_recall).toBeLessThanOrEqual(1);
  });

  it("should clean up vector store after run", async () => {
    const store = new InMemoryVectorStore();
    const chunks = chunker.chunk(content);
    const groundTruth: ChunkLevelGroundTruth[] = [
      {
        query: { id: QueryId("q_0"), text: QueryText("test"), metadata: {} },
        relevantChunkIds: [generateChunkId(chunks[0])],
      },
    ];

    const evaluation = new ChunkLevelEvaluation({
      corpus,
      langsmithDatasetName: "test",
    });

    await evaluation.run({
      chunker,
      embedder,
      k: 1,
      vectorStore: store,
      groundTruth,
    });

    // Store should be cleared
    const results = await store.search(await embedder.embedQuery("test"), 5);
    expect(results).toHaveLength(0);
  });
});

describe("TokenLevelEvaluation", () => {
  it("should run end-to-end with provided ground truth", async () => {
    const groundTruth: TokenLevelGroundTruth[] = [
      {
        query: {
          id: QueryId("q_0"),
          text: QueryText("What does RAG combine?"),
          metadata: {},
        },
        relevantSpans: [
          {
            docId: DocumentId("rag.md"),
            start: 0,
            end: 73,
            text: content.slice(0, 73),
          },
        ],
      },
    ];

    const evaluation = new TokenLevelEvaluation({
      corpus,
      langsmithDatasetName: "test",
    });

    const result = await evaluation.run({
      chunker,
      embedder,
      k: 3,
      vectorStore: new InMemoryVectorStore(),
      groundTruth,
    });

    expect(result.metrics).toHaveProperty("span_recall");
    expect(result.metrics).toHaveProperty("span_precision");
    expect(result.metrics).toHaveProperty("span_iou");
    expect(result.metrics.span_recall).toBeGreaterThanOrEqual(0);
  });

  it("should auto-wrap basic Chunker with adapter", async () => {
    const basicChunker = { name: "basic", chunk: (t: string) => [t] };
    const groundTruth: TokenLevelGroundTruth[] = [
      {
        query: { id: QueryId("q_0"), text: QueryText("test"), metadata: {} },
        relevantSpans: [
          { docId: DocumentId("rag.md"), start: 0, end: 50, text: content.slice(0, 50) },
        ],
      },
    ];

    const evaluation = new TokenLevelEvaluation({
      corpus,
      langsmithDatasetName: "test",
    });

    // Should not throw - basic chunker gets auto-wrapped
    const result = await evaluation.run({
      chunker: basicChunker,
      embedder,
      k: 1,
      vectorStore: new InMemoryVectorStore(),
      groundTruth,
    });

    expect(result.metrics).toHaveProperty("span_recall");
  });
});
