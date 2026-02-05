import type { Metric } from "../evaluation/metrics/base.js";
import type { CharacterSpan } from "../types/chunks.js";
import { DocumentId } from "../types/primitives.js";

interface SerializedSpan {
  docId: string;
  start: number;
  end: number;
  text: string;
}

function deserializeSpans(raw: unknown): CharacterSpan[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: SerializedSpan) => ({
    docId: DocumentId(s.docId),
    start: s.start,
    end: s.end,
    text: s.text,
  }));
}

export function createLangSmithEvaluator(metric: Metric) {
  return (args: {
    outputs?: Record<string, unknown>;
    referenceOutputs?: Record<string, unknown>;
  }) => {
    const retrieved = deserializeSpans(args.outputs?.retrievedSpans);
    const groundTruth = deserializeSpans(args.referenceOutputs?.relevantSpans);
    const score = metric.calculate(retrieved, groundTruth);
    return { key: metric.name, score };
  };
}

export function createLangSmithEvaluators(metrics: readonly Metric[]) {
  return metrics.map(createLangSmithEvaluator);
}
