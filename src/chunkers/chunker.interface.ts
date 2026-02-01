import type { Document, PositionAwareChunk } from "../types/index.js";

export interface Chunker {
  readonly name: string;
  chunk(text: string): string[];
}

export interface PositionAwareChunker {
  readonly name: string;
  chunkWithPositions(doc: Document): PositionAwareChunk[];
}

export function isPositionAwareChunker(
  chunker: Chunker | PositionAwareChunker,
): chunker is PositionAwareChunker {
  return "chunkWithPositions" in chunker;
}
