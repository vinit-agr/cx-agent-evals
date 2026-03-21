"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { Id } from "@convex/_generated/dataModel";

interface AgentSidebarProps {
  selectedAgentId: Id<"agents"> | null;
  onSelectAgent: (id: Id<"agents"> | null) => void;
}

export default function AgentSidebar({ selectedAgentId, onSelectAgent }: AgentSidebarProps) {
  const agents = useQuery(api.crud.agents.byOrg) ?? [];
  const createAgent = useMutation(api.crud.agents.create);

  const handleCreate = async () => {
    const id = await createAgent({
      name: "New Agent",
      identity: {
        agentName: "New Agent",
        companyName: "",
        roleDescription: "You are a helpful customer support agent.",
      },
      guardrails: {},
      responseStyle: {
        formality: "professional",
        length: "concise",
      },
      model: "claude-sonnet-4-20250514",
      enableReflection: false,
      retrieverIds: [],
    });
    onSelectAgent(id);
  };

  return (
    <div className="w-[220px] bg-bg-elevated border-r border-border flex flex-col flex-shrink-0">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <span className="text-text-muted text-xs uppercase tracking-wider">Agents</span>
        <button
          onClick={handleCreate}
          className="bg-accent text-bg text-xs px-2 py-0.5 rounded font-medium hover:bg-accent/90 transition-colors"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {agents.length === 0 && (
          <p className="text-text-dim text-xs p-2">No agents yet. Create one to get started.</p>
        )}
        {agents.map((agent) => (
          <button
            key={agent._id}
            onClick={() => onSelectAgent(agent._id)}
            className={`w-full text-left rounded-md p-2.5 mb-1 transition-colors ${
              selectedAgentId === agent._id
                ? "bg-bg-surface border-l-[3px] border-l-accent"
                : "border-l-[3px] border-l-transparent hover:bg-bg-surface/50"
            }`}
          >
            <div className={`text-[11px] font-medium ${selectedAgentId === agent._id ? "text-text" : "text-text-muted"}`}>
              {agent.name}
            </div>
            <div className="text-text-dim text-[9px] mt-0.5">
              {agent.model.replace("claude-", "").replace(/-\d+$/, "")}
            </div>
            <div className="flex gap-1 mt-1 flex-wrap">
              <span className="text-[8px] px-1.5 py-px rounded bg-bg-elevated text-text-muted">
                {agent.retrieverIds.length} retriever{agent.retrieverIds.length !== 1 ? "s" : ""}
              </span>
              <span
                className={`text-[8px] px-1.5 py-px rounded-full ${
                  agent.status === "ready"
                    ? "bg-accent/10 text-accent"
                    : agent.status === "error"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-yellow-500/10 text-yellow-400"
                }`}
              >
                {agent.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
