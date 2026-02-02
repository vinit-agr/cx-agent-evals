"use client";

import { useState, useEffect, useCallback } from "react";
import { DocumentInfo } from "@/lib/types";
import { FolderBrowser } from "./FolderBrowser";

const STORAGE_KEY = "rag-eval-last-folder";

export function CorpusLoader({
  documents,
  onLoaded,
}: {
  documents: DocumentInfo[];
  onLoaded: (docs: DocumentInfo[], folderPath: string) => void;
}) {
  const [folderPath, setFolderPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setFolderPath(saved);
  }, []);

  const loadCorpus = useCallback(
    async (path: string) => {
      if (!path.trim()) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/corpus/load", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderPath: path.trim() }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load corpus");
          return;
        }

        localStorage.setItem(STORAGE_KEY, path.trim());
        onLoaded(data.documents, path.trim());
      } catch {
        setError("Network error — is the server running?");
      } finally {
        setLoading(false);
      }
    },
    [onLoaded],
  );

  function handleLoad() {
    loadCorpus(folderPath);
  }

  function handleBrowseSelect(path: string) {
    setFolderPath(path);
    loadCorpus(path);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <label className="block text-xs text-text-dim uppercase tracking-wider mb-2">
          Corpus folder path
        </label>
        <div className="space-y-2">
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            placeholder="/path/to/your/markdown/docs"
            className="w-full bg-bg-surface border border-border rounded px-3 py-2 text-sm text-text
                       placeholder:text-text-dim/40 focus:outline-none focus:border-accent/50
                       transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setBrowserOpen(true)}
              className="flex-1 px-3 py-2 bg-bg-surface border border-border rounded text-text-muted text-xs
                         hover:border-accent/40 hover:text-accent transition-all cursor-pointer"
              title="Browse folders"
            >
              Browse
            </button>
            <button
              onClick={handleLoad}
              disabled={loading || !folderPath.trim()}
              className="flex-1 px-4 py-2 bg-accent/10 border border-accent/30 rounded text-accent text-xs font-medium
                         hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all
                         cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
                  Loading
                </span>
              ) : (
                "Load"
              )}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-xs text-error animate-fade-in">{error}</p>
        )}
      </div>

      {documents.length > 0 && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-text-dim uppercase tracking-wider">
              Documents loaded
            </span>
            <span className="text-xs text-text-muted">
              {documents.length} file{documents.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="border border-border rounded divide-y divide-border max-h-64 overflow-y-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="px-3 py-2.5 hover:bg-bg-hover transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-accent">
                    {doc.id}
                  </span>
                  <span className="text-[10px] text-text-dim">
                    {doc.contentLength.toLocaleString()} chars
                  </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
                  {doc.content.slice(0, 200)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <FolderBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={handleBrowseSelect}
        initialPath={folderPath || undefined}
      />
    </div>
  );
}
