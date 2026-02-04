export { Evaluation } from "./evaluation.js";
export type { EvaluationConfig, RunOptions } from "./evaluation.js";
export type { Metric } from "./metrics/base.js";
export { recall, precision, iou, f1 } from "./metrics/index.js";
export { mergeOverlappingSpans, calculateOverlap, totalSpanLength } from "./metrics/utils.js";
export { evaluate } from "./evaluator.js";
export type { EvaluateOptions } from "./evaluator.js";
