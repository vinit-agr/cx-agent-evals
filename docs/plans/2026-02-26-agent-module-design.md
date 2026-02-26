# Agent Module Design

## Overview

A conversational Q&A agent that connects to the existing retrieval system via the Convex Agent component (`@convex-dev/agent`). Users select one or more knowledge bases, each with an optional retriever pipeline configuration, and chat with the agent. The agent calls the appropriate KB retriever tool(s), retrieves relevant chunks, and synthesizes answers with source citations.

## Decisions

- **Approach**: Convex Agent component (manages threads, messages, tool calling, streaming)
- **KB scope**: Multiple KBs as separate tools per conversation — agent decides which to search
- **Retriever config**: Configurable per KB using existing PipelineConfig from eval-lib
- **Retrieval logic**: Uses CallbackRetriever (and optionally PipelineRetriever) from eval-lib — same code path as experiments
- **UI**: Separate `/agent` page with thread sidebar, chat view, and source citations
- **Persistence**: Persistent threads via Convex Agent component's native thread/message tables
- **Evidence**: Retrieved chunks shown as collapsible source citations under each answer

## Architecture

### Backend (packages/backend/convex/)

#### Component setup

`convex.config.ts` registers the `@convex-dev/agent` component. The component manages its own tables (threads, messages, streamDeltas, etc.) within a component namespace.

#### Agent definition (`agent/qaAgent.ts`)

A QA agent created dynamically per request with:
- Model: `openai.chat("gpt-4o-mini")` via `@ai-sdk/openai`
- Embedding model: `openai.embedding("text-embedding-3-small")` for message history search
- Instructions: System prompt directing the agent to use search tools and cite sources
- `stopWhen: stepCountIs(5)` for multi-step tool calling
- Tools: Dynamically created based on the thread's KB configuration

Tools are created at action runtime (not at agent definition time) because each thread has a different set of KBs.

#### Retriever tool factory (`agent/retrieverTool.ts`)

`createKBRetrieverTool(kbId, kbName, retrieverConfig?)` returns a `createTool` instance:

- **Args**: `z.object({ query: z.string(), topK: z.number().default(10) })`
- **Description**: Dynamic — `"Search the '{kbName}' knowledge base for relevant information"`
- **Handler**:
  1. Constructs a `CallbackRetriever` from eval-lib with `retrieveFn` that:
     - Embeds the query using OpenAI embeddings
     - Runs `ctx.vectorSearch` on `documentChunks` filtered by `kbId`
     - Hydrates chunks via `fetchChunksWithDocs` internal query
  2. If `retrieverConfig` (PipelineConfig) is provided, wraps in a `PipelineRetriever` with BM25, reranking, etc.
  3. Calls `retriever.retrieve(query, topK)`
  4. Returns `PositionAwareChunk[]` formatted for the LLM: `{ chunks: [{ content, docTitle, docId, start, end }] }`

This is the same pattern used in `experimentActions.ts` — single source of truth for retrieval logic.

#### Thread management (`agent/threads.ts`)

Mutations and queries for thread lifecycle:

- `createThread` mutation: Creates agent thread (via `createThread` from `@convex-dev/agent`) + stores KB config in `agentThreadConfigs` table
- `sendMessage` mutation: Saves user message to thread, schedules `streamResponse` action via `ctx.scheduler.runAfter(0, ...)`
- `streamResponse` internal action: Reads thread config, creates dynamic tools, calls `agent.streamText()` with `saveStreamDeltas: true`
- `listMessages` query: Paginated messages via `listUIMessages` + `syncStreams` for streaming support
- `listThreads` query: User's threads with title and last activity

#### New schema table

```ts
agentThreadConfigs: defineTable({
  threadId: v.string(),
  orgId: v.string(),
  userId: v.string(),
  kbConfigs: v.array(v.object({
    kbId: v.id("knowledgeBases"),
    retrieverConfig: v.optional(v.any()),
  })),
  createdAt: v.number(),
}).index("by_thread", ["threadId"])
  .index("by_user", ["userId", "orgId"])
```

No changes to existing tables.

### Frontend (packages/frontend/)

#### New route: `/agent`

**`src/app/agent/page.tsx`** — Main page wrapped in `AuthGate`.

#### Layout

Three-area layout:
1. **Left sidebar** — Thread list + "New Chat" button
2. **Center** — Chat message stream with input bar
3. **Top bar** — Active KB badges for current thread

#### Components

**`ThreadList.tsx`**: Lists user's threads (title, last message preview, timestamp). "New Chat" triggers KB selection dialog.

**`NewThreadDialog.tsx`**: Modal for creating a thread:
- Multi-select list of org's KBs
- Optional retriever pipeline config per KB (reuse patterns from experiments page, or use defaults)
- "Start Chat" button

**`ChatView.tsx`**: Main chat area:
- `useUIMessages` hook from `@convex-dev/agent/react` with `stream: true`
- User messages on right, assistant on left
- Auto-scroll on new messages
- Text input + send button at bottom

**`MessageBubble.tsx`**: Single message renderer:
- Text content for user/assistant messages
- Collapsible "Sources" section for tool result messages showing retrieved chunks
- Streaming indicator while generating

**`SourceCard.tsx`**: Citation card showing document title, text snippet, KB name badge.

#### Styling

Dark theme consistent with existing app: Tailwind CSS v4, JetBrains Mono, accent `#6ee7b7`.

## Data Flow

```
User types question
  → sendMessage mutation (saves message, schedules action)
    → streamResponse action
      → Read agentThreadConfigs for this thread
      → For each KB: createKBRetrieverTool(kbId, name, config)
      → Create Agent with those tools
      → agent.streamText(ctx, { threadId }, { promptMessageId })
        → Agent decides which KB(s) to search
        → Tool handler: CallbackRetriever.retrieve(query, topK)
          → Embed query → vectorSearch → hydrate chunks
        → Agent receives chunks, synthesizes answer
        → All messages saved to agent component (tool calls, results, answer)
    → Frontend receives streaming updates via useUIMessages
      → MessageBubble renders text + sources
```

## Dependencies

### Backend (packages/backend)

New:
- `@convex-dev/agent` — Agent component
- `@ai-sdk/openai` — AI SDK OpenAI provider
- `ai` — Vercel AI SDK core

Existing (already available):
- `openai` — For embeddings in tool handler
- `rag-evaluation-system` — CallbackRetriever, PipelineRetriever

### Frontend (packages/frontend)

New:
- `@convex-dev/agent` — `useUIMessages` hook and types

### External packages (convex.json)

Add `@ai-sdk/openai` and `ai` to `externalPackages` list (alongside existing `langsmith`, `@langchain/core`, `openai`).

## What stays unchanged

- Existing experiment execution flow
- Existing question generation flow
- Existing schema tables (documentChunks, knowledgeBases, documents, etc.)
- eval-lib library code (consumed as-is via CallbackRetriever/PipelineRetriever)

## Scope boundaries

This design intentionally excludes:
- Multi-turn tool memory (agent sees full thread history natively via Convex Agent)
- Usage tracking / rate limiting (can be added later via agent's `usageHandler`)
- LangSmith logging of agent conversations (can be added later via `rawResponseHandler`)
- Document upload from within the chat (use existing upload flow, then reference KB in agent)
