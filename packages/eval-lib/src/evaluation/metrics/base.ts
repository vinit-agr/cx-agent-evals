import type { CharacterSpan, SpanRange } from "../../types/chunks.js";

export interface Metric {
  readonly name: string;
  readonly calculate: (
    retrieved: readonly CharacterSpan[],
    groundTruth: readonly CharacterSpan[],
  ) => number;
  /**
   * Optional optimized variant that accepts pre-merged spans to avoid redundant merging.
   * When provided, `computeMetrics` will call this instead of `calculate`.
   */
  readonly calculatePreMerged?: (
    mergedRetrieved: readonly SpanRange[],
    mergedGroundTruth: readonly SpanRange[],
  ) => number;
}
