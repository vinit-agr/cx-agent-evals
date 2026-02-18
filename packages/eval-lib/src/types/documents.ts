import { z } from "zod";
import type { DocumentId } from "./primitives.js";
import { DocumentId as DocumentIdFactory } from "./primitives.js";

export const DocumentSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    metadata: z.record(z.unknown()).default({}),
  })
  .readonly();

export const CorpusSchema = z
  .object({
    documents: z.array(DocumentSchema).readonly(),
    metadata: z.record(z.unknown()).default({}),
  })
  .readonly();

export interface Document {
  readonly id: DocumentId;
  readonly content: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface Corpus {
  readonly documents: readonly Document[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createDocument(params: {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Document {
  return {
    id: DocumentIdFactory(params.id),
    content: params.content,
    metadata: Object.freeze(params.metadata ?? {}),
  };
}

export function createCorpus(documents: Document[], metadata?: Record<string, unknown>): Corpus {
  return {
    documents: Object.freeze([...documents]),
    metadata: Object.freeze(metadata ?? {}),
  };
}

/**
 * Load a corpus from a folder on disk.
 * Requires Node.js — uses dynamic imports for fs/path to stay tree-shakeable.
 */
export async function corpusFromFolder(
  folderPath: string,
  globPattern: string = "**/*.md",
): Promise<Corpus> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join, relative } = await import("node:path");

  const documents: Document[] = [];

  async function collectFiles(
    baseDir: string,
    currentDir: string,
    pattern: string,
  ): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await collectFiles(baseDir, fullPath, pattern);
      } else if (entry.isFile() && matchesGlob(relative(baseDir, fullPath), pattern)) {
        const content = await readFile(fullPath, "utf-8");
        documents.push(
          createDocument({
            id: relative(baseDir, fullPath),
            content,
          }),
        );
      }
    }
  }

  await collectFiles(folderPath, folderPath, globPattern);
  return createCorpus(documents);
}

function matchesGlob(filePath: string, pattern: string): boolean {
  // Simple glob matching: support ** and *
  // Replace **/ with optional directory prefix so it matches root-level files too
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*\//g, "(.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${regexStr}$`).test(filePath);
}

/**
 * Create a Corpus from plain document objects (no filesystem access).
 * Use this in environments without Node.js fs APIs (e.g., Convex actions).
 */
export function createCorpusFromDocuments(
  docs: ReadonlyArray<{
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>,
  metadata?: Record<string, unknown>,
): Corpus {
  const documents = docs.map((d) =>
    createDocument({ id: d.id, content: d.content, metadata: d.metadata }),
  );
  return createCorpus(documents, metadata);
}

export function getDocument(corpus: Corpus, docId: DocumentId): Document | undefined {
  return corpus.documents.find((doc) => doc.id === docId);
}
