import { describe, it, expect } from "vitest";
import {
  createLangSmithEvaluator,
  createLangSmithEvaluators,
} from "../../../src/langsmith/evaluator-adapters.js";
import { recall, precision, iou, f1 } from "../../../src/evaluation/metrics/index.js";
import { DocumentId } from "../../../src/types/primitives.js";
import type { Metric } from "../../../src/evaluation/metrics/base.js";

describe("createLangSmithEvaluator", () => {
  const docId = "doc1";

  function makeArgs(
    retrievedSpans: Array<{ docId: string; start: number; end: number; text: string }>,
    relevantSpans: Array<{ docId: string; start: number; end: number; text: string }>,
  ) {
    return {
      outputs: { retrievedSpans },
      referenceOutputs: { relevantSpans },
    };
  }

  it("should use metric name as key", () => {
    const evaluator = createLangSmithEvaluator(recall);
    const result = evaluator(makeArgs([], []));
    expect(result.key).toBe("recall");
  });

  it("should calculate recall from serialized spans", () => {
    const evaluator = createLangSmithEvaluator(recall);
    const result = evaluator(
      makeArgs(
        [{ docId, start: 0, end: 100, text: "x".repeat(100) }],
        [{ docId, start: 0, end: 100, text: "x".repeat(100) }],
      ),
    );
    expect(result.score).toBeCloseTo(1.0);
  });

  it("should calculate precision from serialized spans", () => {
    const evaluator = createLangSmithEvaluator(precision);
    const result = evaluator(
      makeArgs(
        [{ docId, start: 0, end: 100, text: "x".repeat(100) }],
        [{ docId, start: 0, end: 50, text: "x".repeat(50) }],
      ),
    );
    expect(result.score).toBeCloseTo(0.5);
  });

  it("should handle partial overlap for IoU", () => {
    const evaluator = createLangSmithEvaluator(iou);
    const result = evaluator(
      makeArgs(
        [{ docId, start: 50, end: 150, text: "x".repeat(100) }],
        [{ docId, start: 0, end: 100, text: "x".repeat(100) }],
      ),
    );
    // overlap=50, union=150, iou≈0.333
    expect(result.score).toBeCloseTo(0.333, 2);
  });

  it("should deserialize docId as branded DocumentId", () => {
    const customMetric: Metric = {
      name: "docid-check",
      calculate: (retrieved, groundTruth) => {
        // Verify the docId is properly branded
        return retrieved[0]?.docId === DocumentId("doc1") ? 1 : 0;
      },
    };
    const evaluator = createLangSmithEvaluator(customMetric);
    const result = evaluator(
      makeArgs(
        [{ docId: "doc1", start: 0, end: 10, text: "x".repeat(10) }],
        [{ docId: "doc1", start: 0, end: 10, text: "x".repeat(10) }],
      ),
    );
    expect(result.score).toBe(1);
  });

  it("should handle empty/missing outputs gracefully", () => {
    const evaluator = createLangSmithEvaluator(recall);
    const result = evaluator({ outputs: {}, referenceOutputs: {} });
    // Empty retrieved, empty ground truth → recall returns 1.0 (both empty)
    expect(result.score).toBe(1.0);
  });

  it("should handle undefined outputs", () => {
    const evaluator = createLangSmithEvaluator(precision);
    const result = evaluator({});
    // No retrieved → precision returns 0
    expect(result.score).toBe(0);
  });
});

describe("createLangSmithEvaluators", () => {
  it("should create an evaluator for each metric", () => {
    const evaluators = createLangSmithEvaluators([recall, precision, iou, f1]);
    expect(evaluators).toHaveLength(4);
  });

  it("should preserve metric names in order", () => {
    const evaluators = createLangSmithEvaluators([recall, precision, iou, f1]);
    const args = {
      outputs: { retrievedSpans: [] },
      referenceOutputs: { relevantSpans: [] },
    };
    const keys = evaluators.map((ev) => ev(args).key);
    expect(keys).toEqual(["recall", "precision", "iou", "f1"]);
  });
});
