import { NextRequest, NextResponse } from "next/server";
import { listExperiments, getCompareUrl } from "rag-evaluation-system";

export async function GET(request: NextRequest) {
  if (!process.env.LANGSMITH_API_KEY) {
    return NextResponse.json(
      { error: "LANGSMITH_API_KEY environment variable is required" },
      { status: 500 },
    );
  }

  const datasetId = request.nextUrl.searchParams.get("datasetId");
  if (!datasetId) {
    return NextResponse.json(
      { error: "datasetId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const [experiments, compareUrl] = await Promise.all([
      listExperiments(datasetId),
      getCompareUrl(datasetId),
    ]);

    return NextResponse.json({
      experiments: experiments.map((e) => ({
        id: e.id,
        name: e.name,
        createdAt: e.createdAt.toISOString(),
        url: e.url,
        scores: e.scores,
      })),
      compareUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list experiments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
