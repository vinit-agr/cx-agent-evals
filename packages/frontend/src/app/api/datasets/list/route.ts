import { NextResponse } from "next/server";
import { listDatasets } from "rag-evaluation-system";

export async function GET() {
  if (!process.env.LANGSMITH_API_KEY) {
    return NextResponse.json(
      { error: "LANGSMITH_API_KEY environment variable is required" },
      { status: 500 },
    );
  }

  try {
    const datasets = await listDatasets();
    return NextResponse.json({
      datasets: datasets.map((d) => ({
        id: d.id,
        name: d.name,
        createdAt: d.createdAt.toISOString(),
        exampleCount: d.exampleCount,
        metadata: d.metadata,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list datasets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
