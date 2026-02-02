import { z } from "zod";
import type { ChunkId } from "./primitives.js";
import type { Query } from "./queries.js";
import type { CharacterSpan } from "./chunks.js";

export interface ChunkLevelGroundTruth {
  readonly query: Query;
  readonly relevantChunkIds: readonly ChunkId[];
}

export interface TokenLevelGroundTruth {
  readonly query: Query;
  readonly relevantSpans: readonly CharacterSpan[];
}

export const ChunkLevelDatasetExampleSchema = z.object({
  inputs: z.object({ query: z.string() }),
  outputs: z.object({ relevantChunkIds: z.array(z.string()) }),
  metadata: z.record(z.unknown()).default({}),
});

export const TokenLevelDatasetExampleSchema = z.object({
  inputs: z.object({ query: z.string() }),
  outputs: z.object({
    relevantSpans: z.array(
      z.object({
        docId: z.string(),
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
        text: z.string(),
      }),
    ),
  }),
  metadata: z.record(z.unknown()).default({}),
});

export interface ChunkLevelDatasetExample {
  readonly inputs: { readonly query: string };
  readonly outputs: { readonly relevantChunkIds: readonly string[] };
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface TokenLevelDatasetExample {
  readonly inputs: { readonly query: string };
  readonly outputs: {
    readonly relevantSpans: ReadonlyArray<{
      readonly docId: string;
      readonly start: number;
      readonly end: number;
      readonly text: string;
    }>;
  };
  readonly metadata: Readonly<Record<string, unknown>>;
}
