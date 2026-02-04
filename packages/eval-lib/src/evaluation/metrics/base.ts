import type { CharacterSpan } from "../../types/chunks.js";

export interface Metric {
  readonly name: string;
  readonly calculate: (
    retrieved: readonly CharacterSpan[],
    groundTruth: readonly CharacterSpan[],
  ) => number;
}
