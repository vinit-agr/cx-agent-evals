import type { CharacterSpan } from "../../../types/chunks.js";
import type { TokenLevelMetric } from "../base.js";
import { calculateOverlap, totalSpanLength } from "./utils.js";

export const spanRecall: TokenLevelMetric = {
  name: "span_recall" as const,
  calculate(retrieved: readonly CharacterSpan[], groundTruth: readonly CharacterSpan[]): number {
    if (groundTruth.length === 0) return 1.0;
    const totalGtChars = totalSpanLength(groundTruth);
    if (totalGtChars === 0) return 1.0;
    const overlap = calculateOverlap(retrieved, groundTruth);
    return Math.min(overlap / totalGtChars, 1.0);
  },
};
