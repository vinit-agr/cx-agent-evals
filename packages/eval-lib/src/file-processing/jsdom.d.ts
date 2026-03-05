declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string });
    window: {
      document: {
        querySelector(selector: string): { textContent?: string | null; innerHTML?: string } | null;
        querySelectorAll(selector: string): Array<{ getAttribute(name: string): string | null }>;
        body: { innerHTML: string } | null;
      };
    };
  }
}
