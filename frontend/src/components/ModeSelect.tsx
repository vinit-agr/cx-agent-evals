"use client";

import { EvalMode } from "@/lib/types";

export function ModeSelect({ onSelect }: { onSelect: (mode: EvalMode) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-6">
      <div className="animate-fade-in max-w-2xl w-full">
        <div className="mb-12 text-center">
          <p className="text-text-dim text-xs uppercase tracking-[0.2em] mb-3">
            Select evaluation mode
          </p>
          <h2 className="text-2xl font-light text-text tracking-tight">
            What are you evaluating?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => onSelect("chunk")}
            className="group relative border border-border rounded-lg p-6 text-left
                       hover:border-accent/40 hover:bg-bg-surface transition-all duration-200
                       cursor-pointer"
          >
            <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-accent/0 group-hover:bg-accent transition-colors" />
            <div className="text-xs text-text-dim uppercase tracking-wider mb-2">
              Mode A
            </div>
            <h3 className="text-lg font-medium text-text mb-2">Chunk-Level</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Evaluate whether the right chunks are retrieved. Generates
              questions paired with relevant chunk IDs.
            </p>
            <div className="mt-4 pt-3 border-t border-border/50">
              <span className="text-[11px] text-text-dim">
                Configurable chunk size & overlap
              </span>
            </div>
          </button>

          <button
            onClick={() => onSelect("token")}
            className="group relative border border-border rounded-lg p-6 text-left
                       hover:border-accent/40 hover:bg-bg-surface transition-all duration-200
                       cursor-pointer"
          >
            <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-accent/0 group-hover:bg-accent transition-colors" />
            <div className="text-xs text-text-dim uppercase tracking-wider mb-2">
              Mode B
            </div>
            <h3 className="text-lg font-medium text-text mb-2">Token-Level</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Evaluate at character-span precision. Generates questions paired
              with exact text positions in the source.
            </p>
            <div className="mt-4 pt-3 border-t border-border/50">
              <span className="text-[11px] text-text-dim">
                Highlights exact character ranges
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
