import { describe, it, expect, vi } from "vitest";
import { ContentScraper } from "../../../src/scraper/scraper.js";

vi.mock("got-scraping", () => ({
  gotScraping: vi.fn().mockResolvedValue({
    body: "<html><body><h1>Test Page</h1><p>Content</p><a href='/other'>Link</a></body></html>",
    statusCode: 200,
    headers: { "content-type": "text/html" },
  }),
}));

describe("ContentScraper", () => {
  it("scrapes a URL and returns markdown + metadata", async () => {
    const scraper = new ContentScraper();
    const result = await scraper.scrape("https://example.com/page");
    expect(result.url).toBe("https://example.com/page");
    expect(result.markdown).toContain("Test Page");
    expect(result.metadata.statusCode).toBe(200);
    expect(result.metadata.links).toBeInstanceOf(Array);
  });
});
