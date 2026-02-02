import { describe, it, expect } from "vitest";
import { SimpleStrategy } from "../../../../src/synthetic-datagen/strategies/simple/generator.js";
import type { LLMClient } from "../../../../src/synthetic-datagen/base.js";
import { createDocument, createCorpus } from "../../../../src/types/documents.js";

const doc = createDocument({
  id: "test.md",
  content: "RAG combines retrieval with generation.",
});
const corpus = createCorpus([doc]);

describe("SimpleStrategy", () => {
  it("should generate queries for each document", async () => {
    const llm: LLMClient = {
      name: "MockLLM",
      async complete() {
        return JSON.stringify({
          questions: ["What does RAG combine?", "How does RAG work?"],
        });
      },
    };

    const strategy = new SimpleStrategy({ queriesPerDoc: 2 });
    const results = await strategy.generate({
      corpus,
      llmClient: llm,
      model: "gpt-4o",
    });

    expect(results).toHaveLength(2);
    expect(results[0].query).toBe("What does RAG combine?");
    expect(results[0].targetDocId).toBe("test.md");
    expect(results[0].metadata.strategy).toBe("simple");
  });

  it("should handle multiple documents", async () => {
    const doc2 = createDocument({ id: "doc2.md", content: "Embeddings map text to vectors." });
    const multiCorpus = createCorpus([doc, doc2]);

    const llm: LLMClient = {
      name: "MockLLM",
      async complete() {
        return JSON.stringify({ questions: ["Q1"] });
      },
    };

    const strategy = new SimpleStrategy({ queriesPerDoc: 1 });
    const results = await strategy.generate({
      corpus: multiCorpus,
      llmClient: llm,
      model: "gpt-4o",
    });

    expect(results).toHaveLength(2);
    expect(results[0].targetDocId).toBe("test.md");
    expect(results[1].targetDocId).toBe("doc2.md");
  });
});
