import { describe, it, expect, vi, beforeEach } from "vitest";
import { runExperiment } from "../../../src/experiments/runner.js";
import type { Retriever } from "../../../src/experiments/retriever.interface.js";
import type { Corpus, PositionAwareChunk, ChunkLevelGroundTruth, TokenLevelGroundTruth } from "../../../src/types/index.js";
import { DocumentId, QueryId, QueryText, ChunkId, PositionAwareChunkId } from "../../../src/types/primitives.js";
import { chunkRecall } from "../../../src/evaluation/metrics/chunk-level/recall.js";
import { spanRecall } from "../../../src/evaluation/metrics/token-level/recall.js";

describe("runExperiment", () => {
  let mockRetriever: Retriever;
  let corpus: Corpus;

  beforeEach(() => {
    mockRetriever = {
      name: "mock-retriever",
      init: vi.fn().mockResolvedValue(undefined),
      retrieve: vi.fn().mockResolvedValue([
        {
          id: PositionAwareChunkId("pa_1"),
          content: "test content",
          docId: DocumentId("doc1"),
          start: 0,
          end: 12,
          metadata: {},
        } as PositionAwareChunk,
      ]),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    corpus = {
      id: "test-corpus",
      documents: [
        { id: DocumentId("doc1"), content: "test content here", metadata: {} },
      ],
    };
  });

  describe("chunk-level experiments", () => {
    it("should run chunk-level experiment and return results", async () => {
      const groundTruth: ChunkLevelGroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test query") },
          relevantChunkIds: [ChunkId("test content")], // ChunkId is hash of content
        },
      ];

      const result = await runExperiment({
        name: "test-experiment",
        evaluationType: "chunk-level",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
      });

      expect(result.experimentName).toBe("test-experiment");
      expect(result.retrieverName).toBe("mock-retriever");
      expect(result.metrics).toHaveProperty("chunk_recall");
      expect(result.metrics).toHaveProperty("chunk_precision");
      expect(result.metrics).toHaveProperty("chunk_f1");
      expect(result.metadata.corpusSize).toBe(1);
      expect(result.metadata.queryCount).toBe(1);
      expect(result.metadata.k).toBe(5);
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should use custom metrics when provided", async () => {
      const groundTruth: ChunkLevelGroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantChunkIds: [ChunkId("chunk1")],
        },
      ];

      const result = await runExperiment({
        name: "test",
        evaluationType: "chunk-level",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
        metrics: [chunkRecall],
      });

      expect(Object.keys(result.metrics)).toEqual(["chunk_recall"]);
    });
  });

  describe("token-level experiments", () => {
    it("should run token-level experiment and return results", async () => {
      const groundTruth: TokenLevelGroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test query") },
          relevantSpans: [
            { docId: DocumentId("doc1"), start: 0, end: 12, text: "test content" },
          ],
        },
      ];

      const result = await runExperiment({
        name: "test-experiment",
        evaluationType: "token-level",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
      });

      expect(result.experimentName).toBe("test-experiment");
      expect(result.retrieverName).toBe("mock-retriever");
      expect(result.metrics).toHaveProperty("span_recall");
      expect(result.metrics).toHaveProperty("span_precision");
      expect(result.metrics).toHaveProperty("span_iou");
    });

    it("should use custom metrics when provided", async () => {
      const groundTruth: TokenLevelGroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantSpans: [
            { docId: DocumentId("doc1"), start: 0, end: 10, text: "0123456789" },
          ],
        },
      ];

      const result = await runExperiment({
        name: "test",
        evaluationType: "token-level",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
        metrics: [spanRecall],
      });

      expect(Object.keys(result.metrics)).toEqual(["span_recall"]);
    });
  });

  describe("lifecycle", () => {
    it("should call retriever.init before retrieve", async () => {
      const callOrder: string[] = [];
      mockRetriever.init = vi.fn().mockImplementation(() => {
        callOrder.push("init");
        return Promise.resolve();
      });
      mockRetriever.retrieve = vi.fn().mockImplementation(() => {
        callOrder.push("retrieve");
        return Promise.resolve([]);
      });

      const groundTruth: ChunkLevelGroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantChunkIds: [],
        },
      ];

      await runExperiment({
        name: "test",
        evaluationType: "chunk-level",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
      });

      expect(mockRetriever.init).toHaveBeenCalledWith(corpus);
      expect(callOrder[0]).toBe("init");
      expect(callOrder[1]).toBe("retrieve");
    });

    it("should call retriever.cleanup after completion", async () => {
      const groundTruth: ChunkLevelGroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantChunkIds: [],
        },
      ];

      await runExperiment({
        name: "test",
        evaluationType: "chunk-level",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
      });

      expect(mockRetriever.cleanup).toHaveBeenCalled();
    });

    it("should call retriever.cleanup even on error", async () => {
      mockRetriever.retrieve = vi.fn().mockRejectedValue(new Error("retrieve error"));

      const groundTruth: ChunkLevelGroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantChunkIds: [],
        },
      ];

      await expect(
        runExperiment({
          name: "test",
          evaluationType: "chunk-level",
          corpus,
          groundTruth,
          retriever: mockRetriever,
          k: 5,
        })
      ).rejects.toThrow("retrieve error");

      expect(mockRetriever.cleanup).toHaveBeenCalled();
    });
  });
});
