import { describe, it, expect } from "vitest";
import { InMemoryVectorStore } from "../../../src/vector-stores/in-memory.js";
import { samplePositionAwareChunks, mockEmbedder } from "../../fixtures.js";

describe("InMemoryVectorStore", () => {
  it("should add and search chunks", async () => {
    const store = new InMemoryVectorStore();
    const chunks = samplePositionAwareChunks();
    const embedder = mockEmbedder();
    const embeddings = await embedder.embed(chunks.map((c) => c.content));

    await store.add(chunks, embeddings);

    const queryEmb = await embedder.embedQuery(chunks[0].content);
    const results = await store.search(queryEmb, 2);

    expect(results).toHaveLength(2);
    // First result should be the most similar (itself)
    expect(results[0].chunk.id).toBe(chunks[0].id);
    expect(results[0].score).toBeTypeOf("number");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("should return scores in descending order", async () => {
    const store = new InMemoryVectorStore();
    const chunks = samplePositionAwareChunks();
    const embedder = mockEmbedder();
    const embeddings = await embedder.embed(chunks.map((c) => c.content));

    await store.add(chunks, embeddings);

    const queryEmb = await embedder.embedQuery(chunks[0].content);
    const results = await store.search(queryEmb, chunks.length);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("should respect k parameter", async () => {
    const store = new InMemoryVectorStore();
    const chunks = samplePositionAwareChunks();
    const embedder = mockEmbedder();
    const embeddings = await embedder.embed(chunks.map((c) => c.content));

    await store.add(chunks, embeddings);

    const queryEmb = await embedder.embedQuery(chunks[0].content);
    const results = await store.search(queryEmb, 1);
    expect(results).toHaveLength(1);
  });

  it("should clear all data", async () => {
    const store = new InMemoryVectorStore();
    const chunks = samplePositionAwareChunks();
    const embedder = mockEmbedder();
    const embeddings = await embedder.embed(chunks.map((c) => c.content));

    await store.add(chunks, embeddings);
    await store.clear();

    const queryEmb = await embedder.embedQuery("test");
    const results = await store.search(queryEmb, 5);
    expect(results).toHaveLength(0);
  });

  it("should return empty for empty store", async () => {
    const store = new InMemoryVectorStore();
    const results = await store.search([0.1, 0.2, 0.3], 5);
    expect(results).toHaveLength(0);
  });

  it("should preserve chunk positions", async () => {
    const store = new InMemoryVectorStore();
    const chunks = samplePositionAwareChunks();
    const embedder = mockEmbedder();
    const embeddings = await embedder.embed(chunks.map((c) => c.content));

    await store.add(chunks, embeddings);

    const queryEmb = await embedder.embedQuery(chunks[0].content);
    const results = await store.search(queryEmb, 1);

    expect(results[0].chunk.start).toBe(0);
    expect(results[0].chunk.end).toBe(50);
    expect(results[0].chunk.docId).toBe(chunks[0].docId);
  });
});
