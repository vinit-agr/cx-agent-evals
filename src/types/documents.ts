import { z } from "zod";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
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

export async function corpusFromFolder(
  folderPath: string,
  globPattern: string = "**/*.md",
): Promise<Corpus> {
  const documents: Document[] = [];
  await collectFiles(folderPath, folderPath, globPattern, documents);
  return createCorpus(documents);
}

async function collectFiles(
  baseDir: string,
  currentDir: string,
  pattern: string,
  documents: Document[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(baseDir, fullPath, pattern, documents);
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

function matchesGlob(filePath: string, pattern: string): boolean {
  // Simple glob matching: support ** and *
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${regexStr}$`).test(filePath);
}

export function getDocument(corpus: Corpus, docId: DocumentId): Document | undefined {
  return corpus.documents.find((doc) => doc.id === docId);
}
