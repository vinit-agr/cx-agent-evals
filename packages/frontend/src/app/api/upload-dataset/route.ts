import { NextRequest } from "next/server";
import {
  uploadDataset,
  QueryId,
  QueryText,
  DocumentId,
} from "rag-evaluation-system";
import type { GroundTruth } from "rag-evaluation-system";

interface QuestionPayload {
  docId: string;
  query: string;
  relevantSpans?: {
    docId: string;
    start: number;
    end: number;
    text: string;
  }[];
}

interface UploadMetadata {
  strategy: string;
  folderPath: string;
  questionsPerDoc?: number;
  dimensions?: { name: string }[];
  totalQuestions?: number;
}

export async function POST(request: NextRequest) {
  if (!process.env.LANGSMITH_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "LANGSMITH_API_KEY environment variable is required. Add it to packages/frontend/.env",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: {
    questions: QuestionPayload[];
    datasetName: string;
    metadata: UploadMetadata;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { questions, datasetName, metadata } = body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return new Response(
      JSON.stringify({ error: "questions array is required and must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!datasetName) {
    return new Response(
      JSON.stringify({ error: "datasetName is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Convert frontend GeneratedQuestion[] to GroundTruth[]
  const groundTruth: GroundTruth[] = questions.map((q, i) => ({
    query: {
      id: QueryId(`q_${i}`),
      text: QueryText(q.query),
      metadata: { sourceDoc: q.docId },
    },
    relevantSpans: (q.relevantSpans ?? []).map((s) => ({
      docId: DocumentId(s.docId),
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  }));

  // Build description from metadata
  const corpusName = metadata?.folderPath?.split("/").filter(Boolean).pop() ?? "corpus";
  const descParts = [
    "RAG evaluation ground truth (character spans).",
    `Strategy: ${metadata?.strategy ?? "unknown"}`,
    `Corpus: ${metadata?.folderPath ?? "unknown"} (${questions.length} questions)`,
  ];
  if (metadata?.dimensions && metadata.dimensions.length > 0) {
    descParts.push(
      `Dimensions: ${metadata.dimensions.map((d) => d.name).join(", ")}`,
    );
  }
  descParts.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  const description = descParts.join("\n");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        const result = await uploadDataset(groundTruth, {
          datasetName,
          description,
          metadata: {
            folderPath: metadata?.folderPath,
            strategy: metadata?.strategy,
            questionsPerDoc: metadata?.questionsPerDoc,
            totalQuestions: metadata?.totalQuestions,
            dimensions: metadata?.dimensions,
          },
          onProgress: (progress) => {
            send({
              type: "progress",
              uploaded: progress.uploaded,
              total: progress.total,
              failed: progress.failed,
            });
          },
        });

        send({
          type: "done",
          datasetName: result.datasetName,
          datasetUrl: result.datasetUrl,
          uploaded: result.uploaded,
          failed: result.failed,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
