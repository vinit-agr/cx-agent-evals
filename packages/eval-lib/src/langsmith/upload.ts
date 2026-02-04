import type { GroundTruth } from "../types/index.js";
import { getLangSmithClient } from "./get-client.js";

export async function uploadDataset(
  groundTruth: readonly GroundTruth[],
  datasetName?: string,
): Promise<string> {
  const client = await getLangSmithClient();
  const name = datasetName ?? "rag-eval-dataset";

  const dataset = await client.createDataset(name, {
    description: "RAG evaluation ground truth (character spans)",
  });

  for (const gt of groundTruth) {
    await client.createExample(
      { query: String(gt.query.text) },
      {
        relevantSpans: gt.relevantSpans.map((span) => ({
          docId: String(span.docId),
          start: span.start,
          end: span.end,
          text: span.text,
        })),
      },
      { datasetId: dataset.id, metadata: gt.query.metadata },
    );
  }

  return name;
}
