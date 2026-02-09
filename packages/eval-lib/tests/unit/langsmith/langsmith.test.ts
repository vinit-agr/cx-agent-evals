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
import { listDatasets, listExperiments, getCompareUrl } from "../../../src/langsmith/datasets.js";

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

  it("should pass metadata to createDataset", async () => {
    const mockClient = createMockClient();
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    await uploadDataset([], {
      datasetName: "metadata-test",
      metadata: { folderPath: "/data/corpus", strategy: "simple" },
    });

    expect(mockClient.createDataset).toHaveBeenCalledWith("metadata-test", {
      description: expect.any(String),
      metadata: { folderPath: "/data/corpus", strategy: "simple" },
    });
  });
});

describe("LangSmith dataset listing", () => {
  it("should list datasets ordered by creation date", async () => {
    const mockClient = {
      ...createMockClient(),
      listDatasets: vi.fn(async function* () {
        yield {
          id: "ds_1",
          name: "older-dataset",
          created_at: "2024-01-01T00:00:00Z",
          example_count: 10,
          metadata: { folderPath: "/old" },
        };
        yield {
          id: "ds_2",
          name: "newer-dataset",
          created_at: "2024-02-01T00:00:00Z",
          example_count: 20,
          metadata: { folderPath: "/new" },
        };
      }),
    };
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    const datasets = await listDatasets();

    expect(datasets).toHaveLength(2);
    expect(datasets[0].name).toBe("newer-dataset"); // Most recent first
    expect(datasets[1].name).toBe("older-dataset");
    expect(datasets[0].metadata?.folderPath).toBe("/new");
  });

  it("should list experiments for a dataset", async () => {
    const mockClient = {
      ...createMockClient(),
      listProjects: vi.fn(async function* () {
        yield {
          id: "proj_1",
          name: "experiment-1",
          start_time: "2024-01-01T00:00:00Z",
          tenant_id: "tenant_123",
          feedback_stats: {
            recall: { avg: 0.85 },
            precision: { avg: 0.75 },
          },
        };
        yield {
          id: "proj_2",
          name: "experiment-2",
          start_time: "2024-02-01T00:00:00Z",
          tenant_id: "tenant_123",
          feedback_stats: {},
        };
      }),
    };
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    const experiments = await listExperiments("ds_test");

    expect(experiments).toHaveLength(2);
    expect(experiments[0].name).toBe("experiment-2"); // Most recent first
    expect(experiments[1].name).toBe("experiment-1");
    expect(experiments[1].scores).toEqual({ recall: 0.85, precision: 0.75 });
    expect(experiments[0].scores).toBeUndefined(); // No scores
    expect(experiments[0].url).toContain("tenant_123");
    expect(mockClient.listProjects).toHaveBeenCalledWith({ referenceDatasetId: "ds_test" });
  });

  it("should generate compare URL", async () => {
    const mockClient = {
      ...createMockClient(),
      listProjects: vi.fn(async function* () {
        yield { id: "proj_1", tenant_id: "tenant_abc", name: "test", start_time: "2024-01-01" };
      }),
    };
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    const url = await getCompareUrl("ds_compare");

    expect(url).toBe("https://smith.langchain.com/o/tenant_abc/datasets/ds_compare/compare");
  });

  it("should fallback to dataset URL if no projects", async () => {
    const mockClient = {
      ...createMockClient(),
      listProjects: vi.fn(async function* () {
        // No projects
      }),
    };
    vi.mocked(getLangSmithClient).mockResolvedValue(mockClient);

    const url = await getCompareUrl("ds_empty");

    expect(url).toBe("https://smith.langchain.com/datasets/ds_empty");
  });
});
