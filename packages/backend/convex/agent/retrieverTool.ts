"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import {
  CallbackRetriever,
  OpenAIEmbedder,
  DocumentId,
  PositionAwareChunkId,
  type PositionAwareChunk,
} from "rag-evaluation-system";
import OpenAI from "openai";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

function createEmbedder(model?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  return new OpenAIEmbedder({
    model: model ?? "text-embedding-3-small",
    client: new OpenAI({ apiKey }),
  });
}

interface KBToolConfig {
  kbId: Id<"knowledgeBases">;
  kbName: string;
  indexConfigHash?: string;
  embeddingModel?: string;
}

export function createKBRetrieverTool(config: KBToolConfig) {
  const { kbId, kbName, indexConfigHash, embeddingModel } = config;

  return createTool({
    description: `Search the "${kbName}" knowledge base for relevant information. Use this tool when the user asks questions that might be answered by documents in ${kbName}.`,
    args: z.object({
      query: z.string().describe("The search query to find relevant information"),
      topK: z.number().default(10).describe("Number of top results to return"),
    }),
    handler: async (ctx, { query, topK }): Promise<string> => {
      const embedder = createEmbedder(embeddingModel);

      const retriever = new CallbackRetriever({
        name: `kb-${kbName}`,
        retrieveFn: async (q: string, k: number) => {
          const queryEmbedding = await embedder.embedQuery(q);
          const vectorLimit = Math.min(k * 4, 256);

          const searchResults = await ctx.vectorSearch(
            "documentChunks",
            "by_embedding",
            {
              vector: queryEmbedding,
              limit: vectorLimit,
              filter: (f: any) => f.eq("kbId", kbId),
            },
          );

          const chunks = await ctx.runQuery(
            internal.rag.fetchChunksWithDocs,
            { ids: searchResults.map((r: any) => r._id) },
          );

          // Post-filter by indexConfigHash if provided, take top-K
          const filtered = indexConfigHash
            ? chunks.filter((c: any) => c.indexConfigHash === indexConfigHash)
            : chunks;

          return filtered.slice(0, k).map(
            (c: any): PositionAwareChunk => ({
              id: PositionAwareChunkId(c.chunkId),
              content: c.content,
              metadata: c.metadata ?? {},
              docId: DocumentId(c.docId),
              start: c.start,
              end: c.end,
            }),
          );
        },
      });

      const results = await retriever.retrieve(query, topK);

      // Format results for the LLM with source attribution
      if (results.length === 0) {
        return `No relevant results found in "${kbName}" for this query.`;
      }

      const formatted = results.map((chunk, i) => {
        return [
          `[Source ${i + 1}] Document: ${chunk.docId}, chars ${chunk.start}-${chunk.end}`,
          chunk.content,
        ].join("\n");
      });

      return `Found ${results.length} relevant chunks from "${kbName}":\n\n${formatted.join("\n\n---\n\n")}`;
    },
  });
}
