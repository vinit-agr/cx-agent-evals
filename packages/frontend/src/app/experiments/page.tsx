"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";

interface DatasetInfo {
  id: string;
  name: string;
  createdAt: string;
  exampleCount: number;
  metadata?: {
    folderPath?: string;
    strategy?: string;
  };
}

interface ExperimentInfo {
  id: string;
  name: string;
  createdAt: string;
  url: string;
  scores?: Record<string, number>;
}

interface ApiKeys {
  langsmith: boolean;
  openai: boolean;
  cohere: boolean;
}

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
    type: "in-memory";
  };
  reranker?: {
    type: "cohere";
    model?: string;
  };
}

type ExperimentStatus = "idle" | "running" | "complete" | "error";

export default function ExperimentsPage() {
  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);

  // Dataset selection
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<DatasetInfo | null>(null);
  const [corpusPath, setCorpusPath] = useState("");

  // Retriever config
  const [config, setConfig] = useState<RetrieverConfig>({
    chunker: { type: "recursive", chunkSize: 512, chunkOverlap: 50 },
    embedder: { type: "openai", model: "text-embedding-3-small" },
    vectorStore: { type: "in-memory" },
  });
  const [useReranker, setUseReranker] = useState(false);
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

  // Experiment status
  const [status, setStatus] = useState<ExperimentStatus>("idle");
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completedScores, setCompletedScores] = useState<Record<string, number> | null>(null);

  // Experiments list
  const [experiments, setExperiments] = useState<ExperimentInfo[]>([]);
  const [compareUrl, setCompareUrl] = useState<string | null>(null);
  const [loadingExperiments, setLoadingExperiments] = useState(false);

  // Generate experiment name from config
  useEffect(() => {
    if (nameEdited) return;

    const parts = [
      `recursive-${config.chunker.chunkSize}-${config.chunker.chunkOverlap}`,
      config.embedder.model.replace("text-embedding-", "").replace("-", ""),
      `k${k}`,
    ];
    if (useReranker) {
      parts.push("cohere");
    }
    setExperimentName(parts.join("-"));
  }, [config, k, useReranker, nameEdited]);

  // Fetch API keys on mount
  useEffect(() => {
    fetch("/api/env/check")
      .then((res) => res.json())
      .then((data) => setApiKeys(data.keys))
      .catch(() => setApiKeys({ langsmith: false, openai: false, cohere: false }));
  }, []);

  // Fetch datasets on mount
  useEffect(() => {
    setLoadingDatasets(true);
    fetch("/api/datasets/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.datasets) {
          setDatasets(data.datasets);
        }
      })
      .catch(() => setDatasets([]))
      .finally(() => setLoadingDatasets(false));
  }, []);

  // Update corpus path when dataset changes
  useEffect(() => {
    if (selectedDataset?.metadata?.folderPath) {
      setCorpusPath(selectedDataset.metadata.folderPath);
    } else {
      setCorpusPath("");
    }
  }, [selectedDataset]);

  // Fetch experiments when dataset changes
  useEffect(() => {
    if (!selectedDataset) {
      setExperiments([]);
      setCompareUrl(null);
      return;
    }

    setLoadingExperiments(true);
    fetch(`/api/experiments/list?datasetId=${selectedDataset.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.experiments) {
          setExperiments(data.experiments);
          setCompareUrl(data.compareUrl);
        }
      })
      .catch(() => {
        setExperiments([]);
        setCompareUrl(null);
      })
      .finally(() => setLoadingExperiments(false));
  }, [selectedDataset]);

  const handleRunExperiment = useCallback(async () => {
    if (!selectedDataset || !corpusPath || status === "running") return;

    setStatus("running");
    setPhase("Starting...");
    setError(null);
    setCompletedScores(null);

    const selectedMetrics = Object.entries(metrics)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const body = {
      datasetId: selectedDataset.id,
      datasetName: selectedDataset.name,
      corpusPath,
      k,
      metrics: selectedMetrics,
      experimentName,
      retrieverConfig: useReranker
        ? { ...config, reranker: { type: "cohere" as const } }
        : config,
    };

    try {
      const res = await fetch("/api/experiments/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start experiment");
        setStatus("error");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setStatus("error");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data:\s*(.+)$/m);
          if (!match) continue;

          try {
            const event = JSON.parse(match[1]);

            if (event.type === "phase") {
              setPhase(event.message);
            } else if (event.type === "complete") {
              setStatus("complete");
              setPhase("");
              // Refresh experiments list
              fetch(`/api/experiments/list?datasetId=${selectedDataset.id}`)
                .then((res) => res.json())
                .then((data) => {
                  if (data.experiments) {
                    setExperiments(data.experiments);
                    setCompareUrl(data.compareUrl);
                    // Get scores from the newest experiment
                    const newest = data.experiments[0];
                    if (newest?.scores) {
                      setCompletedScores(newest.scores);
                    }
                  }
                });
            } else if (event.type === "error") {
              setError(event.error);
              setStatus("error");
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch {
      setError("Connection lost — check server logs");
      setStatus("error");
    }
  }, [selectedDataset, corpusPath, k, metrics, experimentName, config, useReranker, status]);

  const canRun = selectedDataset && corpusPath && status !== "running" && apiKeys?.openai;

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
                  {loadingDatasets ? (
                    <div className="flex items-center gap-2 text-text-dim text-sm">
                      <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      Loading datasets...
                    </div>
                  ) : (
                    <select
                      value={selectedDataset?.id || ""}
                      onChange={(e) => {
                        const ds = datasets.find((d) => d.id === e.target.value);
                        setSelectedDataset(ds || null);
                      }}
                      className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none"
                    >
                      <option value="">Select a dataset...</option>
                      {datasets.map((ds) => (
                        <option key={ds.id} value={ds.id}>
                          {ds.name} ({ds.exampleCount} examples)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Corpus Info */}
                {selectedDataset && (
                  <div className="border border-border rounded bg-bg-elevated p-3 space-y-2">
                    <div className="text-xs text-text-dim uppercase tracking-wide">
                      Corpus
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted text-sm">📁</span>
                      {selectedDataset.metadata?.folderPath ? (
                        <span className="text-sm text-text truncate">
                          {selectedDataset.metadata.folderPath}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={corpusPath}
                          onChange={(e) => setCorpusPath(e.target.value)}
                          placeholder="Enter corpus folder path..."
                          className="flex-1 bg-bg border border-border rounded px-2 py-1 text-sm text-text focus:border-accent outline-none"
                        />
                      )}
                    </div>
                    {selectedDataset.metadata?.strategy && (
                      <div className="text-xs text-text-dim">
                        Strategy: {selectedDataset.metadata.strategy}
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
                  {apiKeys && (
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        apiKeys.openai ? "text-accent" : "text-amber-400"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          apiKeys.openai
                            ? "bg-accent"
                            : "bg-amber-400 animate-pulse"
                        }`}
                      />
                      {apiKeys.openai
                        ? "OPENAI_API_KEY configured"
                        : "OPENAI_API_KEY missing"}
                    </div>
                  )}
                </div>

                {/* Vector Store */}
                <div className="border border-border rounded bg-bg-elevated p-3 space-y-3">
                  <div className="text-xs text-text-dim uppercase tracking-wide">
                    Vector Store
                  </div>
                  <select
                    value="in-memory"
                    disabled
                    className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text-muted"
                  >
                    <option value="in-memory">In-Memory</option>
                  </select>
                </div>

                {/* Reranker */}
                <div className="border border-border rounded bg-bg-elevated p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-text-dim uppercase tracking-wide">
                      Reranker
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useReranker}
                        onChange={(e) => setUseReranker(e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-bg text-accent focus:ring-accent/50"
                      />
                      <span className="text-xs text-text-muted">Use Cohere</span>
                    </label>
                  </div>
                  {useReranker && apiKeys && (
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        apiKeys.cohere ? "text-accent" : "text-amber-400"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          apiKeys.cohere
                            ? "bg-accent"
                            : "bg-amber-400 animate-pulse"
                        }`}
                      />
                      {apiKeys.cohere
                        ? "COHERE_API_KEY configured"
                        : "COHERE_API_KEY missing"}
                    </div>
                  )}
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
                          {value.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {status === "error" && error && (
                <div className="mt-3">
                  <p className="text-red-400 text-sm">{error}</p>
                  <button
                    onClick={() => setStatus("idle")}
                    className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
                  >
                    Dismiss
                  </button>
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
            {selectedDataset && (
              <div className="border border-border rounded-lg bg-bg-elevated">
                <div className="px-4 py-2 border-b border-border text-xs text-text-dim uppercase tracking-wider">
                  Recent Experiments
                </div>
                <div className="p-4 space-y-3">
                  {loadingExperiments ? (
                    <div className="flex items-center gap-2 text-text-dim text-sm">
                      <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      Loading...
                    </div>
                  ) : experiments.length === 0 ? (
                    <p className="text-text-dim text-sm">
                      No experiments yet for this dataset
                    </p>
                  ) : (
                    <>
                      {experiments.map((exp) => (
                        <div
                          key={exp.id}
                          className="border border-border rounded-lg p-4 hover:border-border/80 transition-colors"
                        >
                          <div className="font-medium text-text">{exp.name}</div>
                          {exp.scores && Object.keys(exp.scores).length > 0 && (
                            <div className="flex gap-4 mt-2 text-sm">
                              {Object.entries(exp.scores)
                                .slice(0, 2)
                                .map(([key, value]) => (
                                  <span key={key} className="text-text-muted">
                                    {key}:{" "}
                                    <span className="text-accent">
                                      {value.toFixed(2)}
                                    </span>
                                  </span>
                                ))}
                            </div>
                          )}
                          <a
                            href={exp.url}
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
                        </div>
                      ))}

                      {experiments.length >= 2 && compareUrl && (
                        <a
                          href={compareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-2 text-sm text-text-muted hover:text-accent border border-border rounded-lg hover:border-accent/50 transition-colors"
                        >
                          Compare All in LangSmith
                          <svg
                            className="w-4 h-4"
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
                    </>
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
