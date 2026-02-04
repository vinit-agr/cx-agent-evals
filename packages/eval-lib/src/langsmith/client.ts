import type { GroundTruth } from "../types/index.js";
import { QueryId, QueryText, DocumentId } from "../types/primitives.js";
import { getLangSmithClient } from "./get-client.js";

export async function loadDataset(datasetName: string): Promise<GroundTruth[]> {
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
