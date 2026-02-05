import type { Corpus } from "../types/index.js";
import type { Retriever } from "../experiments/retriever.interface.js";
import type { Metric } from "../evaluation/metrics/base.js";
import { recall, precision, iou, f1 } from "../evaluation/metrics/index.js";
import { positionAwareChunkToSpan } from "../types/chunks.js";
import { createLangSmithEvaluators } from "./evaluator-adapters.js";

export interface LangSmithExperimentConfig {
  readonly corpus: Corpus;
  readonly retriever: Retriever;
  readonly k: number;
  readonly datasetName: string;
  readonly metrics?: readonly Metric[];
  readonly experimentPrefix?: string;
  readonly metadata?: Record<string, unknown>;
}

const DEFAULT_METRICS: readonly Metric[] = [recall, precision, iou, f1];

export async function runLangSmithExperiment(config: LangSmithExperimentConfig): Promise<void> {
  const {
    corpus,
    retriever,
    k,
    datasetName,
    experimentPrefix,
    metadata,
  } = config;
  const metrics = config.metrics ?? DEFAULT_METRICS;

  await retriever.init(corpus);

  try {
    const target = async (inputs: { query: string }) => {
      const chunks = await retriever.retrieve(inputs.query, k);
      return {
        retrievedSpans: chunks.map((chunk) => {
          const span = positionAwareChunkToSpan(chunk);
          return {
            docId: String(span.docId),
            start: span.start,
            end: span.end,
            text: span.text,
          };
        }),
      };
    };

    const evaluators = createLangSmithEvaluators(metrics);

    const { evaluate } = await import("langsmith/evaluation");

    await evaluate(target, {
      data: datasetName,
      evaluators,
      experimentPrefix: experimentPrefix ?? retriever.name,
      metadata: {
        retriever: retriever.name,
        k,
        corpusSize: corpus.documents.length,
        ...metadata,
      },
    });
  } finally {
    await retriever.cleanup();
  }
}
