import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ─── Mutations ───

/**
 * Insert a single document chunk into the documentChunks table.
 */
export const insertChunk = internalMutation({
  args: {
    documentId: v.id("documents"),
    kbId: v.id("knowledgeBases"),
    chunkId: v.string(),
    content: v.string(),
    start: v.number(),
    end: v.number(),
    embedding: v.array(v.float64()),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documentChunks", args);
  },
});

/**
 * Delete all chunks for a document.
 */
export const deleteDocumentChunks = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }
    return { chunksDeleted: chunks.length };
  },
});

/**
 * Delete all chunks for a knowledge base.
 */
export const deleteKbChunks = internalMutation({
  args: { kbId: v.id("knowledgeBases") },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("by_kb", (q) => q.eq("kbId", args.kbId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }
    return { chunksDeleted: chunks.length };
  },
});

// ─── Queries ───

/**
 * Check if a knowledge base has been indexed (has any chunks).
 */
export const isIndexed = internalQuery({
  args: { kbId: v.id("knowledgeBases") },
  handler: async (ctx, args) => {
    const first = await ctx.db
      .query("documentChunks")
      .withIndex("by_kb", (q) => q.eq("kbId", args.kbId))
      .first();
    return first !== null;
  },
});

/**
 * Fetch full chunk records by IDs, including parent document's docId.
 * Used after vector search (which must run in an action) to hydrate results.
 */
export const fetchChunksWithDocs = internalQuery({
  args: {
    ids: v.array(v.id("documentChunks")),
  },
  handler: async (ctx, args) => {
    const chunks = [];
    for (const id of args.ids) {
      const chunk = await ctx.db.get(id);
      if (!chunk) continue;

      const doc = await ctx.db.get(chunk.documentId);
      chunks.push({
        ...chunk,
        docId: doc?.docId ?? "",
      });
    }
    return chunks;
  },
});
