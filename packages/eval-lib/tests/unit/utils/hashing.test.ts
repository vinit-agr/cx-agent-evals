import { describe, it, expect } from "vitest";
import { generatePaChunkId } from "../../../src/utils/hashing.js";

describe("generatePaChunkId", () => {
  it("should produce deterministic IDs", () => {
    expect(generatePaChunkId("hello world")).toBe(generatePaChunkId("hello world"));
  });

  it("should produce different IDs for different content", () => {
    expect(generatePaChunkId("hello")).not.toBe(generatePaChunkId("world"));
  });

  it("should have pa_chunk_ prefix", () => {
    expect(String(generatePaChunkId("test"))).toMatch(/^pa_chunk_[a-f0-9]{12}$/);
  });
});
