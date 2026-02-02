import { NextRequest } from "next/server";
import {
  corpusFromFolder,
  createCorpus,
  createDocument,
  RecursiveCharacterChunker,
  openAIClientAdapter,
  SimpleStrategy,
  DimensionDrivenStrategy,
  RealWorldGroundedStrategy,
  ChunkLevelGroundTruthAssigner,
  TokenLevelGroundTruthAssigner,
  generate,
  generateChunkId,
} from "rag-evaluation-system";
import type {
  ChunkLevelGroundTruth,
  TokenLevelGroundTruth,
  QuestionStrategy,
  ProgressEvent,
} from "rag-evaluation-system";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "OPENAI_API_KEY environment variable is required",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let config;
  try {
    config = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    folderPath,
    mode,
    strategy: strategyType = "simple",
    questionsPerDoc = 10,
    dimensions,
    totalQuestions = 50,
    realWorldQuestions,
    totalSyntheticQuestions = 50,
    chunkSize = 1000,
    chunkOverlap = 200,
  } = config;

  if (!folderPath || !mode) {
    return new Response(
      JSON.stringify({ error: "folderPath and mode are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (strategyType === "dimension-driven" && (!dimensions || !totalQuestions)) {
    return new Response(
      JSON.stringify({
        error:
          "dimensions and totalQuestions are required for dimension-driven strategy",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let tempDimsPath: string | null = null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const llm = openAIClientAdapter(openai as any);

        const corpus = await corpusFromFolder(folderPath, "**/*.md");
        if (corpus.documents.length === 0) {
          send({ type: "error", error: "No markdown files found" });
          controller.close();
          return;
        }

        const chunker =
          mode === "chunk"
            ? new RecursiveCharacterChunker({ chunkSize, chunkOverlap })
            : undefined;

        let questionCount = 0;

        if (strategyType === "dimension-driven") {
          // Decomposed dimension-driven flow with progress streaming
          const tempDir = join(tmpdir(), "rag-eval-dimensions");
          await mkdir(tempDir, { recursive: true });
          tempDimsPath = join(tempDir, `gen-dims-${Date.now()}.json`);
          await writeFile(tempDimsPath, JSON.stringify({ dimensions }));

          const strategy = new DimensionDrivenStrategy({
            dimensionsFilePath: tempDimsPath,
            totalQuestions,
            onProgress: (event: ProgressEvent) => {
              send({ type: "phase", ...event });
            },
          });

          // Run strategy to get queries (progress events stream during this)
          const context = { corpus, llmClient: llm, model: "gpt-4o-mini" };
          const queries = await strategy.generate(context);

          // Now assign ground truth per-query and stream results
          send({ type: "phase", phase: "ground-truth-start", totalQuestions: queries.length });

          if (mode === "chunk") {
            const assigner = new ChunkLevelGroundTruthAssigner(chunker!);
            // Build chunk index for sending chunk content to frontend
            const chunkMap = new Map<string, string>();
            for (const doc of corpus.documents) {
              const chunks = chunker!.chunk(doc.content);
              for (const text of chunks) {
                chunkMap.set(String(generateChunkId(text)), text);
              }
            }

            // Assign ground truth per query and stream each result
            for (const query of queries) {
              const results = await assigner.assign([query], context) as ChunkLevelGroundTruth[];
              for (const gt of results) {
                const chunkData = gt.relevantChunkIds.map((id) => ({
                  id: String(id),
                  content: chunkMap.get(String(id)) ?? "",
                }));
                send({
                  type: "question",
                  docId: String(gt.query.metadata.sourceDoc ?? ""),
                  query: String(gt.query.text),
                  relevantChunkIds: gt.relevantChunkIds.map(String),
                  chunks: chunkData,
                });
                questionCount++;
              }
            }
          } else {
            const assigner = new TokenLevelGroundTruthAssigner();
            for (const query of queries) {
              const results = await assigner.assign([query], context) as TokenLevelGroundTruth[];
              for (const gt of results) {
                send({
                  type: "question",
                  docId: String(gt.query.metadata.sourceDoc ?? ""),
                  query: String(gt.query.text),
                  relevantSpans: gt.relevantSpans.map((s) => ({
                    docId: String(s.docId),
                    start: s.start,
                    end: s.end,
                    text: s.text,
                  })),
                });
                questionCount++;
              }
            }
          }
        } else if (strategyType === "real-world-grounded") {
          // Real-world grounded strategy with embedder
          const { OpenAIEmbedder } = await import("rag-evaluation-system/embedders/openai");
          const embedder = await OpenAIEmbedder.create({ model: "text-embedding-3-small" });

          const strategy = new RealWorldGroundedStrategy({
            questions: realWorldQuestions ?? [],
            totalSyntheticQuestions: totalSyntheticQuestions ?? 50,
            onProgress: (event: ProgressEvent) => {
              send({ type: "phase", ...event });
            },
          });

          const context = { corpus, llmClient: llm, model: "gpt-4o-mini", embedder };
          const queries = await strategy.generate(context);

          send({ type: "phase", phase: "ground-truth-start", totalQuestions: queries.length });

          if (mode === "chunk") {
            const assigner = new ChunkLevelGroundTruthAssigner(chunker!);
            const chunkMap = new Map<string, string>();
            for (const doc of corpus.documents) {
              const chunks = chunker!.chunk(doc.content);
              for (const text of chunks) {
                chunkMap.set(String(generateChunkId(text)), text);
              }
            }

            for (const query of queries) {
              const results = await assigner.assign([query], context) as ChunkLevelGroundTruth[];
              for (const gt of results) {
                const chunkData = gt.relevantChunkIds.map((id) => ({
                  id: String(id),
                  content: chunkMap.get(String(id)) ?? "",
                }));
                send({
                  type: "question",
                  docId: String(gt.query.metadata.sourceDoc ?? ""),
                  query: String(gt.query.text),
                  relevantChunkIds: gt.relevantChunkIds.map(String),
                  chunks: chunkData,
                });
                questionCount++;
              }
            }
          } else {
            const assigner = new TokenLevelGroundTruthAssigner();
            for (const query of queries) {
              const results = await assigner.assign([query], context) as TokenLevelGroundTruth[];
              for (const gt of results) {
                send({
                  type: "question",
                  docId: String(gt.query.metadata.sourceDoc ?? ""),
                  query: String(gt.query.text),
                  relevantSpans: gt.relevantSpans.map((s) => ({
                    docId: String(s.docId),
                    start: s.start,
                    end: s.end,
                    text: s.text,
                  })),
                });
                questionCount++;
              }
            }
          }
        } else {
          // Simple strategy: process per document for streaming
          const strategy: QuestionStrategy = new SimpleStrategy({
            queriesPerDoc: questionsPerDoc,
          });

          if (mode === "chunk") {
            for (const doc of corpus.documents) {
              const singleCorpus = createCorpus([
                createDocument({ id: String(doc.id), content: doc.content }),
              ]);

              const groundTruth = (await generate({
                strategy,
                evaluationType: "chunk-level",
                corpus: singleCorpus,
                llmClient: llm,
                model: "gpt-4o-mini",
                chunker,
                uploadToLangsmith: false,
              })) as ChunkLevelGroundTruth[];

              const chunks = chunker!.chunk(doc.content);
              const chunkMap = new Map<string, string>();
              for (const text of chunks) {
                chunkMap.set(String(generateChunkId(text)), text);
              }

              for (const gt of groundTruth) {
                const chunkData = gt.relevantChunkIds.map((id) => ({
                  id: String(id),
                  content: chunkMap.get(String(id)) ?? "",
                }));
                send({
                  type: "question",
                  docId: String(doc.id),
                  query: String(gt.query.text),
                  relevantChunkIds: gt.relevantChunkIds.map(String),
                  chunks: chunkData,
                });
                questionCount++;
              }
            }
          } else {
            for (const doc of corpus.documents) {
              const singleCorpus = createCorpus([
                createDocument({ id: String(doc.id), content: doc.content }),
              ]);

              const groundTruth = (await generate({
                strategy,
                evaluationType: "token-level",
                corpus: singleCorpus,
                llmClient: llm,
                model: "gpt-4o-mini",
                uploadToLangsmith: false,
              })) as TokenLevelGroundTruth[];

              for (const gt of groundTruth) {
                send({
                  type: "question",
                  docId: String(doc.id),
                  query: String(gt.query.text),
                  relevantSpans: gt.relevantSpans.map((s) => ({
                    docId: String(s.docId),
                    start: s.start,
                    end: s.end,
                    text: s.text,
                  })),
                });
                questionCount++;
              }
            }
          }
        }

        send({ type: "done", totalQuestions: questionCount });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        send({ type: "error", error: message });
      } finally {
        if (tempDimsPath) {
          await rm(tempDimsPath, { force: true }).catch(() => {});
        }
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
