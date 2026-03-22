"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@convex/_generated/dataModel";
import { INDUSTRIES, ENTITY_TYPES } from "@/lib/constants";

interface CreateKBModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (kbId: Id<"knowledgeBases">) => void;
}

export function CreateKBModal({ open, onClose, onCreated }: CreateKBModalProps) {
  const createKb = useMutation(api.crud.knowledgeBases.create);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [entityType, setEntityType] = useState("");
  const [company, setCompany] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createKb({
        name: name.trim(),
        ...(industry && { industry }),
        ...(entityType && { entityType }),
        ...(company.trim() && { company: company.trim() }),
        ...(sourceUrl.trim() && { sourceUrl: sourceUrl.trim() }),
      });
      setName("");
      setIndustry("");
      setEntityType("");
      setCompany("");
      setSourceUrl("");
      onCreated(id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-elevated border border-border rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-text">Create Knowledge Base</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="border-t border-border" />

        <div className="space-y-1">
          <label className="text-xs text-text-muted uppercase tracking-wide">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp Support KB"
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:border-accent outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text-dim focus:border-accent outline-none"
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind.charAt(0).toUpperCase() + ind.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text-dim focus:border-accent outline-none"
            >
              <option value="">Select type...</option>
              {ENTITY_TYPES.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-muted uppercase tracking-wide">Company</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Acme Inc"
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:border-accent outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-muted uppercase tracking-wide">Source URL</label>
          <input
            type="text"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://acme.com/support"
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:border-accent outline-none"
          />
        </div>

        <div className="border-t border-border" />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-dim hover:text-text border border-border rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-4 py-2 text-sm bg-accent text-bg-elevated rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
