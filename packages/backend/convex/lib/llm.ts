"use node";

import OpenAI from "openai";
import { openAIClientAdapter, type LLMClient } from "rag-evaluation-system";

/**
 * Create an LLMClient backed by OpenAI.
 * Requires OPENAI_API_KEY environment variable in Convex dashboard.
 */
export function createLLMClient(): LLMClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. " +
        "Configure it in your Convex dashboard under Settings → Environment Variables.",
    );
  }
  const openai = new OpenAI({ apiKey });
  return openAIClientAdapter(openai as any);
}
