"use client";

import { EvalMode } from "@/lib/types";

export function Header({
  mode,
  onReset,
}: {
  mode: EvalMode | null;
  onReset: () => void;
}) {
  return (
    <header className="border-b border-border bg-bg-elevated/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
          <h1 className="text-sm font-semibold tracking-wide text-text">
            rag-eval
          </h1>
          <span className="text-text-dim text-xs">/</span>
          <span className="text-text-muted text-xs">synth-datagen</span>
        </div>
        {mode && (
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded bg-accent/10 text-accent border border-accent/20 font-medium">
              {mode === "chunk" ? "Chunk-Level" : "Token-Level"}
            </span>
            <button
              onClick={onReset}
              className="text-xs text-text-dim hover:text-text transition-colors cursor-pointer"
            >
              reset
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
