import { describe, it, expect } from "vitest";
import { pdfToMarkdown } from "../../../src/file-processing/pdf-to-markdown.js";

describe("pdfToMarkdown", () => {
  it("should return empty content for empty buffer", async () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = await pdfToMarkdown(emptyBuffer);

    expect(result.content).toBe("");
    expect(result.metadata.wordCount).toBe(0);
    expect(result.metadata.sourceFormat).toBe("pdf");
  });

  it("should return empty content for invalid PDF buffer", async () => {
    const invalidBuffer = Buffer.from("not a pdf");
    const result = await pdfToMarkdown(invalidBuffer);

    expect(result.content).toBe("");
    expect(result.metadata.wordCount).toBe(0);
  });

  it("should have correct return type structure", async () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = await pdfToMarkdown(emptyBuffer);

    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("sourceFormat");
    expect(result.metadata).toHaveProperty("wordCount");
    expect(typeof result.content).toBe("string");
    expect(typeof result.title).toBe("string");
  });
});
