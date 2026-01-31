import type { Corpus, Document, CharacterSpan, TokenLevelGroundTruth } from "../../types/index.js";
import { QueryId, QueryText } from "../../types/primitives.js";
import { createCharacterSpan } from "../../types/chunks.js";
import { SyntheticDatasetGenerator, type LLMClient } from "../base.js";

export interface TokenLevelGenerateOptions {
  queriesPerDoc?: number;
  uploadToLangsmith?: boolean;
  datasetName?: string;
}

export class TokenLevelSyntheticDatasetGenerator extends SyntheticDatasetGenerator {
  static readonly QUERY_PROMPT = `You are an expert at generating evaluation questions.
Given a document, generate diverse questions answerable from specific passages.

Output JSON: { "questions": ["What is...?", "How does...?", ...] }`;

  static readonly EXCERPT_PROMPT = `You are an expert at identifying relevant text.
Given a document and question, extract exact passages that answer it.
Copy text VERBATIM - do not paraphrase. Each excerpt must appear exactly in the document.

Output JSON: { "excerpts": ["exact text from document...", ...] }`;

  constructor(options: { llmClient: LLMClient; corpus: Corpus; model?: string }) {
    super(options.llmClient, options.corpus, options.model);
  }

  async generate(
    options: TokenLevelGenerateOptions = {},
  ): Promise<TokenLevelGroundTruth[]> {
    const { queriesPerDoc = 5, uploadToLangsmith = true, datasetName } = options;

    const groundTruth: TokenLevelGroundTruth[] = [];
    let queryCounter = 0;

    for (const doc of this._corpus.documents) {
      const questions = await this._generateQuestions(doc, queriesPerDoc);

      for (const question of questions) {
        const excerpts = await this._extractExcerpts(doc, question);
        const spans = this._findSpanPositions(doc, excerpts);

        if (spans.length === 0) continue;

        groundTruth.push({
          query: {
            id: QueryId(`q_${queryCounter++}`),
            text: QueryText(question),
            metadata: { sourceDoc: String(doc.id) },
          },
          relevantSpans: spans,
        });
      }
    }

    if (uploadToLangsmith) {
      const { uploadTokenLevelDataset } = await import("../../langsmith/upload.js");
      await uploadTokenLevelDataset(groundTruth, datasetName);
    }

    return groundTruth;
  }

  private async _generateQuestions(
    doc: Document,
    numQueries: number,
  ): Promise<string[]> {
    const prompt = `Document:\n${doc.content.substring(0, 8000)}\n\nGenerate ${numQueries} diverse questions.`;
    const response = await this.callLLM(
      TokenLevelSyntheticDatasetGenerator.QUERY_PROMPT,
      prompt,
    );
    return JSON.parse(response).questions ?? [];
  }

  private async _extractExcerpts(
    doc: Document,
    question: string,
  ): Promise<string[]> {
    const prompt = `Document:\n${doc.content.substring(0, 8000)}\n\nQuestion: ${question}\n\nExtract exact passages.`;
    const response = await this.callLLM(
      TokenLevelSyntheticDatasetGenerator.EXCERPT_PROMPT,
      prompt,
    );
    return JSON.parse(response).excerpts ?? [];
  }

  private _findSpanPositions(
    doc: Document,
    excerpts: string[],
  ): CharacterSpan[] {
    const spans: CharacterSpan[] = [];

    for (const excerpt of excerpts) {
      let start = doc.content.indexOf(excerpt);

      if (start === -1) {
        // Whitespace-normalized fallback
        start = this._normalizedFind(doc.content, excerpt);
      }

      if (start === -1) {
        console.warn(
          `Could not locate excerpt in document ${doc.id}: ${excerpt.substring(0, 50)}...`,
        );
        continue;
      }

      const end = start + excerpt.length;
      const actualText = doc.content.substring(start, end);

      try {
        spans.push(
          createCharacterSpan({
            docId: String(doc.id),
            start,
            end,
            text: actualText,
          }),
        );
      } catch {
        console.warn(
          `Span validation failed for excerpt in document ${doc.id}: ${excerpt.substring(0, 50)}...`,
        );
      }
    }

    return spans;
  }

  private _normalizedFind(text: string, excerpt: string): number {
    const normalize = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
    const normText = normalize(text);
    const normExcerpt = normalize(excerpt);
    const idx = normText.indexOf(normExcerpt);
    if (idx === -1) return -1;

    // Map back to original position (approximate)
    let origPos = 0;
    let normPos = 0;
    while (normPos < idx && origPos < text.length) {
      if (/\s/.test(text[origPos])) {
        // Skip extra whitespace in original
        while (origPos < text.length - 1 && /\s/.test(text[origPos + 1])) {
          origPos++;
        }
      }
      origPos++;
      normPos++;
    }
    return origPos;
  }
}
