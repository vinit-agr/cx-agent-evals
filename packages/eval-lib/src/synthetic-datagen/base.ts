import type { Corpus } from "../types/index.js";

export interface LLMClient {
  readonly name: string;
  complete(params: {
    model: string;
    messages: ReadonlyArray<{ role: string; content: string }>;
    responseFormat?: "json" | "text";
  }): Promise<string>;
}

export function openAIClientAdapter(client: {
  chat: {
    completions: {
      create(params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        response_format?: { type: string };
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}): LLMClient {
  return {
    name: "OpenAI",
    async complete(params) {
      const response = await client.chat.completions.create({
        model: params.model,
        messages: [...params.messages],
        ...(params.responseFormat === "json"
          ? { response_format: { type: "json_object" } }
          : {}),
      });
      return response.choices[0].message.content ?? "";
    },
  };
}

export abstract class SyntheticDatasetGenerator {
  protected _llm: LLMClient;
  protected _corpus: Corpus;
  protected _model: string;

  constructor(llmClient: LLMClient, corpus: Corpus, model = "gpt-4o") {
    this._llm = llmClient;
    this._corpus = corpus;
    this._model = model;
  }

  get corpus(): Corpus {
    return this._corpus;
  }

  protected async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    return this._llm.complete({
      model: this._model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      responseFormat: "json",
    });
  }
}
