import type { ChunkLevelGroundTruth, TokenLevelGroundTruth } from "../types/index.js";
import { getLangSmithClient } from "./get-client.js";

export async function uploadChunkLevelDataset(
  groundTruth: readonly ChunkLevelGroundTruth[],
  datasetName?: string,
): Promise<string> {
  const client = await getLangSmithClient();
  const name = datasetName ?? "rag-eval-chunk-level";

  const dataset = await client.createDataset(name, {
    description: "Chunk-level RAG evaluation ground truth",
  });

  for (const gt of groundTruth) {
    await client.createExample(
      { query: String(gt.query.text) },
      { relevantChunkIds: gt.relevantChunkIds.map(String) },
      { datasetId: dataset.id, metadata: gt.query.metadata },
    );
  }

  return name;
}

export async function uploadTokenLevelDataset(
  groundTruth: readonly TokenLevelGroundTruth[],
  datasetName?: string,
): Promise<string> {
  const client = await getLangSmithClient();
  const name = datasetName ?? "rag-eval-token-level";

  const dataset = await client.createDataset(name, {
    description: "Token-level RAG evaluation ground truth (character spans)",
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
