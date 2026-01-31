import type { Embedder } from "./embedder.interface.js";

export class OpenAIEmbedder implements Embedder {
  readonly name: string;
  readonly dimension: number;
  private _model: string;
  private _client: any;

  constructor(options: { model?: string; client: any }) {
    this._model = options.model ?? "text-embedding-3-small";
    this._client = options.client;
    this.name = `OpenAI(${this._model})`;

    const knownDims: Record<string, number> = {
      "text-embedding-3-small": 1536,
      "text-embedding-3-large": 3072,
      "text-embedding-ada-002": 1536,
    };
    this.dimension = knownDims[this._model] ?? 1536;
  }

  static async create(options: { model?: string } = {}): Promise<OpenAIEmbedder> {
    try {
      const { default: OpenAI } = await import("openai");
      return new OpenAIEmbedder({ ...options, client: new OpenAI() });
    } catch {
      throw new Error("openai package required. Install with: pnpm add openai");
    }
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    const response = await this._client.embeddings.create({
      model: this._model,
      input: [...texts],
    });
    return response.data.map((item: any) => item.embedding);
  }

  async embedQuery(query: string): Promise<number[]> {
    const result = await this.embed([query]);
    return result[0];
  }
}
