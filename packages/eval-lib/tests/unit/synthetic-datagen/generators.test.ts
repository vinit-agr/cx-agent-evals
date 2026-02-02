import { describe, it, expect } from "vitest";
import { ChunkLevelSyntheticDatasetGenerator } from "../../../src/synthetic-datagen/chunk-level/generator.js";
import { TokenLevelSyntheticDatasetGenerator } from "../../../src/synthetic-datagen/token-level/generator.js";
import type { LLMClient } from "../../../src/synthetic-datagen/base.js";
import { createDocument, createCorpus } from "../../../src/types/documents.js";
import { generateChunkId } from "../../../src/utils/hashing.js";

const content = "RAG combines retrieval with generation. It uses relevant documents to answer questions.";
const doc = createDocument({ id: "test.md", content });
const corpus = createCorpus([doc]);

function mockLLM(responses: Record<string, string>): LLMClient {
  let _callCount = 0;
  return {
    name: "MockLLM",
    async complete(params) {
      _callCount++;
      // Return based on call order or content
      for (const [key, value] of Object.entries(responses)) {
        if (params.messages.some((m) => m.content.includes(key))) {
          return value;
        }
      }
      return JSON.stringify({});
    },
  };
}

describe("ChunkLevelSyntheticDatasetGenerator", () => {
  it("should generate ground truth with valid chunk IDs", async () => {
    const chunker = { name: "simple", chunk: (t: string) => [t] };
    const expectedChunkId = String(generateChunkId(content));

    const llm = mockLLM({
      "Generate": JSON.stringify({
        qa_pairs: [
          { query: "What does RAG combine?", relevant_chunk_ids: [expectedChunkId] },
        ],
      }),
    });

    const generator = new ChunkLevelSyntheticDatasetGenerator({
      llmClient: llm,
      corpus,
      chunker,
    });

    const results = await generator.generate({
      queriesPerDoc: 1,
      uploadToLangsmith: false,
    });

    expect(results).toHaveLength(1);
    expect(String(results[0].query.text)).toBe("What does RAG combine?");
    expect(results[0].relevantChunkIds).toHaveLength(1);
  });

  it("should filter out invalid chunk IDs", async () => {
    const chunker = { name: "simple", chunk: (t: string) => [t] };

    const llm = mockLLM({
      "Generate": JSON.stringify({
        qa_pairs: [
          { query: "test?", relevant_chunk_ids: ["chunk_INVALID"] },
        ],
      }),
    });

    const generator = new ChunkLevelSyntheticDatasetGenerator({
      llmClient: llm,
      corpus,
      chunker,
    });

    const results = await generator.generate({
      queriesPerDoc: 1,
      uploadToLangsmith: false,
    });

    // No valid IDs, so no ground truth entries
    expect(results).toHaveLength(0);
  });
});

describe("TokenLevelSyntheticDatasetGenerator", () => {
  it("should generate ground truth with valid spans", async () => {
    let callIndex = 0;
    const llm: LLMClient = {
      name: "MockLLM",
      async complete() {
        callIndex++;
        if (callIndex === 1) {
          return JSON.stringify({ questions: ["What does RAG combine?"] });
        }
        return JSON.stringify({
          excerpts: ["RAG combines retrieval with generation"],
        });
      },
    };

    const generator = new TokenLevelSyntheticDatasetGenerator({
      llmClient: llm,
      corpus,
    });

    const results = await generator.generate({
      queriesPerDoc: 1,
      uploadToLangsmith: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0].relevantSpans).toHaveLength(1);
    expect(results[0].relevantSpans[0].start).toBe(0);
    expect(results[0].relevantSpans[0].text).toBe("RAG combines retrieval with generation");
  });

  it("should skip excerpts not found in document", async () => {
    let callIndex = 0;
    const llm: LLMClient = {
      name: "MockLLM",
      async complete() {
        callIndex++;
        if (callIndex === 1) {
          return JSON.stringify({ questions: ["test?"] });
        }
        return JSON.stringify({
          excerpts: ["This text does not exist in the document at all"],
        });
      },
    };

    const generator = new TokenLevelSyntheticDatasetGenerator({
      llmClient: llm,
      corpus,
    });

    const results = await generator.generate({
      queriesPerDoc: 1,
      uploadToLangsmith: false,
    });

    // No valid spans found, so entry is skipped
    expect(results).toHaveLength(0);
  });
});
