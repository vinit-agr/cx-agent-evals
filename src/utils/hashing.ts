import { createHash } from "node:crypto";
import { ChunkId, PositionAwareChunkId } from "../types/primitives.js";

export function generateChunkId(content: string): ChunkId {
  const hash = createHash("sha256").update(content, "utf-8").digest("hex").substring(0, 12);
  return ChunkId(`chunk_${hash}`);
}

export function generatePaChunkId(content: string): PositionAwareChunkId {
  const hash = createHash("sha256").update(content, "utf-8").digest("hex").substring(0, 12);
  return PositionAwareChunkId(`pa_chunk_${hash}`);
}
