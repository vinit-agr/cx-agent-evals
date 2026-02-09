import { getLangSmithClient } from "./get-client.js";

export interface DatasetInfo {
  id: string;
  name: string;
  createdAt: Date;
  exampleCount: number;
  metadata?: Record<string, unknown>;
}

export interface ExperimentInfo {
  id: string;
  name: string;
  createdAt: Date;
  url: string;
  scores?: Record<string, number>;
}

/**
 * List all datasets from LangSmith, ordered by creation date (most recent first).
 */
export async function listDatasets(): Promise<DatasetInfo[]> {
  const client = await getLangSmithClient();
  const datasets: DatasetInfo[] = [];

  for await (const dataset of client.listDatasets()) {
    datasets.push({
      id: dataset.id,
      name: dataset.name,
      createdAt: new Date(dataset.created_at),
      exampleCount: dataset.example_count ?? 0,
      metadata: dataset.metadata as Record<string, unknown> | undefined,
    });
  }

  // Sort by creation date descending (most recent first)
  datasets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return datasets;
}

/**
 * List all experiments (projects) associated with a dataset.
 */
export async function listExperiments(
  datasetId: string,
): Promise<ExperimentInfo[]> {
  const client = await getLangSmithClient();
  const experiments: ExperimentInfo[] = [];
  const hostUrl = client.getHostUrl();

  for await (const project of client.listProjects({
    referenceDatasetId: datasetId,
  })) {
    // Extract scores from feedback stats if available
    const scores: Record<string, number> = {};
    if (project.feedback_stats) {
      for (const [key, stats] of Object.entries(project.feedback_stats)) {
        if (
          stats &&
          typeof stats === "object" &&
          "avg" in stats &&
          typeof stats.avg === "number"
        ) {
          scores[key] = stats.avg;
        }
      }
    }

    experiments.push({
      id: project.id,
      name: project.name,
      createdAt: new Date(project.start_time),
      url: `${hostUrl}/o/${project.tenant_id}/projects/p/${project.id}`,
      scores: Object.keys(scores).length > 0 ? scores : undefined,
    });
  }

  // Sort by creation date descending (most recent first)
  experiments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return experiments;
}

/**
 * Get a LangSmith URL for comparing all experiments on a dataset.
 */
export async function getCompareUrl(datasetId: string): Promise<string> {
  const client = await getLangSmithClient();
  const hostUrl = client.getHostUrl();

  // Get tenant ID from an existing project or use a fallback
  let tenantId = "";
  for await (const project of client.listProjects({
    referenceDatasetId: datasetId,
  })) {
    tenantId = project.tenant_id;
    break;
  }

  if (tenantId) {
    return `${hostUrl}/o/${tenantId}/datasets/${datasetId}/compare`;
  }

  // Fallback: direct dataset URL if no projects found
  return `${hostUrl}/datasets/${datasetId}`;
}
