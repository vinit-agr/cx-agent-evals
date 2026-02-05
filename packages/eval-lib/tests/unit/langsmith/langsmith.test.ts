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
    getHostUrl: vi.fn(() => "https://smith.langchain.com"),
    createDataset: vi.fn(async (name: string) => {
      store.set(name, []);
      return { id: `dataset_${name}`, name };
    }),
    createExamples: vi.fn(async (examples: any[]) => {
      for (const ex of examples) {
        const datasetName = [...store.keys()].find((k) => `dataset_${k}` === ex.dataset_id);
        if (datasetName) {
          store.get(datasetName)!.push({
            inputs: ex.inputs,
            outputs: ex.outputs,
            metadata: ex.metadata,
          });
        }
      }
      return examples;
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

    const result = await uploadDataset(groundTruth, { datasetName: "test-dataset" });
    expect(result.datasetName).toBe("test-dataset");
    expect(result.datasetUrl).toBe("https://smith.langchain.com/datasets/dataset_test-dataset");
    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(0);

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

    const result = await uploadDataset([]);
    expect(result.datasetName).toBe("rag-eval-dataset");
    expect(mockClient.createDataset).toHaveBeenCalledWith("rag-eval-dataset", expect.any(Object));
  });

  it("should report progress via callback", async () => {
    const mockClient = createMockClient();
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    const groundTruth: GroundTruth[] = Array.from({ length: 25 }, (_, i) => ({
      query: { id: QueryId(`q_${i}`), text: QueryText(`question ${i}?`), metadata: {} },
      relevantSpans: [
        { docId: DocumentId("doc.md"), start: 0, end: 10, text: "0123456789" },
      ],
    }));

    const progressCalls: { uploaded: number; total: number; failed: number }[] = [];
    const result = await uploadDataset(groundTruth, {
      datasetName: "progress-test",
      batchSize: 20,
      onProgress: (p) => progressCalls.push({ ...p }),
    });

    expect(result.uploaded).toBe(25);
    expect(result.failed).toBe(0);
    expect(progressCalls).toHaveLength(2); // batch of 20 + batch of 5
    expect(progressCalls[0].uploaded).toBe(20);
    expect(progressCalls[1].uploaded).toBe(25);
  });

  it("should retry failed batches and count failures", async () => {
    const mockClient = createMockClient();
    let callCount = 0;
    mockClient.createExamples = vi.fn(async () => {
      callCount++;
      // First batch: always fail
      if (callCount <= 3) throw new Error("API error");
      // Second batch onwards: succeed
      return [];
    });
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    const groundTruth: GroundTruth[] = Array.from({ length: 25 }, (_, i) => ({
      query: { id: QueryId(`q_${i}`), text: QueryText(`question ${i}?`), metadata: {} },
      relevantSpans: [],
    }));

    const result = await uploadDataset(groundTruth, {
      datasetName: "retry-test",
      batchSize: 20,
      maxRetries: 3,
    });

    // First batch (20) fails after 3 retries, second batch (5) succeeds
    expect(result.failed).toBe(20);
    expect(result.uploaded).toBe(5);
    expect(mockClient.createExamples).toHaveBeenCalledTimes(4); // 3 retries + 1 success
  });
});
