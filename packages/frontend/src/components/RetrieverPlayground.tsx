"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/lib/convex";
import type { Id } from "@convex/_generated/dataModel";

interface RetrieverInfo {
  _id: Id<"retrievers">;
  name: string;
  defaultK: number;
}

interface RetrieverPlaygroundProps {
  selectedRetrievers: RetrieverInfo[];
}

interface RetrievalResult {
  retrieverId: string;
  retrieverName: string;
  chunks: {
    chunkId: string;
    content: string;
    score: number;
    docId?: string;
  }[];
  latencyMs: number;
  error?: string;
}

export function RetrieverPlayground({
  selectedRetrievers,
}: RetrieverPlaygroundProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetrievalResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const retrieve = useAction(api.retrieverActions.retrieve);

  async function handleRetrieve() {
    if (!query.trim() || selectedRetrievers.length === 0 || isRunning) return;

    setIsRunning(true);
    setResults([]);

    const promises = selectedRetrievers.map(async (r) => {
      const start = performance.now();
      try {
        const chunks = await retrieve({
          retrieverId: r._id,
          query: query.trim(),
        });
        return {
          retrieverId: r._id,
          retrieverName: r.name,
          chunks: chunks as RetrievalResult["chunks"],
          latencyMs: Math.round(performance.now() - start),
        };
      } catch (err) {
        return {
          retrieverId: r._id,
          retrieverName: r.name,
          chunks: [],
          latencyMs: Math.round(performance.now() - start),
          error: err instanceof Error ? err.message : "Retrieval failed",
        };
      }
    });

    const all = await Promise.all(promises);
    setResults(all);
    setIsRunning(false);
  }

  if (selectedRetrievers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-dim text-sm">
          Select one or more ready retrievers above to test queries
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRetrieve()}
          placeholder="Enter a query to test..."
          className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:border-accent/50 focus:outline-none transition-colors"
        />
        <button
          onClick={handleRetrieve}
          disabled={!query.trim() || isRunning}
          className="px-4 py-2 rounded border text-xs font-semibold uppercase tracking-wider
                     transition-all cursor-pointer
                     bg-accent/10 border-accent/30 text-accent hover:bg-accent/20
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              Retrieving...
            </div>
          ) : (
            "Retrieve"
          )}
        </button>
      </div>

      <div className="text-[11px] text-text-dim">
        Testing: {selectedRetrievers.map((r) => r.name).join(", ")}
      </div>

      {results.length > 0 && (
        <div className={`grid gap-4 ${
          results.length === 1
            ? "grid-cols-1"
            : results.length === 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
        }`}>
          {results.map((result) => (
            <div
              key={result.retrieverId}
              className="border border-border rounded-lg overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-border bg-bg-elevated flex items-center justify-between">
                <span className="text-xs text-text font-medium truncate">
                  {result.retrieverName}
                </span>
                <span className="text-[10px] text-text-dim flex-shrink-0 ml-2">
                  {result.latencyMs}ms
                </span>
              </div>

              {result.error ? (
                <div className="p-3 text-sm text-red-400">{result.error}</div>
              ) : result.chunks.length === 0 ? (
                <div className="p-3 text-sm text-text-dim">No results</div>
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
                  {result.chunks.map((chunk, i) => (
                    <div key={chunk.chunkId ?? i} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-text-dim">
                          #{i + 1}
                        </span>
                        <span className="text-[10px] text-accent font-mono">
                          {chunk.score.toFixed(4)}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed line-clamp-4">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
