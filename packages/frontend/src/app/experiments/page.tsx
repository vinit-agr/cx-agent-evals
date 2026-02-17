"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, useOrganization, OrganizationSwitcher } from "@clerk/nextjs";
import { api } from "@/lib/convex";
import { Id } from "@convex/_generated/dataModel";
import { Header } from "@/components/Header";

interface RetrieverConfig {
  chunker: {
    type: "recursive";
    chunkSize: number;
    chunkOverlap: number;
  };
  embedder: {
    type: "openai";
    model: string;
  };
  vectorStore: {
    type: "convex";
  };
  reranker?: {
    type: "cohere";
    model?: string;
  };
}

function OrgRequired({ children }: { children: React.ReactNode }) {
  const { organization, isLoaded } = useOrganization();

  if (!isLoaded) {
    return (
      <div className="flex flex-col h-screen">
        <Header mode="experiments" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col h-screen">
        <Header mode="experiments" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-text-muted">Select or create an organization to continue</p>
            <OrganizationSwitcher
              afterSelectOrganizationUrl="/experiments"
              afterCreateOrganizationUrl="/experiments"
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                },
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function ExperimentsPageContent() {
  // Dataset selection
  const datasets = useQuery(api.datasets.list);
  const [selectedDatasetId, setSelectedDatasetId] = useState<Id<"datasets"> | null>(null);

  // Experiments for selected dataset (reactive)
  const experiments = useQuery(
    api.experiments.byDataset,
    selectedDatasetId ? { datasetId: selectedDatasetId } : "skip",
  );

  // Selected dataset details
  const selectedDataset = useQuery(
    api.datasets.get,
    selectedDatasetId ? { id: selectedDatasetId } : "skip",
  );

  // Experiment running state
  const [jobId, setJobId] = useState<Id<"jobs"> | null>(null);
  const [experimentId, setExperimentId] = useState<Id<"experiments"> | null>(null);

  // Job status (reactive)
  const job = useQuery(api.jobs.get, jobId ? { id: jobId } : "skip");
  const currentExperiment = useQuery(
    api.experiments.get,
    experimentId ? { id: experimentId } : "skip",
  );

  const startExperiment = useMutation(api.experiments.start);

  // Retriever config
  const [config, setConfig] = useState<RetrieverConfig>({
    chunker: { type: "recursive", chunkSize: 512, chunkOverlap: 50 },
    embedder: { type: "openai", model: "text-embedding-3-small" },
    vectorStore: { type: "convex" },
  });
  const [k, setK] = useState(5);

  // Metrics
  const [metrics, setMetrics] = useState({
    recall: true,
    precision: true,
    iou: true,
    f1: true,
  });

  // Experiment name
  const [experimentName, setExperimentName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate experiment name from config
  useEffect(() => {
    if (nameEdited) return;

    const parts = [
      `recursive-${config.chunker.chunkSize}-${config.chunker.chunkOverlap}`,
      config.embedder.model.replace("text-embedding-", "").replace("-", ""),
      `k${k}`,
    ];
    setExperimentName(parts.join("-"));
  }, [config, k, nameEdited]);

  // Derive status from job
  const status = !jobId
    ? "idle"
    : job?.status === "completed"
      ? "complete"
      : job?.status === "failed"
        ? "error"
        : "running";

  const phase = job?.progress?.message ?? (job?.phase ? `${job.phase}...` : "Starting...");
  const completedScores = currentExperiment?.scores as Record<string, number> | undefined;

  async function handleRunExperiment() {
    if (!selectedDatasetId || status === "running") return;

    setError(null);

    const selectedMetrics = Object.entries(metrics)
      .filter(([, v]) => v)
      .map(([k]) => k);

    try {
      const result = await startExperiment({
        datasetId: selectedDatasetId,
        name: experimentName,
        retrieverConfig: config,
        k,
        metricNames: selectedMetrics,
      });

      setJobId(result.jobId);
      setExperimentId(result.experimentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start experiment");
    }
  }

  const canRun = selectedDatasetId && status !== "running";

  return (
    <div className="flex flex-col h-screen">
      <Header mode="experiments" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Configuration Panel */}
        <div className="w-[420px] flex-shrink-0 border-r border-border bg-bg-elevated overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="border border-border rounded-lg bg-bg">
              <div className="px-4 py-2 border-b border-border text-xs text-text-dim uppercase tracking-wider">
                Configuration
              </div>
              <div className="p-4 space-y-4">
                {/* Dataset Picker */}
                <div className="space-y-2">
                  <label className="text-xs text-text-muted uppercase tracking-wide">
                    Dataset
                  </label>
                  {datasets === undefined ? (
                    <div className="flex items-center gap-2 text-text-dim text-sm">
                      <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      Loading datasets...
                    </div>
                  ) : (
                    <select
                      value={selectedDatasetId ?? ""}
                      onChange={(e) => {
                        setSelectedDatasetId(
                          e.target.value ? (e.target.value as Id<"datasets">) : null,
                        );
                      }}
                      className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none"
                    >
                      <option value="">Select a dataset...</option>
                      {datasets.map((ds) => (
                        <option key={ds._id} value={ds._id}>
                          {ds.name} ({ds.questionCount} questions)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Dataset Info */}
                {selectedDataset && (
                  <div className="border border-border rounded bg-bg-elevated p-3 space-y-2">
                    <div className="text-xs text-text-dim uppercase tracking-wide">
                      Dataset Info
                    </div>
                    <div className="text-sm text-text-muted">
                      Strategy: {selectedDataset.strategy}
                    </div>
                    <div className="text-sm text-text-muted">
                      Questions: {selectedDataset.questionCount}
                    </div>
                    {selectedDataset.langsmithSyncStatus && (
                      <div className="text-xs text-text-dim">
                        LangSmith: {selectedDataset.langsmithSyncStatus}
                      </div>
                    )}
                  </div>
                )}

                {/* Chunker Config */}
                <div className="border border-border rounded bg-bg-elevated p-3 space-y-3">
                  <div className="text-xs text-text-dim uppercase tracking-wide">
                    Chunker
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-text-muted">Size</label>
                      <input
                        type="number"
                        value={config.chunker.chunkSize}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            chunker: {
                              ...config.chunker,
                              chunkSize: parseInt(e.target.value) || 512,
                            },
                          })
                        }
                        className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-text-muted">Overlap</label>
                      <input
                        type="number"
                        value={config.chunker.chunkOverlap}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            chunker: {
                              ...config.chunker,
                              chunkOverlap: parseInt(e.target.value) || 50,
                            },
                          })
                        }
                        className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text focus:border-accent outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Embedder Config */}
                <div className="border border-border rounded bg-bg-elevated p-3 space-y-3">
                  <div className="text-xs text-text-dim uppercase tracking-wide">
                    Embedder
                  </div>
                  <select
                    value={config.embedder.model}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        embedder: { ...config.embedder, model: e.target.value },
                      })
                    }
                    className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text focus:border-accent outline-none"
                  >
                    <option value="text-embedding-3-small">
                      text-embedding-3-small
                    </option>
                    <option value="text-embedding-3-large">
                      text-embedding-3-large
                    </option>
                    <option value="text-embedding-ada-002">
                      text-embedding-ada-002
                    </option>
                  </select>
                </div>

                {/* K Parameter */}
                <div className="border border-border rounded bg-bg-elevated p-3 space-y-3">
                  <div className="text-xs text-text-dim uppercase tracking-wide">
                    Parameters
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-xs text-text-muted">
                      k (top results)
                    </label>
                    <input
                      type="number"
                      value={k}
                      onChange={(e) => setK(parseInt(e.target.value) || 5)}
                      min={1}
                      max={100}
                      className="w-20 bg-bg border border-border rounded px-2 py-1 text-sm text-text focus:border-accent outline-none"
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="border border-border rounded bg-bg-elevated p-3 space-y-3">
                  <div className="text-xs text-text-dim uppercase tracking-wide">
                    Metrics
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(["recall", "precision", "iou", "f1"] as const).map(
                      (metric) => (
                        <label
                          key={metric}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={metrics[metric]}
                            onChange={(e) =>
                              setMetrics({
                                ...metrics,
                                [metric]: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded border-border bg-bg text-accent focus:ring-accent/50"
                          />
                          <span className="text-sm text-text-muted capitalize">
                            {metric === "iou" ? "IoU" : metric}
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                {/* Experiment Name */}
                <div className="border border-border rounded bg-bg-elevated p-3 space-y-3">
                  <div className="text-xs text-text-dim uppercase tracking-wide">
                    Experiment Name
                  </div>
                  <input
                    type="text"
                    value={experimentName}
                    onChange={(e) => {
                      setExperimentName(e.target.value);
                      setNameEdited(true);
                    }}
                    className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text focus:border-accent outline-none"
                  />
                  <div className="text-xs text-text-dim">
                    {nameEdited ? "Custom name" : "Auto-generated from config"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Console Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg">
          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Status Panel */}
            <div
              className={`border rounded-lg p-4 ${
                status === "running"
                  ? "border-accent/30 bg-accent/5"
                  : status === "complete"
                    ? "border-accent/30 bg-accent/5"
                    : status === "error"
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-border bg-bg-elevated"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === "running"
                      ? "bg-accent animate-pulse"
                      : status === "complete"
                        ? "bg-accent"
                        : status === "error"
                          ? "bg-red-500"
                          : "bg-text-dim"
                  }`}
                />
                <span
                  className={`uppercase text-sm tracking-wide ${
                    status === "running"
                      ? "text-accent"
                      : status === "complete"
                        ? "text-accent"
                        : status === "error"
                          ? "text-red-500"
                          : "text-text-dim"
                  }`}
                >
                  {status === "idle"
                    ? "Idle"
                    : status === "running"
                      ? "Running"
                      : status === "complete"
                        ? "Complete"
                        : "Error"}
                </span>
              </div>

              {status === "idle" && (
                <p className="text-text-muted text-sm mt-2">
                  Configure your experiment and click Run
                </p>
              )}

              {status === "running" && (
                <div className="mt-3">
                  <p className="text-text text-sm">{experimentName}</p>
                  <p className="text-text-muted text-sm mt-1">{phase}</p>
                </div>
              )}

              {status === "complete" && completedScores && (
                <div className="mt-3">
                  <p className="text-text text-sm font-medium mb-2">
                    {experimentName}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(completedScores).map(([key, value]) => (
                      <div key={key} className="bg-bg rounded p-2">
                        <span className="text-text-dim text-xs capitalize">
                          {key}
                        </span>
                        <span className="block text-accent text-lg font-medium">
                          {(value as number).toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="mt-3">
                  <p className="text-red-400 text-sm">
                    {error || job?.error || "Unknown error"}
                  </p>
                </div>
              )}
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunExperiment}
              disabled={!canRun}
              className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                canRun
                  ? "bg-accent hover:bg-accent/90 text-bg-elevated cursor-pointer"
                  : "bg-border text-text-dim cursor-not-allowed"
              }`}
            >
              {status === "running" ? (
                <>
                  <div className="w-4 h-4 border-2 border-bg-elevated/30 border-t-bg-elevated rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <span>Run Experiment</span>
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </>
              )}
            </button>

            {/* Experiments List */}
            {selectedDatasetId && (
              <div className="border border-border rounded-lg bg-bg-elevated">
                <div className="px-4 py-2 border-b border-border text-xs text-text-dim uppercase tracking-wider">
                  Recent Experiments
                </div>
                <div className="p-4 space-y-3">
                  {experiments === undefined ? (
                    <div className="flex items-center gap-2 text-text-dim text-sm">
                      <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      Loading...
                    </div>
                  ) : experiments.length === 0 ? (
                    <p className="text-text-dim text-sm">
                      No experiments yet for this dataset
                    </p>
                  ) : (
                    experiments.map((exp) => (
                      <div
                        key={exp._id}
                        className="border border-border rounded-lg p-4 hover:border-border/80 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-text">{exp.name}</div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              exp.status === "completed"
                                ? "bg-accent/10 text-accent"
                                : exp.status === "failed"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-text-dim/10 text-text-dim"
                            }`}
                          >
                            {exp.status}
                          </span>
                        </div>
                        {exp.scores &&
                          typeof exp.scores === "object" &&
                          Object.keys(exp.scores as Record<string, number>).length > 0 && (
                            <div className="flex gap-4 mt-2 text-sm">
                              {Object.entries(exp.scores as Record<string, number>)
                                .slice(0, 4)
                                .map(([key, value]) => (
                                  <span key={key} className="text-text-muted">
                                    {key}:{" "}
                                    <span className="text-accent">
                                      {value.toFixed(3)}
                                    </span>
                                  </span>
                                ))}
                            </div>
                          )}
                        {exp.langsmithUrl && (
                          <a
                            href={exp.langsmithUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-accent mt-3 transition-colors"
                          >
                            View in LangSmith
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExperimentsPage() {
  return (
    <>
      <AuthLoading>
        <div className="flex flex-col h-screen">
          <Header mode="experiments" />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col h-screen">
          <Header mode="experiments" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-text-muted">Sign in to run experiments</p>
              <SignInButton mode="modal">
                <button className="px-6 py-2 bg-accent text-bg-elevated rounded-lg hover:bg-accent/90 transition-colors font-medium">
                  Sign In
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <OrgRequired>
          <ExperimentsPageContent />
        </OrgRequired>
      </Authenticated>
    </>
  );
}
