import { describe, it, expect, vi } from "vitest";
import { ChunkerPositionAdapter } from "../../../src/chunkers/adapter.js";
import { RecursiveCharacterChunker } from "../../../src/chunkers/recursive-character.js";
import { isPositionAwareChunker } from "../../../src/chunkers/chunker.interface.js";
import { createDocument } from "../../../src/types/documents.js";
import type { Chunker } from "../../../src/chunkers/chunker.interface.js";

describe("isPositionAwareChunker", () => {
  it("should return true for RecursiveCharacterChunker", () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 100, chunkOverlap: 0 });
    expect(isPositionAwareChunker(chunker)).toBe(true);
  });

  it("should return false for basic chunker", () => {
    const chunker: Chunker = { name: "basic", chunk: (t) => [t] };
    expect(isPositionAwareChunker(chunker)).toBe(false);
  });
});

describe("ChunkerPositionAdapter", () => {
  it("should locate chunks sequentially", () => {
    const fakeChunker: Chunker = {
      name: "FakeChunker",
      chunk: () => ["AA", "BB", "CC"],
    };
    const adapter = new ChunkerPositionAdapter(fakeChunker);
    const doc = createDocument({ id: "test.md", content: "AABBCC" });
    const chunks = adapter.chunkWithPositions(doc);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end).toBe(2);
    expect(chunks[1].start).toBe(2);
    expect(chunks[1].end).toBe(4);
    expect(chunks[2].start).toBe(4);
    expect(chunks[2].end).toBe(6);
  });

  it("should skip non-locatable chunks", () => {
    const fakeChunker: Chunker = {
      name: "BadChunker",
      chunk: () => ["exists", "DOES_NOT_EXIST"],
    };
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const adapter = new ChunkerPositionAdapter(fakeChunker);
    const doc = createDocument({ id: "test.md", content: "exists in the doc" });
    const chunks = adapter.chunkWithPositions(doc);

    expect(chunks).toHaveLength(1);
    expect(adapter.skippedChunks).toBe(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should have correct name", () => {
    const fakeChunker: Chunker = { name: "MyChunker", chunk: () => [] };
    const adapter = new ChunkerPositionAdapter(fakeChunker);
    expect(adapter.name).toBe("PositionAdapter(MyChunker)");
  });
});

describe("RecursiveCharacterChunker", () => {
  it("should reject overlap >= chunkSize", () => {
    expect(() => new RecursiveCharacterChunker({ chunkSize: 100, chunkOverlap: 100 })).toThrow();
    expect(() => new RecursiveCharacterChunker({ chunkSize: 100, chunkOverlap: 200 })).toThrow();
  });

  it("should chunk text into pieces no larger than chunkSize", () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 50, chunkOverlap: 0 });
    const text = "A".repeat(200);
    const chunks = chunker.chunk(text);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(50);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("should return single chunk for small text", () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 1000 });
    const chunks = chunker.chunk("short text");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("short text");
  });

  it("should produce valid positions with chunkWithPositions", () => {
    const content = "Hello world.\n\nThis is a test paragraph.\n\nAnother paragraph here with more text.";
    const doc = createDocument({ id: "test.md", content });
    const chunker = new RecursiveCharacterChunker({ chunkSize: 40, chunkOverlap: 0 });
    const chunks = chunker.chunkWithPositions(doc);

    for (const chunk of chunks) {
      expect(chunk.start).toBeGreaterThanOrEqual(0);
      expect(chunk.end).toBeGreaterThan(chunk.start);
      expect(content.slice(chunk.start, chunk.end)).toBe(chunk.content);
    }
  });

  it("should split at paragraph boundaries first", () => {
    const content = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.";
    const chunker = new RecursiveCharacterChunker({ chunkSize: 25, chunkOverlap: 0 });
    const chunks = chunker.chunk(content);
    // Each paragraph is ~21 chars, fits in 25, so should be separate chunks
    expect(chunks).toContain("First paragraph here.");
    expect(chunks).toContain("Second paragraph here.");
    expect(chunks).toContain("Third paragraph here.");
  });
});
