import type { Corpus, ChunkLevelGroundTruth } from "../../types/index.js";
import { QueryId, QueryText, ChunkId } from "../../types/primitives.js";
import type { Chunker } from "../../chunkers/chunker.interface.js";
import { generateChunkId } from "../../utils/hashing.js";
import { SyntheticDatasetGenerator, type LLMClient } from "../base.js";

export interface ChunkLevelGenerateOptions {
  queriesPerDoc?: number;
  uploadToLangsmith?: boolean;
  datasetName?: string;
}

export class ChunkLevelSyntheticDatasetGenerator extends SyntheticDatasetGenerator {
  private _chunker: Chunker;
  private _chunkIndex = new Map<string, { content: string; docId: string }>();

  static readonly SYSTEM_PROMPT = `You are an expert at generating evaluation data for RAG systems.
Given chunks from a document with their IDs, generate questions that can be answered using specific chunks.
For each question, list the chunk IDs that contain the answer.

Output JSON format:
{
  "qa_pairs": [
    { "query": "What is...?", "relevant_chunk_ids": ["chunk_xxx", "chunk_yyy"] }
  ]
}`;

  constructor(options: {
    llmClient: LLMClient;
    corpus: Corpus;
    chunker: Chunker;
    model?: string;
  }) {
    super(options.llmClient, options.corpus, options.model);
    this._chunker = options.chunker;
  }

  async generate(
    options: ChunkLevelGenerateOptions = {},
  ): Promise<ChunkLevelGroundTruth[]> {
    const { queriesPerDoc = 5, uploadToLangsmith = true, datasetName } = options;

    this._buildChunkIndex();

    const groundTruth: ChunkLevelGroundTruth[] = [];
    let queryCounter = 0;

    for (const doc of this._corpus.documents) {
      // Filter chunks belonging to this document
      const docChunks = [...this._chunkIndex.entries()].filter(
        ([, info]) => info.docId === String(doc.id),
      );

      if (docChunks.length === 0) continue;

      const qaPairs = await this._generateQAPairs(
        docChunks.slice(0, 20),
        queriesPerDoc,
      );

      for (const qa of qaPairs) {
        const validIds = qa.relevant_chunk_ids.filter((id: string) =>
          this._chunkIndex.has(id),
        );
        if (validIds.length === 0) continue;

        groundTruth.push({
          query: {
            id: QueryId(`q_${queryCounter++}`),
            text: QueryText(qa.query),
            metadata: { sourceDoc: String(doc.id) },
          },
          relevantChunkIds: validIds.map((id: string) => ChunkId(id)),
        });
      }
    }

    if (uploadToLangsmith) {
      const { uploadChunkLevelDataset } = await import("../../langsmith/upload.js");
      await uploadChunkLevelDataset(groundTruth, datasetName);
    }

    return groundTruth;
  }

  private _buildChunkIndex(): void {
    this._chunkIndex.clear();
    for (const doc of this._corpus.documents) {
      const chunks = this._chunker.chunk(doc.content);
      for (const chunkText of chunks) {
        const chunkId = generateChunkId(chunkText);
        this._chunkIndex.set(String(chunkId), {
          content: chunkText,
          docId: String(doc.id),
        });
      }
    }
  }

  private async _generateQAPairs(
    chunks: Array<[string, { content: string; docId: string }]>,
    numQueries: number,
  ): Promise<Array<{ query: string; relevant_chunk_ids: string[] }>> {
    const chunkText = chunks
      .map(([id, info]) => `[${id}]: ${info.content.substring(0, 500)}`)
      .join("\n\n");

    const prompt = `Here are chunks from a document:\n\n${chunkText}\n\nGenerate ${numQueries} diverse questions.`;
    const response = await this.callLLM(
      ChunkLevelSyntheticDatasetGenerator.SYSTEM_PROMPT,
      prompt,
    );
    const data = JSON.parse(response);
    return data.qa_pairs ?? [];
  }
}
