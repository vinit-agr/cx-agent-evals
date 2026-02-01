import { NextRequest } from "next/server";
import { discoverDimensions, openAIClientAdapter } from "rag-evaluation-system";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY environment variable is required" },
      { status: 500 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;
  if (!url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const llm = openAIClientAdapter(openai as any);

    const tempDir = join(tmpdir(), "rag-eval-dimensions");
    await mkdir(tempDir, { recursive: true });
    const outputPath = join(tempDir, `dims-${Date.now()}.json`);

    const dimensions = await discoverDimensions({
      url,
      outputPath,
      llmClient: llm,
      model: "gpt-4o",
    });

    // Clean up temp file
    await rm(outputPath, { force: true });

    return Response.json({ dimensions });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Dimension discovery failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
