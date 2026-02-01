import type { ChunkLevelGroundTruth, TokenLevelGroundTruth } from "../types/index.js";
import { QueryId, QueryText, ChunkId, DocumentId } from "../types/primitives.js";
import { getLangSmithClient } from "./get-client.js";

export async function loadChunkLevelDataset(
  datasetName: string,
): Promise<ChunkLevelGroundTruth[]> {
  const client = await getLangSmithClient();
  const examples: any[] = [];
  for await (const example of client.listExamples({ datasetName })) {
    examples.push(example);
  }

  return examples.map((example: any, i: number) => ({
    query: {
      id: QueryId(`q_${i}`),
      text: QueryText(example.inputs.query ?? ""),
      metadata: {},
    },
    relevantChunkIds: (example.outputs.relevantChunkIds ?? []).map(ChunkId),
  }));
}

export async function loadTokenLevelDataset(
  datasetName: string,
): Promise<TokenLevelGroundTruth[]> {
  const client = await getLangSmithClient();
  const examples: any[] = [];
  for await (const example of client.listExamples({ datasetName })) {
    examples.push(example);
  }

  return examples.map((example: any, i: number) => ({
    query: {
      id: QueryId(`q_${i}`),
      text: QueryText(example.inputs.query ?? ""),
      metadata: {},
    },
    relevantSpans: (example.outputs.relevantSpans ?? []).map((s: any) => ({
      docId: DocumentId(s.docId),
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  }));
}
