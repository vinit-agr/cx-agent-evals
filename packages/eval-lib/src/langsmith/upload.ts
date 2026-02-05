import type { GroundTruth } from "../types/index.js";
import { getLangSmithClient } from "./get-client.js";

export interface UploadProgress {
  uploaded: number;
  total: number;
  failed: number;
}

export interface UploadOptions {
  datasetName?: string;
  description?: string;
  batchSize?: number;
  maxRetries?: number;
  onProgress?: (progress: UploadProgress) => void;
}

export interface UploadResult {
  datasetName: string;
  datasetUrl: string;
  uploaded: number;
  failed: number;
}

export async function uploadDataset(
  groundTruth: readonly GroundTruth[],
  options?: UploadOptions,
): Promise<UploadResult> {
  const client = await getLangSmithClient();
  const name = options?.datasetName ?? "rag-eval-dataset";
  const batchSize = options?.batchSize ?? 20;
  const maxRetries = options?.maxRetries ?? 3;
  const onProgress = options?.onProgress;

  const dataset = await client.createDataset(name, {
    description:
      options?.description ?? "RAG evaluation ground truth (character spans)",
  });

  const datasetUrl = `${client.getHostUrl()}/datasets/${dataset.id}`;

  // Build all examples upfront
  const examples = groundTruth.map((gt) => ({
    inputs: { query: String(gt.query.text) },
    outputs: {
      relevantSpans: gt.relevantSpans.map((span) => ({
        docId: String(span.docId),
        start: span.start,
        end: span.end,
        text: span.text,
      })),
    },
    metadata: gt.query.metadata as Record<string, unknown>,
    dataset_id: dataset.id,
  }));

  let uploaded = 0;
  let failed = 0;
  const total = examples.length;

  // Upload in batches
  for (let i = 0; i < total; i += batchSize) {
    const batch = examples.slice(i, i + batchSize);
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries) {
      try {
        await client.createExamples(batch);
        uploaded += batch.length;
        success = true;
        break;
      } catch {
        attempt++;
        if (attempt >= maxRetries) {
          failed += batch.length;
        }
      }
    }

    if (success || attempt >= maxRetries) {
      onProgress?.({ uploaded, total, failed });
    }
  }

  return { datasetName: name, datasetUrl, uploaded, failed };
}
