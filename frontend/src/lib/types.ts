export type EvalMode = "chunk" | "token";

export interface DocumentInfo {
  id: string;
  content: string;
  contentLength: number;
}

export interface ChunkInfo {
  id: string;
  content: string;
}

export interface SpanInfo {
  docId: string;
  start: number;
  end: number;
  text: string;
}

export interface GeneratedQuestion {
  docId: string;
  query: string;
  relevantChunkIds?: string[];
  chunks?: ChunkInfo[];
  relevantSpans?: SpanInfo[];
}

export type StrategyType = "simple" | "dimension-driven" | "real-world-grounded";

export interface Dimension {
  name: string;
  description: string;
  values: string[];
}

export interface GenerateConfig {
  folderPath: string;
  mode: EvalMode;
  strategy: StrategyType;
  questionsPerDoc: number;
  chunkSize?: number;
  chunkOverlap?: number;
  dimensions?: Dimension[];
  totalQuestions?: number;
}

export type SSEEvent =
  | { type: "question"; data: GeneratedQuestion }
  | { type: "done"; totalQuestions: number }
  | { type: "error"; error: string };
