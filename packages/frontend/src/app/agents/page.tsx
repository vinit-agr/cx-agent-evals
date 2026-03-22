"use client";

import { Suspense, useState } from "react";
import { Id } from "@convex/_generated/dataModel";
import { Header } from "@/components/Header";
import AgentSidebar from "@/components/AgentSidebar";
import AgentConfigPanel from "@/components/AgentConfigPanel";
import AgentPlayground from "@/components/AgentPlayground";

function AgentsContent() {
  const [selectedAgentId, setSelectedAgentId] = useState<Id<"agents"> | null>(null);

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <Header mode="agents" />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AgentSidebar
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
        />
        {selectedAgentId ? (
          <div className="flex-1 grid grid-cols-[380px_1fr] min-h-0 min-w-0">
            <div className="border-r border-border flex flex-col min-h-0">
              <AgentConfigPanel agentId={selectedAgentId} />
            </div>
            <AgentPlayground agentId={selectedAgentId} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted text-sm">Select an agent or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense>
      <AgentsContent />
    </Suspense>
  );
}
