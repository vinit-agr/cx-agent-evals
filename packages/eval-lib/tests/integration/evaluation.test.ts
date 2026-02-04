import { describe, it, expect } from "vitest";
import { Evaluation } from "../../src/evaluation/evaluation.js";
import { RecursiveCharacterChunker } from "../../src/chunkers/recursive-character.js";
import { InMemoryVectorStore } from "../../src/vector-stores/in-memory.js";
import { createDocument, createCorpus } from "../../src/types/documents.js";
import { QueryId, QueryText, DocumentId } from "../../src/types/primitives.js";
import { mockEmbedder } from "../fixtures.js";
import type { GroundTruth } from "../../src/types/index.js";

const content =
  "Retrieval-Augmented Generation (RAG) combines retrieval with generation. " +
  "It retrieves relevant documents and uses them to generate answers. " +
  "RAG improves accuracy by grounding responses in real data. " +
  "The retrieval step is critical for RAG performance.";

const doc = createDocument({ id: "rag.md", content });
const corpus = createCorpus([doc]);
const chunker = new RecursiveCharacterChunker({ chunkSize: 80, chunkOverlap: 0 });
const embedder = mockEmbedder(64);

describe("Evaluation", () => {
  it("should run end-to-end with provided ground truth", async () => {
    const groundTruth: GroundTruth[] = [
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

    const evaluation = new Evaluation({
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

    expect(result.metrics).toHaveProperty("recall");
    expect(result.metrics).toHaveProperty("precision");
    expect(result.metrics).toHaveProperty("iou");
    expect(result.metrics.recall).toBeGreaterThanOrEqual(0);
  });

  it("should clean up vector store after run", async () => {
    const store = new InMemoryVectorStore();
    const groundTruth: GroundTruth[] = [
      {
        query: { id: QueryId("q_0"), text: QueryText("test"), metadata: {} },
        relevantSpans: [
          { docId: DocumentId("rag.md"), start: 0, end: 50, text: content.slice(0, 50) },
        ],
      },
    ];

    const evaluation = new Evaluation({
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
