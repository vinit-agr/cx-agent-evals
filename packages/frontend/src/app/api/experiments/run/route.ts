import { NextRequest } from "next/server";

interface RetrieverConfig {
  chunker: {
    type: "recursive";
    chunkSize: number;
    chunkOverlap: number;
  };
  embedder: {
    type: "openai";
    model: string;
  };
  vectorStore: {
    type: "in-memory";
  };
  reranker?: {
    type: "cohere";
    model?: string;
  };
}

interface RunExperimentRequest {
  datasetId: string;
  datasetName: string;
  corpusPath: string;
  k: number;
  metrics: string[];
  experimentName: string;
  retrieverConfig: RetrieverConfig;
}

export async function POST(request: NextRequest) {
  // Check required environment variables
  if (!process.env.LANGSMITH_API_KEY) {
    return new Response(
      JSON.stringify({ error: "LANGSMITH_API_KEY is required" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is required for embeddings" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: RunExperimentRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const {
    datasetName,
    corpusPath,
    k,
    metrics: metricNames,
    experimentName,
    retrieverConfig,
  } = body;

  // Validate required fields
  if (!datasetName || !corpusPath || !k || !experimentName) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check for cohere API key if reranker is configured
  if (retrieverConfig.reranker?.type === "cohere" && !process.env.COHERE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "COHERE_API_KEY is required for Cohere reranker" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // All imports are dynamic to avoid bundling issues with Next.js
        // Import the main module for core types and utilities
        const evalLib = await import("rag-evaluation-system");

        // Phase: Loading corpus
        send({ type: "phase", phase: "loading", message: "Loading corpus..." });
        const corpus = await evalLib.corpusFromFolder(corpusPath, "**/*.md");
        send({
          type: "phase",
          phase: "loaded",
          message: `Loaded ${corpus.documents.length} documents`,
        });

        // Phase: Creating components
        send({ type: "phase", phase: "initializing", message: "Creating embedder..." });

        // Dynamic import for OpenAI embedder
        const openaiMod = await import("rag-evaluation-system/embedders/openai");
        const embedder = await openaiMod.OpenAIEmbedder.create({
          model: retrieverConfig.embedder.model,
        });

        const chunker = new evalLib.RecursiveCharacterChunker({
          chunkSize: retrieverConfig.chunker.chunkSize,
          chunkOverlap: retrieverConfig.chunker.chunkOverlap,
        });

        const vectorStore = new evalLib.InMemoryVectorStore();

        let reranker: Awaited<ReturnType<typeof import("rag-evaluation-system/rerankers/cohere").CohereReranker.create>> | undefined;
        if (retrieverConfig.reranker?.type === "cohere") {
          send({ type: "phase", phase: "initializing", message: "Creating reranker..." });
          // Dynamic import for Cohere reranker
          const cohereMod = await import("rag-evaluation-system/rerankers/cohere");
          reranker = await cohereMod.CohereReranker.create({
            model: retrieverConfig.reranker.model,
          });
        }

        // Create retriever
        const retriever = new evalLib.VectorRAGRetriever({
          chunker,
          embedder,
          vectorStore,
          reranker,
        });

        // Select metrics
        const METRIC_MAP: Record<string, typeof evalLib.recall> = {
          recall: evalLib.recall,
          precision: evalLib.precision,
          iou: evalLib.iou,
          f1: evalLib.f1,
        };

        const selectedMetrics = metricNames
          .map((name) => METRIC_MAP[name])
          .filter((m) => m !== undefined);

        if (selectedMetrics.length === 0) {
          selectedMetrics.push(evalLib.recall, evalLib.precision, evalLib.iou, evalLib.f1);
        }

        // Phase: Running experiment
        send({
          type: "phase",
          phase: "running",
          message: "Running experiment (this may take a while)...",
        });

        // Dynamic import for experiment runner
        const experimentRunnerMod = await import("rag-evaluation-system/langsmith/experiment-runner");

        await experimentRunnerMod.runLangSmithExperiment({
          corpus,
          retriever,
          k,
          datasetName,
          metrics: selectedMetrics,
          experimentPrefix: experimentName,
        });

        // Phase: Complete
        send({
          type: "complete",
          experimentName,
          message: "Experiment completed successfully",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Experiment failed";
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
