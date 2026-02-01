import { describe, it, expect } from "vitest";
import { chunkRecall, chunkPrecision, chunkF1 } from "../../../src/evaluation/metrics/chunk-level/index.js";
import { ChunkId } from "../../../src/types/primitives.js";

const id = (s: string) => ChunkId(s);

describe("chunkRecall", () => {
  it("should return 1.0 for perfect recall", () => {
    expect(chunkRecall.calculate([id("a"), id("b")], [id("a"), id("b")])).toBe(1.0);
  });

  it("should return 0.5 for partial recall", () => {
    expect(chunkRecall.calculate([id("a")], [id("a"), id("b")])).toBe(0.5);
  });

  it("should return 0.0 for no recall", () => {
    expect(chunkRecall.calculate([id("c")], [id("a"), id("b")])).toBe(0.0);
  });

  it("should return 1.0 for empty ground truth (vacuous truth)", () => {
    expect(chunkRecall.calculate([id("a")], [])).toBe(1.0);
  });

  it("should return 1.0 for both empty", () => {
    expect(chunkRecall.calculate([], [])).toBe(1.0);
  });
});

describe("chunkPrecision", () => {
  it("should return 1.0 for perfect precision", () => {
    expect(chunkPrecision.calculate([id("a"), id("b")], [id("a"), id("b")])).toBe(1.0);
  });

  it("should return 0.25 for low precision", () => {
    expect(
      chunkPrecision.calculate([id("a"), id("b"), id("c"), id("d")], [id("a")]),
    ).toBe(0.25);
  });

  it("should return 0.0 for empty retrieved", () => {
    expect(chunkPrecision.calculate([], [id("a")])).toBe(0.0);
  });
});

describe("chunkF1", () => {
  it("should return 1.0 for perfect match", () => {
    expect(chunkF1.calculate([id("a"), id("b")], [id("a"), id("b")])).toBe(1.0);
  });

  it("should return 0.5 for balanced partial", () => {
    expect(chunkF1.calculate([id("a"), id("b")], [id("a"), id("c")])).toBeCloseTo(0.5, 5);
  });

  it("should return 0.0 for no overlap", () => {
    expect(chunkF1.calculate([id("a")], [id("b")])).toBe(0.0);
  });

  it("should return 0.0 for both empty retrieved and non-empty gt", () => {
    // recall = 1.0 (vacuous), precision = 0.0 => F1 = 0
    // Actually: retrieved is empty so precision = 0, gt is non-empty so recall = 0
    expect(chunkF1.calculate([], [id("a")])).toBe(0.0);
  });
});
