import type { Corpus, ChunkLevelGroundTruth, TokenLevelGroundTruth } from "../types/index.js";
import type { EvaluationType } from "../types/primitives.js";
import type { Chunker } from "../chunkers/chunker.interface.js";
import type { LLMClient } from "./base.js";
import type { QuestionStrategy } from "./strategies/types.js";
import { ChunkLevelGroundTruthAssigner } from "./ground-truth/chunk-level.js";
import { TokenLevelGroundTruthAssigner } from "./ground-truth/token-level.js";

// Re-export everything consumers need
export type { LLMClient } from "./base.js";
export { openAIClientAdapter } from "./base.js";
export type {
  QuestionStrategy,
  GeneratedQuery,
  StrategyContext,
  SimpleStrategyOptions,
  DimensionDrivenStrategyOptions,
  RealWorldGroundedStrategyOptions,
  MatchedQuestion,
  Dimension,
  DimensionCombo,
  ProgressCallback,
  ProgressEvent,
} from "./strategies/types.js";
export { SimpleStrategy } from "./strategies/simple/generator.js";
export { DimensionDrivenStrategy } from "./strategies/dimension-driven/generator.js";
export { RealWorldGroundedStrategy } from "./strategies/real-world-grounded/generator.js";
export { discoverDimensions } from "./strategies/dimension-driven/discovery.js";
export { loadDimensions } from "./strategies/dimension-driven/dimensions.js";
export { ChunkLevelGroundTruthAssigner } from "./ground-truth/chunk-level.js";
export { TokenLevelGroundTruthAssigner } from "./ground-truth/token-level.js";

// Legacy re-exports for backward compatibility during migration
export { ChunkLevelSyntheticDatasetGenerator } from "./chunk-level/index.js";
export { TokenLevelSyntheticDatasetGenerator } from "./token-level/index.js";

export interface GenerateOptions {
  readonly strategy: QuestionStrategy;
  readonly evaluationType: EvaluationType;
  readonly corpus: Corpus;
  readonly llmClient: LLMClient;
  readonly model?: string;
  readonly chunker?: Chunker;
  readonly uploadToLangsmith?: boolean;
  readonly datasetName?: string;
}

export async function generate(
  options: GenerateOptions,
): Promise<ChunkLevelGroundTruth[] | TokenLevelGroundTruth[]> {
  const model = options.model ?? "gpt-4o";
  const context = {
    corpus: options.corpus,
    llmClient: options.llmClient,
    model,
  };

  const queries = await options.strategy.generate(context);

  if (options.evaluationType === "chunk-level") {
    if (!options.chunker) {
      throw new Error("chunker is required for chunk-level evaluation");
    }
    const assigner = new ChunkLevelGroundTruthAssigner(options.chunker);
    const results = await assigner.assign(queries, context);

    if (options.uploadToLangsmith) {
      const { uploadChunkLevelDataset } = await import("../langsmith/upload.js");
      await uploadChunkLevelDataset(results, options.datasetName);
    }

    return results;
  }

  const assigner = new TokenLevelGroundTruthAssigner();
  const results = await assigner.assign(queries, context);

  if (options.uploadToLangsmith) {
    const { uploadTokenLevelDataset } = await import("../langsmith/upload.js");
    await uploadTokenLevelDataset(results, options.datasetName);
  }

  return results;
}
