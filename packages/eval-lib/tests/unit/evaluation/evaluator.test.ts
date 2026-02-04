import { describe, it, expect } from "vitest";
import { evaluateChunkLevel, evaluateTokenLevel } from "../../../src/evaluation/evaluator.js";
import { chunkRecall, chunkPrecision, chunkF1 } from "../../../src/evaluation/metrics/chunk-level/index.js";
import { spanRecall, spanPrecision, spanIoU } from "../../../src/evaluation/metrics/token-level/index.js";
import { ChunkId, DocumentId } from "../../../src/types/primitives.js";
import type { CharacterSpan } from "../../../src/types/chunks.js";

describe("evaluateChunkLevel", () => {
  const metrics = [chunkRecall, chunkPrecision, chunkF1];

  it("should return averaged scores for multiple results", () => {
    const results = [
      {
        retrieved: [ChunkId("a"), ChunkId("b")],
        groundTruth: [ChunkId("a"), ChunkId("b")],
      },
      {
        retrieved: [ChunkId("a")],
        groundTruth: [ChunkId("a"), ChunkId("b")],
      },
    ];

    const scores = evaluateChunkLevel({ results, metrics });

    // First result: recall=1, precision=1, f1=1
    // Second result: recall=0.5, precision=1, f1=0.667
    // Averages: recall=0.75, precision=1, f1=0.833
    expect(scores.chunk_recall).toBeCloseTo(0.75);
    expect(scores.chunk_precision).toBeCloseTo(1.0);
    expect(scores.chunk_f1).toBeCloseTo(0.833, 2);
  });

  it("should return zeros for empty results", () => {
    const scores = evaluateChunkLevel({ results: [], metrics });

    expect(scores.chunk_recall).toBe(0);
    expect(scores.chunk_precision).toBe(0);
    expect(scores.chunk_f1).toBe(0);
  });

  it("should handle single result", () => {
    const results = [
      {
        retrieved: [ChunkId("a"), ChunkId("b"), ChunkId("c")],
        groundTruth: [ChunkId("a"), ChunkId("d")],
      },
    ];

    const scores = evaluateChunkLevel({ results, metrics });

    // recall = 1/2 = 0.5 (only "a" from ground truth was retrieved)
    // precision = 1/3 = 0.333 (only "a" of retrieved was relevant)
    expect(scores.chunk_recall).toBeCloseTo(0.5);
    expect(scores.chunk_precision).toBeCloseTo(0.333, 2);
  });
});

describe("evaluateTokenLevel", () => {
  const metrics = [spanRecall, spanPrecision, spanIoU];
  const docId = DocumentId("doc1");

  function createSpan(start: number, end: number, text: string): CharacterSpan {
    return { docId, start, end, text };
  }

  it("should return averaged scores for multiple results", () => {
    const results = [
      {
        retrieved: [createSpan(0, 100, "x".repeat(100))],
        groundTruth: [createSpan(0, 100, "x".repeat(100))],
      },
      {
        retrieved: [createSpan(0, 50, "x".repeat(50))],
        groundTruth: [createSpan(0, 100, "x".repeat(100))],
      },
    ];

    const scores = evaluateTokenLevel({ results, metrics });

    // First result: recall=1, precision=1, iou=1
    // Second result: recall=0.5, precision=1, iou=0.5
    // Averages: recall=0.75, precision=1, iou=0.75
    expect(scores.span_recall).toBeCloseTo(0.75);
    expect(scores.span_precision).toBeCloseTo(1.0);
    expect(scores.span_iou).toBeCloseTo(0.75);
  });

  it("should return zeros for empty results", () => {
    const scores = evaluateTokenLevel({ results: [], metrics });

    expect(scores.span_recall).toBe(0);
    expect(scores.span_precision).toBe(0);
    expect(scores.span_iou).toBe(0);
  });

  it("should handle partial overlap", () => {
    const results = [
      {
        retrieved: [createSpan(50, 150, "x".repeat(100))],
        groundTruth: [createSpan(0, 100, "x".repeat(100))],
      },
    ];

    const scores = evaluateTokenLevel({ results, metrics });

    // overlap = 50 chars (50-100)
    // recall = 50/100 = 0.5
    // precision = 50/100 = 0.5
    // iou = 50/150 = 0.333
    expect(scores.span_recall).toBeCloseTo(0.5);
    expect(scores.span_precision).toBeCloseTo(0.5);
    expect(scores.span_iou).toBeCloseTo(0.333, 2);
  });
});
