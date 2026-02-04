import { describe, it, expect, vi, beforeEach } from "vitest";
import { runExperiment } from "../../../src/experiments/runner.js";
import type { Retriever } from "../../../src/experiments/retriever.interface.js";
import type { Corpus, PositionAwareChunk, GroundTruth } from "../../../src/types/index.js";
import { DocumentId, QueryId, QueryText, PositionAwareChunkId } from "../../../src/types/primitives.js";
import { recall } from "../../../src/evaluation/metrics/recall.js";

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

  describe("span-based experiments", () => {
    it("should run experiment and return results", async () => {
      const groundTruth: GroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test query") },
          relevantSpans: [
            { docId: DocumentId("doc1"), start: 0, end: 12, text: "test content" },
          ],
        },
      ];

      const result = await runExperiment({
        name: "test-experiment",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
      });

      expect(result.experimentName).toBe("test-experiment");
      expect(result.retrieverName).toBe("mock-retriever");
      expect(result.metrics).toHaveProperty("recall");
      expect(result.metrics).toHaveProperty("precision");
      expect(result.metrics).toHaveProperty("iou");
    });

    it("should use custom metrics when provided", async () => {
      const groundTruth: GroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantSpans: [
            { docId: DocumentId("doc1"), start: 0, end: 10, text: "0123456789" },
          ],
        },
      ];

      const result = await runExperiment({
        name: "test",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
        metrics: [recall],
      });

      expect(Object.keys(result.metrics)).toEqual(["recall"]);
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

      const groundTruth: GroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantSpans: [],
        },
      ];

      await runExperiment({
        name: "test",
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
      const groundTruth: GroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantSpans: [],
        },
      ];

      await runExperiment({
        name: "test",
        corpus,
        groundTruth,
        retriever: mockRetriever,
        k: 5,
      });

      expect(mockRetriever.cleanup).toHaveBeenCalled();
    });

    it("should call retriever.cleanup even on error", async () => {
      mockRetriever.retrieve = vi.fn().mockRejectedValue(new Error("retrieve error"));

      const groundTruth: GroundTruth[] = [
        {
          query: { id: QueryId("q1"), text: QueryText("test") },
          relevantSpans: [],
        },
      ];

      await expect(
        runExperiment({
          name: "test",
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
