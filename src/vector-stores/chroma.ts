import type { PositionAwareChunk } from "../types/index.js";
import { PositionAwareChunkId, DocumentId } from "../types/primitives.js";
import type { VectorStore } from "./vector-store.interface.js";
import { randomUUID } from "node:crypto";

export class ChromaVectorStore implements VectorStore {
  readonly name: string;
  private _collectionName: string;
  private _client: any;
  private _collection: any;

  private constructor(client: any, collectionName: string) {
    this._client = client;
    this._collectionName = collectionName;
    this.name = `Chroma(${this._collectionName})`;
  }

  static async create(
    options: { collectionName?: string } = {},
  ): Promise<ChromaVectorStore> {
    try {
      const { ChromaClient } = await import("chromadb");
      const client = new ChromaClient();
      const name =
        options.collectionName ?? `rag_eval_${randomUUID().substring(0, 8)}`;
      return new ChromaVectorStore(client, name);
    } catch {
      throw new Error("chromadb package required. Install with: pnpm add chromadb");
    }
  }

  private async _ensureCollection(): Promise<void> {
    if (!this._collection) {
      this._collection = await this._client.getOrCreateCollection({
        name: this._collectionName,
        metadata: { "hnsw:space": "cosine" },
      });
    }
  }

  async add(
    chunks: readonly PositionAwareChunk[],
    embeddings: readonly number[][],
  ): Promise<void> {
    if (chunks.length === 0) return;
    await this._ensureCollection();

    await this._collection.add({
      ids: chunks.map((c) => String(c.id)),
      embeddings: [...embeddings],
      documents: chunks.map((c) => c.content),
      metadatas: chunks.map((c) => ({
        docId: String(c.docId),
        start: c.start,
        end: c.end,
        ...c.metadata,
      })),
    });
  }

  async search(
    queryEmbedding: readonly number[],
    k: number = 5,
  ): Promise<PositionAwareChunk[]> {
    await this._ensureCollection();

    const results = await this._collection.query({
      queryEmbeddings: [[...queryEmbedding]],
      nResults: k,
      include: ["documents", "metadatas"],
    });

    if (!results.ids[0]?.length) return [];

    return results.ids[0].map((id: string, i: number) => {
      const metadata = results.metadatas[0][i];
      return {
        id: PositionAwareChunkId(id),
        content: results.documents[0][i],
        docId: DocumentId(metadata.docId),
        start: metadata.start,
        end: metadata.end,
        metadata: {},
      };
    });
  }

  async clear(): Promise<void> {
    try {
      await this._client.deleteCollection(this._collectionName);
    } catch {
      // Collection may not exist
    }
    this._collection = null;
  }
}
