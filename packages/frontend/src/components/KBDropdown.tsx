"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@convex/_generated/dataModel";

interface KBDropdownProps {
  selectedKbId: Id<"knowledgeBases"> | null;
  onSelect: (kbId: Id<"knowledgeBases">) => void;
}

export function KBDropdown({ selectedKbId, onSelect }: KBDropdownProps) {
  const kbs = useQuery(api.crud.knowledgeBases.listWithDocCounts, {});

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-text-muted uppercase tracking-wide whitespace-nowrap">
        Knowledge Base
      </label>
      {kbs === undefined ? (
        <div className="flex items-center gap-2 text-text-dim text-sm">
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          Loading...
        </div>
      ) : (
        <select
          value={selectedKbId ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              onSelect(e.target.value as Id<"knowledgeBases">);
            }
          }}
          className="flex-1 bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none"
        >
          <option value="">Select a knowledge base...</option>
          {kbs.map((kb) => (
            <option key={kb._id} value={kb._id}>
              {kb.name} ({kb.documentCount} {kb.documentCount === 1 ? "doc" : "docs"})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
