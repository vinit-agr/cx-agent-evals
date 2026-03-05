import { gotScraping } from "got-scraping";
import { htmlToMarkdown } from "../file-processing/html-to-markdown.js";
import type { ScrapedPage, ScrapeOptions } from "./types.js";

export interface ContentScraperConfig {
  userAgent?: string;
  defaultHeaders?: Record<string, string>;
}

export class ContentScraper {
  private userAgent: string;
  private defaultHeaders: Record<string, string>;

  constructor(config?: ContentScraperConfig) {
    this.userAgent =
      config?.userAgent ?? "Mozilla/5.0 (compatible; RAGEvalBot/1.0)";
    this.defaultHeaders = config?.defaultHeaders ?? {};
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<ScrapedPage> {
    const response = await gotScraping({
      url,
      headers: {
        "User-Agent": this.userAgent,
        ...this.defaultHeaders,
        ...options?.headers,
      },
      timeout: { request: options?.timeout ?? 30_000 },
      responseType: "text",
    });

    const html = response.body as string;

    const result = await htmlToMarkdown(html, {
      onlyMainContent: options?.onlyMainContent ?? true,
      baseUrl: url,
    });

    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
    );
    const langMatch = html.match(/<html[^>]*lang=["']([^"']*)["']/i);

    return {
      url,
      markdown: result.content,
      metadata: {
        title: result.title,
        sourceURL: url,
        description: descMatch?.[1],
        language: langMatch?.[1],
        statusCode: response.statusCode,
        links: result.links,
      },
    };
  }
}
