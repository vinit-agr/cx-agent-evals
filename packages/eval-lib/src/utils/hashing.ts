import { createHash } from "node:crypto";
import { PositionAwareChunkId } from "../types/primitives.js";

export function generatePaChunkId(content: string): PositionAwareChunkId {
  const hash = createHash("sha256").update(content, "utf-8").digest("hex").substring(0, 12);
  return PositionAwareChunkId(`pa_chunk_${hash}`);
}
