import { NextRequest, NextResponse } from "next/server";
import { resolve } from "node:path";
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
    const corpus = await corpusFromFolder(resolvedPath, "**/*.md");

    if (corpus.documents.length === 0) {
      return NextResponse.json(
        { error: "Folder not found or contains no markdown files" },
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
