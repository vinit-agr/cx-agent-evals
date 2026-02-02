import { describe, it, expect } from "vitest";
import { ChunkLevelGroundTruthAssigner } from "../../../../src/synthetic-datagen/ground-truth/chunk-level.js";
import { TokenLevelGroundTruthAssigner } from "../../../../src/synthetic-datagen/ground-truth/token-level.js";
import type { LLMClient } from "../../../../src/synthetic-datagen/base.js";
import type { GeneratedQuery } from "../../../../src/synthetic-datagen/strategies/types.js";
import { createDocument, createCorpus } from "../../../../src/types/documents.js";
import { generateChunkId } from "../../../../src/utils/hashing.js";

const content =
  "RAG combines retrieval with generation. It uses relevant documents to answer questions.";
const doc = createDocument({ id: "test.md", content });
const corpus = createCorpus([doc]);

function makeLLM(response: string): LLMClient {
  return {
    name: "MockLLM",
    async complete() {
      return response;
    },
  };
}

describe("ChunkLevelGroundTruthAssigner", () => {
  it("should assign valid chunk IDs to queries", async () => {
    const chunker = { name: "simple", chunk: (t: string) => [t] };
    const expectedChunkId = String(generateChunkId(content));

    const llm = makeLLM(
      JSON.stringify({ relevant_chunk_ids: [expectedChunkId] }),
    );

    const assigner = new ChunkLevelGroundTruthAssigner(chunker);
    const queries: GeneratedQuery[] = [
      { query: "What does RAG combine?", targetDocId: "test.md", metadata: {} },
    ];

    const results = await assigner.assign(queries, {
      corpus,
      llmClient: llm,
      model: "gpt-4o",
    });

    expect(results).toHaveLength(1);
    expect(String(results[0].query.text)).toBe("What does RAG combine?");
    expect(results[0].relevantChunkIds).toHaveLength(1);
  });

  it("should filter out invalid chunk IDs", async () => {
    const chunker = { name: "simple", chunk: (t: string) => [t] };
    const llm = makeLLM(
      JSON.stringify({ relevant_chunk_ids: ["chunk_INVALID"] }),
    );

    const assigner = new ChunkLevelGroundTruthAssigner(chunker);
    const queries: GeneratedQuery[] = [
      { query: "test?", targetDocId: "test.md", metadata: {} },
    ];

    const results = await assigner.assign(queries, {
      corpus,
      llmClient: llm,
      model: "gpt-4o",
    });

    expect(results).toHaveLength(0);
  });
});

describe("TokenLevelGroundTruthAssigner", () => {
  it("should assign valid spans to queries", async () => {
    const llm = makeLLM(
      JSON.stringify({
        excerpts: ["RAG combines retrieval with generation"],
      }),
    );

    const assigner = new TokenLevelGroundTruthAssigner();
    const queries: GeneratedQuery[] = [
      {
        query: "What does RAG combine?",
        targetDocId: "test.md",
        metadata: {},
      },
    ];

    const results = await assigner.assign(queries, {
      corpus,
      llmClient: llm,
      model: "gpt-4o",
    });

    expect(results).toHaveLength(1);
    expect(results[0].relevantSpans).toHaveLength(1);
    expect(results[0].relevantSpans[0].start).toBe(0);
    expect(results[0].relevantSpans[0].text).toBe(
      "RAG combines retrieval with generation",
    );
  });

  it("should skip excerpts not found in document", async () => {
    const llm = makeLLM(
      JSON.stringify({
        excerpts: ["This text does not exist in the document at all"],
      }),
    );

    const assigner = new TokenLevelGroundTruthAssigner();
    const queries: GeneratedQuery[] = [
      { query: "test?", targetDocId: "test.md", metadata: {} },
    ];

    const results = await assigner.assign(queries, {
      corpus,
      llmClient: llm,
      model: "gpt-4o",
    });

    expect(results).toHaveLength(0);
  });
});
