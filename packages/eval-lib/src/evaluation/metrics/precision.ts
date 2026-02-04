import type { CharacterSpan } from "../../types/chunks.js";
import type { Metric } from "./base.js";
import { calculateOverlap, totalSpanLength } from "./utils.js";

export const precision: Metric = {
  name: "precision" as const,
  calculate(retrieved: readonly CharacterSpan[], groundTruth: readonly CharacterSpan[]): number {
    if (retrieved.length === 0) return 0.0;
    const totalRetChars = totalSpanLength(retrieved);
    if (totalRetChars === 0) return 0.0;
    const overlap = calculateOverlap(retrieved, groundTruth);
    return Math.min(overlap / totalRetChars, 1.0);
  },
};
