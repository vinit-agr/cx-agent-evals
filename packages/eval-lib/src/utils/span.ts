import type { SpanRange } from "../types/chunks.js";

export function spanOverlaps(a: SpanRange, b: SpanRange): boolean {
  if (a.docId !== b.docId) return false;
  return a.start < b.end && b.start < a.end;
}

export function spanOverlapChars(a: SpanRange, b: SpanRange): number {
  if (!spanOverlaps(a, b)) return 0;
  return Math.min(a.end, b.end) - Math.max(a.start, b.start);
}

export function spanLength(span: SpanRange): number {
  return span.end - span.start;
}
