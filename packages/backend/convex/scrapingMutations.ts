import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ───

export const getPendingUrls = internalQuery({
  args: {
    crawlJobId: v.id("crawlJobs"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawlUrls")
      .withIndex("by_job_status", (q) =>
        q.eq("crawlJobId", args.crawlJobId).eq("status", "pending"),
      )
      .take(args.limit);
  },
});

export const getCrawlJob = internalQuery({
  args: { jobId: v.id("crawlJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const countPendingUrls = internalQuery({
  args: { crawlJobId: v.id("crawlJobs") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("crawlUrls")
      .withIndex("by_job_status", (q) =>
        q.eq("crawlJobId", args.crawlJobId).eq("status", "pending"),
      )
      .collect();
    return pending.length;
  },
});

// ─── Mutations ───

export const markUrlsScraping = internalMutation({
  args: {
    urlIds: v.array(v.id("crawlUrls")),
  },
  handler: async (ctx, args) => {
    for (const id of args.urlIds) {
      await ctx.db.patch(id, { status: "scraping" });
    }
  },
});

export const persistScrapedPage = internalMutation({
  args: {
    crawlUrlId: v.id("crawlUrls"),
    orgId: v.string(),
    kbId: v.id("knowledgeBases"),
    title: v.string(),
    content: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const docId = await ctx.db.insert("documents", {
      orgId: args.orgId,
      kbId: args.kbId,
      docId: args.title,
      title: args.title,
      content: args.content,
      contentLength: args.content.length,
      metadata: {},
      sourceUrl: args.sourceUrl,
      sourceType: "scraped",
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.crawlUrlId, {
      status: "done",
      documentId: docId,
      scrapedAt: Date.now(),
    });

    return docId;
  },
});

export const insertDiscoveredUrls = internalMutation({
  args: {
    crawlJobId: v.id("crawlJobs"),
    urls: v.array(
      v.object({
        url: v.string(),
        normalizedUrl: v.string(),
        depth: v.number(),
        parentUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const urlData of args.urls) {
      // Dedup check via index
      const existing = await ctx.db
        .query("crawlUrls")
        .withIndex("by_job_url", (q) =>
          q
            .eq("crawlJobId", args.crawlJobId)
            .eq("normalizedUrl", urlData.normalizedUrl),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("crawlUrls", {
          crawlJobId: args.crawlJobId,
          url: urlData.url,
          normalizedUrl: urlData.normalizedUrl,
          status: "pending",
          depth: urlData.depth,
          parentUrl: urlData.parentUrl,
          retryCount: 0,
        });
        inserted++;
      }
    }
    return { inserted };
  },
});

export const markUrlFailed = internalMutation({
  args: {
    crawlUrlId: v.id("crawlUrls"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const url = await ctx.db.get(args.crawlUrlId);
    if (!url) return;

    await ctx.db.patch(args.crawlUrlId, {
      status: "failed",
      error: args.error,
      retryCount: (url.retryCount ?? 0) + 1,
    });
  },
});

export const updateCrawlJobStats = internalMutation({
  args: {
    jobId: v.id("crawlJobs"),
    scrapedDelta: v.number(),
    failedDelta: v.number(),
    discoveredDelta: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    await ctx.db.patch(args.jobId, {
      stats: {
        discovered: job.stats.discovered + args.discoveredDelta,
        scraped: job.stats.scraped + args.scrapedDelta,
        failed: job.stats.failed + args.failedDelta,
        skipped: job.stats.skipped,
      },
    });
  },
});

export const completeCrawlJob = internalMutation({
  args: {
    jobId: v.id("crawlJobs"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

export const resetFailedUrlsForRetry = internalMutation({
  args: {
    crawlJobId: v.id("crawlJobs"),
    maxRetries: v.number(),
  },
  handler: async (ctx, args) => {
    const failedUrls = await ctx.db
      .query("crawlUrls")
      .withIndex("by_job_status", (q) =>
        q.eq("crawlJobId", args.crawlJobId).eq("status", "failed"),
      )
      .collect();

    let reset = 0;
    for (const url of failedUrls) {
      if ((url.retryCount ?? 0) < args.maxRetries) {
        await ctx.db.patch(url._id, { status: "pending" });
        reset++;
      }
    }
    return { reset };
  },
});
