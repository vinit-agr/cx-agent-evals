"use client";

import { useState, useCallback } from "react";
import {
  GeneratedQuestion,
  StrategyType,
  DocumentInfo,
  Dimension,
} from "@/lib/types";

type ModalState =
  | { phase: "confirm" }
  | { phase: "uploading"; uploaded: number; total: number; failed: number }
  | {
      phase: "complete";
      datasetName: string;
      datasetUrl: string;
      uploaded: number;
      failed: number;
    }
  | { phase: "error"; error: string };

const STRATEGY_SHORT: Record<StrategyType, string> = {
  simple: "simple",
  "dimension-driven": "dim-driven",
  "real-world-grounded": "rwg",
};

function generateDatasetName(
  strategy: StrategyType,
  folderPath: string,
  questionCount: number,
): string {
  const corpusName =
    folderPath.split("/").filter(Boolean).pop() ?? "corpus";
  const date = new Date().toISOString().slice(0, 10);
  return `${STRATEGY_SHORT[strategy]}_${corpusName}_${questionCount}q_${date}`;
}

interface UploadDatasetModalProps {
  questions: GeneratedQuestion[];
  strategy: StrategyType;
  folderPath: string;
  documents: DocumentInfo[];
  dimensions?: Dimension[];
  questionsPerDoc?: number;
  totalQuestions?: number;
  onClose: () => void;
}

export function UploadDatasetModal({
  questions,
  strategy,
  folderPath,
  documents,
  dimensions,
  questionsPerDoc,
  totalQuestions,
  onClose,
}: UploadDatasetModalProps) {
  const [datasetName, setDatasetName] = useState(() =>
    generateDatasetName(strategy, folderPath, questions.length),
  );
  const [state, setState] = useState<ModalState>({ phase: "confirm" });

  const corpusName =
    folderPath.split("/").filter(Boolean).pop() ?? "corpus";

  const handleUpload = useCallback(async () => {
    if (!datasetName.trim()) return;

    setState({
      phase: "uploading",
      uploaded: 0,
      total: questions.length,
      failed: 0,
    });

    try {
      const res = await fetch("/api/upload-dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions,
          datasetName: datasetName.trim(),
          metadata: {
            strategy,
            folderPath,
            questionsPerDoc,
            dimensions,
            totalQuestions,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setState({ phase: "error", error: data.error || "Upload failed" });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setState({ phase: "error", error: "No response stream" });
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

            if (event.type === "progress") {
              setState({
                phase: "uploading",
                uploaded: event.uploaded,
                total: event.total,
                failed: event.failed,
              });
            } else if (event.type === "done") {
              setState({
                phase: "complete",
                datasetName: event.datasetName,
                datasetUrl: event.datasetUrl,
                uploaded: event.uploaded,
                failed: event.failed,
              });
            } else if (event.type === "error") {
              setState({ phase: "error", error: event.error });
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch {
      setState({ phase: "error", error: "Connection lost — check server logs" });
    }
  }, [
    questions,
    datasetName,
    strategy,
    folderPath,
    questionsPerDoc,
    dimensions,
    totalQuestions,
  ]);

  const canClose = state.phase !== "uploading";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={canClose ? onClose : undefined}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md bg-bg-elevated border border-border rounded-lg shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">
            Upload to LangSmith
          </h2>
          {canClose && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text text-xs cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {state.phase === "confirm" && (
            <>
              <div>
                <label className="text-[11px] text-text-dim uppercase tracking-wider block mb-1.5">
                  Dataset name
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg-surface border border-border rounded text-text focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[11px] text-text-dim uppercase tracking-wider block mb-1.5">
                  Summary
                </label>
                <div className="text-xs text-text-muted space-y-1">
                  <p>
                    {questions.length} question{questions.length !== 1 ? "s" : ""}{" "}
                    from {documents.length} document{documents.length !== 1 ? "s" : ""}
                  </p>
                  <p>Strategy: {strategy}</p>
                  <p>Corpus: {corpusName}</p>
                  {dimensions && dimensions.length > 0 && (
                    <p>
                      {dimensions.length} dimension{dimensions.length !== 1 ? "s" : ""} configured
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {state.phase === "uploading" && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-text-muted">
                    Uploading examples...
                  </span>
                  <span className="text-text">
                    {state.uploaded}/{state.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{
                      width: `${state.total > 0 ? (state.uploaded / state.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              {state.failed > 0 && (
                <p className="text-[11px] text-error">
                  {state.failed} failed
                </p>
              )}
            </div>
          )}

          {state.phase === "complete" && (
            <div className="space-y-3">
              <div className="text-xs text-text-muted space-y-1">
                <p>
                  {state.uploaded} uploaded
                  {state.failed > 0 && (
                    <span className="text-error">, {state.failed} failed</span>
                  )}
                </p>
                <p className="text-text-dim">{state.datasetName}</p>
              </div>
              <a
                href={state.datasetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                View in LangSmith
                <span className="text-[10px]">&nearr;</span>
              </a>
            </div>
          )}

          {state.phase === "error" && (
            <div className="p-3 rounded border border-error/30 bg-error/5">
              <p className="text-xs text-error">{state.error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          {state.phase === "confirm" && (
            <>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!datasetName.trim()}
                className="px-4 py-1.5 text-xs font-medium bg-accent text-bg rounded hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Upload
              </button>
            </>
          )}

          {state.phase === "complete" && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium bg-accent text-bg rounded hover:bg-accent/90 transition-colors cursor-pointer"
            >
              Done
            </button>
          )}

          {state.phase === "error" && (
            <>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => setState({ phase: "confirm" })}
                className="px-4 py-1.5 text-xs font-medium bg-accent text-bg rounded hover:bg-accent/90 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
