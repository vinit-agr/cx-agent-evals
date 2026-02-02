import type { CharacterSpan } from "../../../types/chunks.js";
import type { TokenLevelMetric } from "../base.js";
import { calculateOverlap, totalSpanLength } from "./utils.js";

export const spanIoU: TokenLevelMetric = {
  name: "span_iou" as const,
  calculate(retrieved: readonly CharacterSpan[], groundTruth: readonly CharacterSpan[]): number {
    if (retrieved.length === 0 && groundTruth.length === 0) return 1.0;
    if (retrieved.length === 0 || groundTruth.length === 0) return 0.0;

    const intersection = calculateOverlap(retrieved, groundTruth);
    const totalRet = totalSpanLength(retrieved);
    const totalGt = totalSpanLength(groundTruth);
    const union = totalRet + totalGt - intersection;

    return union > 0 ? intersection / union : 0.0;
  },
};
