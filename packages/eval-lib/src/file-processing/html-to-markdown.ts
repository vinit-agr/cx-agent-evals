import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

export interface HtmlToMarkdownOptions {
  onlyMainContent?: boolean;
  baseUrl?: string;
}

export interface HtmlToMarkdownResult {
  content: string;
  title: string;
  links: string[];
}

export async function htmlToMarkdown(
  html: string,
  options?: HtmlToMarkdownOptions,
): Promise<HtmlToMarkdownResult> {
  const onlyMainContent = options?.onlyMainContent ?? true;
  const baseUrl = options?.baseUrl;
  const dom = new JSDOM(html, { url: baseUrl || "https://placeholder.local" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = dom.window.document as any;

  const links = extractLinks(doc, baseUrl);
  let title: string = doc.querySelector("title")?.textContent?.trim() || "";
  // Extract h1 before Readability mutates the DOM
  const h1Title: string = doc.querySelector("h1")?.textContent?.trim() || "";
  let htmlForConversion: string;

  if (onlyMainContent) {
    const reader = new Readability(doc);
    const article = reader.parse();
    if (article) {
      htmlForConversion = (article.content as string) || "";
      title = (article.title as string) || title;
    } else {
      htmlForConversion = doc.body?.innerHTML || html;
    }
  } else {
    htmlForConversion = doc.body?.innerHTML || html;
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  let markdown = turndown.turndown(htmlForConversion);
  markdown = cleanupMarkdown(markdown);

  // Title priority: <title> tag > Readability article.title > original h1 > first markdown heading
  if (!title) {
    title = h1Title;
  }
  if (!title) {
    const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) title = headingMatch[1];
  }

  return { content: markdown, title, links };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractLinks(doc: any, baseUrl?: string): string[] {
  const anchors = doc.querySelectorAll("a[href]");
  const links: string[] = [];
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:"))
      continue;
    try {
      const resolved = baseUrl ? new URL(href, baseUrl).href : href;
      links.push(resolved);
    } catch {
      /* skip malformed URLs */
    }
  }
  return [...new Set(links)];
}

function cleanupMarkdown(md: string): string {
  return md
    .replace(/<!-- .*? -->/gs, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}
