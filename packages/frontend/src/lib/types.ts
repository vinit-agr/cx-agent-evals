export interface DocumentInfo {
  id: string;
  content: string;
  contentLength: number;
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
  strategy: StrategyType;
  questionsPerDoc: number;
  dimensions?: Dimension[];
  totalQuestions?: number;
}

export type SSEEvent =
  | { type: "question"; data: GeneratedQuestion }
  | { type: "done"; totalQuestions: number }
  | { type: "error"; error: string };
