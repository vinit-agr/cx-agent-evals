import { NextRequest, NextResponse } from "next/server";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import { corpusFromFolder } from "rag-evaluation-system";

export async function POST(request: NextRequest) {
  try {
    const { folderPath } = await request.json();

    if (!folderPath || typeof folderPath !== "string") {
      return NextResponse.json(
        { error: "folderPath is required" },
        { status: 400 },
      );
    }

    const resolvedPath = resolve(folderPath);

    // Check directory exists before attempting to read
    const dirStat = await stat(resolvedPath).catch(() => null);
    if (!dirStat || !dirStat.isDirectory()) {
      return NextResponse.json(
        { error: `Directory not found: ${resolvedPath}` },
        { status: 400 },
      );
    }

    const corpus = await corpusFromFolder(resolvedPath, "**/*.md");

    if (corpus.documents.length === 0) {
      return NextResponse.json(
        { error: `No markdown files found in: ${resolvedPath}` },
        { status: 400 },
      );
    }

    const documents = corpus.documents.map((doc) => ({
      id: String(doc.id),
      content: doc.content,
      contentLength: doc.content.length,
    }));

    return NextResponse.json({ documents });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load corpus";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
