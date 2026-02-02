import type { Document, PositionAwareChunk } from "../types/index.js";
import { generatePaChunkId } from "../utils/hashing.js";
import type { Chunker, PositionAwareChunker } from "./chunker.interface.js";

export class ChunkerPositionAdapter implements PositionAwareChunker {
  readonly name: string;
  private _chunker: Chunker;
  private _skippedChunks = 0;

  constructor(chunker: Chunker) {
    this._chunker = chunker;
    this.name = `PositionAdapter(${chunker.name})`;
  }

  get skippedChunks(): number {
    return this._skippedChunks;
  }

  chunkWithPositions(doc: Document): PositionAwareChunk[] {
    const chunks = this._chunker.chunk(doc.content);
    const result: PositionAwareChunk[] = [];
    const assignedRanges: Array<{ start: number; end: number }> = [];
    let currentPos = 0;

    for (const chunkText of chunks) {
      let start = doc.content.indexOf(chunkText, currentPos);

      if (start === -1) {
        // Fallback: search from beginning
        start = doc.content.indexOf(chunkText);

        // Verify no overlap with already-assigned spans
        if (start !== -1) {
          const end = start + chunkText.length;
          const overlaps = assignedRanges.some(
            (r) => start < r.end && end > r.start,
          );
          if (overlaps) {
            start = -1; // reject this match
          }
        }
      }

      if (start === -1) {
        console.warn(
          `Could not locate chunk in source document '${doc.id}'. ` +
            `Chunk preview: ${chunkText.substring(0, 50)}...`,
        );
        this._skippedChunks++;
        continue;
      }

      const end = start + chunkText.length;
      assignedRanges.push({ start, end });

      result.push({
        id: generatePaChunkId(chunkText),
        content: chunkText,
        docId: doc.id,
        start,
        end,
        metadata: {},
      });
      currentPos = end;
    }

    return result;
  }
}
