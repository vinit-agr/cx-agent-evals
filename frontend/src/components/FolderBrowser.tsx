"use client";

import { useState, useEffect, useCallback } from "react";

interface BrowseEntry {
  name: string;
  type: "directory" | "file";
  path: string;
}

interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  entries: BrowseEntry[];
}

export function FolderBrowser({
  open,
  onClose,
  onSelect,
  initialPath,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}) {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to browse");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      browse(initialPath || undefined);
    }
  }, [open, initialPath, browse]);

  if (!open) return null;

  const mdCount =
    result?.entries.filter((e) => e.type === "file").length ?? 0;

  // Breadcrumb segments from currentPath
  const pathSegments: { label: string; path: string }[] = [];
  if (result) {
    const parts = result.currentPath.split("/").filter(Boolean);
    let accumulated = "";
    for (const part of parts) {
      accumulated += "/" + part;
      pathSegments.push({ label: part, path: accumulated });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-bg-elevated border border-border rounded-lg shadow-2xl flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs text-text-dim uppercase tracking-wider">
            Select folder
          </span>
          <button
            onClick={onClose}
            className="text-xs text-text-dim hover:text-text transition-colors cursor-pointer"
          >
            close
          </button>
        </div>

        {/* Breadcrumb */}
        {result && (
          <div className="px-4 py-2 border-b border-border/50 flex items-center gap-1 overflow-x-auto text-[11px]">
            <button
              onClick={() => browse("/")}
              className="text-text-dim hover:text-accent transition-colors cursor-pointer shrink-0"
            >
              /
            </button>
            {pathSegments.map((seg, i) => (
              <span key={seg.path} className="flex items-center gap-1 shrink-0">
                <span className="text-text-dim">/</span>
                <button
                  onClick={() => browse(seg.path)}
                  className={`hover:text-accent transition-colors cursor-pointer ${
                    i === pathSegments.length - 1
                      ? "text-accent font-medium"
                      : "text-text-muted"
                  }`}
                >
                  {seg.label}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Entries */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
            </div>
          )}

          {error && (
            <div className="px-4 py-3">
              <p className="text-xs text-error">{error}</p>
            </div>
          )}

          {!loading && result && (
            <>
              {result.parentPath && (
                <button
                  onClick={() => browse(result.parentPath!)}
                  className="w-full text-left px-4 py-2 text-xs text-text-muted hover:bg-bg-hover
                             transition-colors cursor-pointer border-b border-border/30"
                >
                  <span className="text-text-dim mr-2">..</span>
                  <span className="text-text-dim">parent directory</span>
                </button>
              )}

              {result.entries.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-text-dim">
                  Empty directory
                </div>
              )}

              {result.entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => {
                    if (entry.type === "directory") browse(entry.path);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs border-b border-border/20
                             transition-colors
                             ${
                               entry.type === "directory"
                                 ? "hover:bg-bg-hover cursor-pointer"
                                 : "text-text-dim cursor-default"
                             }`}
                >
                  <span
                    className={`mr-2 ${entry.type === "directory" ? "text-accent" : "text-text-dim"}`}
                  >
                    {entry.type === "directory" ? "+" : " "}
                  </span>
                  <span
                    className={
                      entry.type === "directory"
                        ? "text-text"
                        : "text-text-muted"
                    }
                  >
                    {entry.name}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-text-dim">
            {mdCount > 0
              ? `${mdCount} .md file${mdCount !== 1 ? "s" : ""} in this folder`
              : "No .md files here"}
          </span>
          <button
            onClick={() => {
              if (result) {
                onSelect(result.currentPath);
                onClose();
              }
            }}
            disabled={!result}
            className="px-3 py-1.5 bg-accent/10 border border-accent/30 rounded text-accent text-xs font-medium
                       hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            Select this folder
          </button>
        </div>
      </div>
    </div>
  );
}
