import { describe, it, expect } from "vitest";
import { generateChunkId, generatePaChunkId } from "../../../src/utils/hashing.js";

describe("generateChunkId", () => {
  it("should produce deterministic IDs", () => {
    expect(generateChunkId("hello world")).toBe(generateChunkId("hello world"));
  });

  it("should produce different IDs for different content", () => {
    expect(generateChunkId("hello")).not.toBe(generateChunkId("world"));
  });

  it("should have chunk_ prefix", () => {
    expect(String(generateChunkId("test"))).toMatch(/^chunk_[a-f0-9]{12}$/);
  });
});

describe("generatePaChunkId", () => {
  it("should produce deterministic IDs", () => {
    expect(generatePaChunkId("hello world")).toBe(generatePaChunkId("hello world"));
  });

  it("should have pa_chunk_ prefix", () => {
    expect(String(generatePaChunkId("test"))).toMatch(/^pa_chunk_[a-f0-9]{12}$/);
  });
});
