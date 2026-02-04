import { describe, it, expect, vi } from "vitest";
import { QueryId, QueryText, DocumentId } from "../../../src/types/primitives.js";
import type { GroundTruth } from "../../../src/types/index.js";

// Mock the getLangSmithClient module
vi.mock("../../../src/langsmith/get-client.js", () => ({
  getLangSmithClient: vi.fn(),
}));

import { getLangSmithClient } from "../../../src/langsmith/get-client.js";
import { uploadDataset } from "../../../src/langsmith/upload.js";
import { loadDataset } from "../../../src/langsmith/client.js";

function createMockClient() {
  const store: Map<string, any[]> = new Map();
  return {
    createDataset: vi.fn(async (name: string) => {
      store.set(name, []);
      return { id: `dataset_${name}`, name };
    }),
    createExample: vi.fn(async (inputs: any, outputs: any, opts: any) => {
      const datasetName = [...store.keys()].find((k) => `dataset_${k}` === opts.datasetId);
      if (datasetName) {
        store.get(datasetName)!.push({ inputs, outputs, metadata: opts.metadata });
      }
    }),
    listExamples: vi.fn(function* ({ datasetName }: { datasetName: string }) {
      const examples = store.get(datasetName) ?? [];
      for (const ex of examples) {
        yield ex;
      }
    }),
    _store: store,
  };
}

describe("LangSmith upload/load round-trip", () => {
  it("should round-trip dataset", async () => {
    const mockClient = createMockClient();
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    const groundTruth: GroundTruth[] = [
      {
        query: { id: QueryId("q_0"), text: QueryText("test?"), metadata: {} },
        relevantSpans: [
          { docId: DocumentId("doc.md"), start: 0, end: 50, text: "x".repeat(50) },
        ],
      },
    ];

    await uploadDataset(groundTruth, "test-dataset");

    const loaded = await loadDataset("test-dataset");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].relevantSpans).toHaveLength(1);
    expect(loaded[0].relevantSpans[0].start).toBe(0);
    expect(loaded[0].relevantSpans[0].end).toBe(50);
    expect(loaded[0].relevantSpans[0].text).toBe("x".repeat(50));
  });

  it("should use default dataset name", async () => {
    const mockClient = createMockClient();
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    await uploadDataset([], undefined);
    expect(mockClient.createDataset).toHaveBeenCalledWith("rag-eval-dataset", expect.any(Object));
  });
});
