export async function getLangSmithClient(): Promise<any> {
  try {
    const { Client } = await import("langsmith");
    return new Client();
  } catch {
    throw new Error(
      "langsmith package required for LangSmith integration. " +
        "Install with: pnpm add langsmith",
    );
  }
}
