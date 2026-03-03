"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ContentScraper, filterLinks, normalizeUrl } from "rag-evaluation-system";

const TIME_BUDGET_MS = 9 * 60 * 1000; // 9 minutes
const BATCH_SIZE = 15;
const MIN_TIME_REMAINING_MS = 30_000; // 30 seconds buffer

export const batchScrape = internalAction({
  args: {
    crawlJobId: v.id("crawlJobs"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const scraper = new ContentScraper();

    // Load job config
    const job = await ctx.runQuery(
      internal.scrapingMutations.getCrawlJob,
      { jobId: args.crawlJobId },
    );
    if (!job) throw new Error("Crawl job not found");
    if (job.status === "cancelled") return;

    const maxPages = job.config.maxPages ?? 100;
    const maxDepth = job.config.maxDepth ?? 3;
    const delay = job.config.delay ?? 0;
    const concurrency = job.config.concurrency ?? 3;
    const onlyMainContent = job.config.onlyMainContent ?? true;

    let totalScraped = 0;
    let totalFailed = 0;
    let totalDiscovered = 0;

    // Time-budgeted loop
    while (Date.now() - startTime < TIME_BUDGET_MS - MIN_TIME_REMAINING_MS) {
      // Check if job was cancelled
      const currentJob = await ctx.runQuery(
        internal.scrapingMutations.getCrawlJob,
        { jobId: args.crawlJobId },
      );
      if (!currentJob || currentJob.status === "cancelled") break;

      // Check max pages
      if (currentJob.stats.scraped + totalScraped >= maxPages) break;

      // Get next batch of pending URLs
      const batch = await ctx.runQuery(
        internal.scrapingMutations.getPendingUrls,
        { crawlJobId: args.crawlJobId, limit: BATCH_SIZE },
      );
      if (batch.length === 0) break;

      // Mark as scraping
      await ctx.runMutation(
        internal.scrapingMutations.markUrlsScraping,
        { urlIds: batch.map((u: any) => u._id) },
      );

      // Process batch with concurrency limit
      const chunks = [];
      for (let i = 0; i < batch.length; i += concurrency) {
        chunks.push(batch.slice(i, i + concurrency));
      }

      for (const chunk of chunks) {
        // Check time budget before each concurrent batch
        if (Date.now() - startTime >= TIME_BUDGET_MS - MIN_TIME_REMAINING_MS) break;

        const results = await Promise.allSettled(
          chunk.map(async (urlRecord: any) => {
            // Respect delay
            if (delay > 0) {
              await new Promise((r) => setTimeout(r, delay));
            }

            const scraped = await scraper.scrape(urlRecord.url, {
              onlyMainContent,
              timeout: 30_000,
            });

            return { urlRecord, scraped };
          }),
        );

        let batchScraped = 0;
        let batchFailed = 0;
        let batchDiscovered = 0;

        for (const result of results) {
          if (result.status === "fulfilled") {
            const { urlRecord, scraped } = result.value;

            // Persist document
            await ctx.runMutation(
              internal.scrapingMutations.persistScrapedPage,
              {
                crawlUrlId: urlRecord._id,
                orgId: job.orgId,
                kbId: job.kbId,
                title: scraped.metadata.title || urlRecord.url,
                content: scraped.markdown,
                sourceUrl: urlRecord.url,
              },
            );
            batchScraped++;

            // Discover new URLs (only if within depth limit)
            if (urlRecord.depth < maxDepth) {
              const filteredLinks = filterLinks(
                scraped.metadata.links,
                job.startUrl,
                {
                  includePaths: job.config.includePaths ?? undefined,
                  excludePaths: job.config.excludePaths ?? undefined,
                  allowSubdomains: job.config.allowSubdomains ?? false,
                },
              );

              if (filteredLinks.length > 0) {
                const newUrls = filteredLinks.map((link: string) => ({
                  url: link,
                  normalizedUrl: normalizeUrl(link),
                  depth: urlRecord.depth + 1,
                  parentUrl: urlRecord.url,
                }));

                const { inserted } = await ctx.runMutation(
                  internal.scrapingMutations.insertDiscoveredUrls,
                  { crawlJobId: args.crawlJobId, urls: newUrls },
                );
                batchDiscovered += inserted;
              }
            }
          } else {
            // Failed
            const urlRecord = chunk[results.indexOf(result)];
            const errorMsg =
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason);

            await ctx.runMutation(
              internal.scrapingMutations.markUrlFailed,
              { crawlUrlId: urlRecord._id, error: errorMsg },
            );
            batchFailed++;
          }
        }

        // Update job stats
        if (batchScraped > 0 || batchFailed > 0 || batchDiscovered > 0) {
          await ctx.runMutation(
            internal.scrapingMutations.updateCrawlJobStats,
            {
              jobId: args.crawlJobId,
              scrapedDelta: batchScraped,
              failedDelta: batchFailed,
              discoveredDelta: batchDiscovered,
            },
          );
          totalScraped += batchScraped;
          totalFailed += batchFailed;
          totalDiscovered += batchDiscovered;
        }
      }
    }

    return { totalScraped, totalFailed, totalDiscovered };
  },
});
