import type { PositionAwareChunk } from "../types/index.js";
import type { Reranker } from "./reranker.interface.js";

interface VoyageRerankClient {
  rerank(opts: {
    model: string;
    query: string;
    documents: string[];
    top_k: number;
  }): Promise<{
    data: Array<{ index: number; relevance_score: number }>;
  }>;
}

export class VoyageReranker implements Reranker {
  readonly name: string;
  private _model: string;
  private _client: VoyageRerankClient;

  constructor(options: { client: VoyageRerankClient; model?: string }) {
    this._model = options.model ?? "rerank-2.5";
    this._client = options.client;
    this.name = `Voyage(${this._model})`;
  }

  /**
   * Create a VoyageReranker using the Voyage REST API.
   * @param options.model - Voyage reranker model (default: "rerank-2.5")
   * @param options.apiKey - Voyage API key (defaults to VOYAGE_API_KEY env var)
   */
  static async create(
    options: { model?: string; apiKey?: string } = {},
  ): Promise<VoyageReranker> {
    const apiKey = options.apiKey ?? process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Voyage API key required. Set VOYAGE_API_KEY environment variable or pass apiKey option.",
      );
    }

    const model = options.model ?? "rerank-2.5";

    const client: VoyageRerankClient = {
      async rerank(opts) {
        const response = await fetch(
          "https://api.voyageai.com/v1/rerank",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: opts.model,
              query: opts.query,
              documents: opts.documents,
              top_k: opts.top_k,
            }),
          },
        );

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `Voyage Rerank API error: ${response.status} ${response.statusText} — ${body}`,
          );
        }

        return (await response.json()) as {
          data: Array<{ index: number; relevance_score: number }>;
        };
      },
    };

    return new VoyageReranker({ client, model });
  }

  async rerank(
    query: string,
    chunks: readonly PositionAwareChunk[],
    topK?: number,
  ): Promise<PositionAwareChunk[]> {
    if (chunks.length === 0) return [];

    const response = await this._client.rerank({
      model: this._model,
      query,
      documents: chunks.map((c) => c.content),
      top_k: topK ?? chunks.length,
    });

    return response.data.map((r) => chunks[r.index]);
  }
}
