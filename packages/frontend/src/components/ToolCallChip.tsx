"use client";

import { useState } from "react";

interface ToolCallChipProps {
  toolName: string;
  toolArgs?: string;   // JSON string
  toolResult?: string; // JSON string
}

export default function ToolCallChip({ toolName, toolArgs, toolResult }: ToolCallChipProps) {
  const [expanded, setExpanded] = useState(false);

  const displayName = toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  let parsedArgs: any = {};
  let parsedResult: any[] = [];
  try { parsedArgs = JSON.parse(toolArgs ?? "{}"); } catch {}
  try { parsedResult = JSON.parse(toolResult ?? "[]"); } catch {}

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-[9px] hover:border-accent/30 transition-colors"
      >
        <span className="text-accent">&#9889;</span>
        <span className="text-text-muted">
          Searched <strong className="text-text font-medium">{displayName}</strong>
        </span>
        <span className="text-text-dim">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="mt-1 ml-2 p-2.5 bg-bg-elevated border border-border rounded-md text-[9px] animate-fade-in">
          {parsedArgs.query && (
            <div className="mb-2">
              <span className="text-text-dim">Query: </span>
              <span className="text-text">&ldquo;{parsedArgs.query}&rdquo;</span>
            </div>
          )}
          {parsedResult.length > 0 && (
            <div>
              <span className="text-text-dim">{parsedResult.length} chunk{parsedResult.length !== 1 ? "s" : ""} returned</span>
              <div className="mt-1.5 space-y-1">
                {parsedResult.slice(0, 3).map((chunk: any, i: number) => (
                  <div key={i} className="p-1.5 bg-bg rounded border border-border/50 text-text-muted">
                    <div className="line-clamp-2">{chunk.content?.slice(0, 150)}...</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
