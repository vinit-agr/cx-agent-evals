import type { ChunkLevelGroundTruth } from "../../types/index.js";
import { QueryId, QueryText, ChunkId } from "../../types/primitives.js";
import type { Chunker } from "../../chunkers/chunker.interface.js";
import { generateChunkId } from "../../utils/hashing.js";
import type { GroundTruthAssigner, GroundTruthAssignerContext } from "./types.js";
import type { GeneratedQuery } from "../strategies/types.js";

const SYSTEM_PROMPT = `You are an expert at identifying which document chunks are relevant to a question.
Given a question and a set of document chunks (each labelled with an ID), identify which chunks contain information needed to answer the question.

Output JSON format:
{
  "relevant_chunk_ids": ["chunk_xxx", "chunk_yyy"]
}`;

export class ChunkLevelGroundTruthAssigner
  implements GroundTruthAssigner<ChunkLevelGroundTruth>
{
  readonly name = "chunk-level";
  private _chunker: Chunker;

  constructor(chunker: Chunker) {
    this._chunker = chunker;
  }

  async assign(
    queries: GeneratedQuery[],
    context: GroundTruthAssignerContext,
  ): Promise<ChunkLevelGroundTruth[]> {
    const chunkIndex = this._buildChunkIndex(context);
    const results: ChunkLevelGroundTruth[] = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const docChunks = [...chunkIndex.entries()].filter(
        ([, info]) => info.docId === query.targetDocId,
      );

      if (docChunks.length === 0) continue;

      const chunkText = docChunks
        .slice(0, 20)
        .map(([id, info]) => `[${id}]: ${info.content.substring(0, 500)}`)
        .join("\n\n");

      const prompt = `Question: ${query.query}\n\nChunks:\n${chunkText}\n\nWhich chunks are relevant to this question?`;
      const response = await context.llmClient.complete({
        model: context.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        responseFormat: "json",
      });

      const data = JSON.parse(response);
      const chunkIds: string[] = data.relevant_chunk_ids ?? [];
      const validIds = chunkIds.filter((id) => chunkIndex.has(id));

      if (validIds.length === 0) continue;

      results.push({
        query: {
          id: QueryId(`q_${i}`),
          text: QueryText(query.query),
          metadata: { sourceDoc: query.targetDocId, ...query.metadata },
        },
        relevantChunkIds: validIds.map((id) => ChunkId(id)),
      });
    }

    return results;
  }

  private _buildChunkIndex(
    context: GroundTruthAssignerContext,
  ): Map<string, { content: string; docId: string }> {
    const index = new Map<string, { content: string; docId: string }>();
    for (const doc of context.corpus.documents) {
      const chunks = this._chunker.chunk(doc.content);
      for (const chunkText of chunks) {
        const chunkId = generateChunkId(chunkText);
        index.set(String(chunkId), {
          content: chunkText,
          docId: String(doc.id),
        });
      }
    }
    return index;
  }
}
