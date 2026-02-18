import { PositionAwareChunkId } from "../types/primitives.js";

/**
 * Simple FNV-1a hash for deterministic chunk ID generation.
 * No Node.js crypto dependency — works in any JS runtime.
 */
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) | 0; // FNV prime, force 32-bit int
  }
  // Convert to unsigned and then to hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function generatePaChunkId(content: string): PositionAwareChunkId {
  // Use two different offsets of content to reduce collision probability
  const h1 = fnv1aHash(content);
  const h2 = fnv1aHash(content.length + ":" + content.substring(0, 100));
  return PositionAwareChunkId(`pa_chunk_${h1}${h2.substring(0, 4)}`);
}
