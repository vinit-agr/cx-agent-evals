import type { Brand } from "./brand.js";

export type DocumentId = Brand<"DocumentId", string>;
export type QueryId = Brand<"QueryId", string>;
export type QueryText = Brand<"QueryText", string>;
export type ChunkId = Brand<"ChunkId", string>;
export type PositionAwareChunkId = Brand<"PositionAwareChunkId", string>;
export type EvaluationType = "chunk-level" | "token-level";

// Factory functions for creating branded values
export const DocumentId = (value: string): DocumentId => value as DocumentId;
export const QueryId = (value: string): QueryId => value as QueryId;
export const QueryText = (value: string): QueryText => value as QueryText;
export const ChunkId = (value: string): ChunkId => value as ChunkId;
export const PositionAwareChunkId = (value: string): PositionAwareChunkId =>
  value as PositionAwareChunkId;
