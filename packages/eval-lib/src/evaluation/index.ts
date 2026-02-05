export type { Metric } from "./metrics/base.js";
export { recall, precision, iou, f1 } from "./metrics/index.js";
export { mergeOverlappingSpans, calculateOverlap, totalSpanLength } from "./metrics/utils.js";
export { computeMetrics } from "./evaluator.js";
export type { ComputeMetricsOptions } from "./evaluator.js";
