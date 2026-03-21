# Agents Module Design

## Overview

A new module in the CX Agent Evals application that provides an agent harness system. Users create agents with structured prompt configurations and connect retriever tools from any knowledge base. Each agent runs an LLM-powered loop that decides when to call retriever tools, synthesizes retrieved information, and generates answers suitable for customer support use cases.

## Scope

### In scope (this change)
- Agent CRUD with hybrid prompt template (structured sections + free-form override)
- Multi-agent conversation data model (conversations + messages in Convex)
- Agent execution loop using Vercel AI SDK with Anthropic models
- Retriever tools: each linked retriever becomes an AI SDK tool at runtime
- Convex delta streaming for incremental response delivery
- Tool call visibility in chat (collapsed by default, expandable)
- Lite URL context extraction (fetch homepage, summarize company info)
- Side-by-side layout: config panel (left) + playground chat (right)

### Out of scope (follow-up changes)
- Navigation reorder (KB > Retrievers > Agents > Generate > Experiments)
- Multi-agent conversations (multiple agents in one conversation)
- Conversation management (list, archive, multi-session)
- User simulation / conversation simulation for evaluation
- Running experiments on agents (agent-level evaluation)
- Deep website crawling (beyond homepage)
- Additional tool types beyond retrievers

## Architecture

### Approach: Convex-Native Agent System

Build entirely with Convex primitives, using the Vercel AI SDK only for LLM calls inside `"use node"` actions. No external agent framework.

**Rationale**: The project already has WorkPool-based job orchestration, org-scoped auth, vector search patterns, and reactive queries. Adding an agent framework (Mastra, Convex Agent component) would overlap with existing infrastructure and add dependency/integration complexity.

### LLM Layer

**Vercel AI SDK** with `@ai-sdk/anthropic` provider.

- Model-agnostic architecture (can swap providers later)
- First-class Claude support: extended thinking, tool streaming, parallel tool use
- `streamText()` for streaming responses with `onStepFinish` callbacks
- `maxSteps` for controlling the agent loop (tool call iterations)
- Lightweight: ~6.5 MB, works natively in Convex `"use node"` actions

### New Dependencies

- `ai` (Vercel AI SDK core)
- `@ai-sdk/anthropic` (Anthropic provider)

Both added to `packages/backend/package.json` and marked as external in `packages/backend/convex.json`.

### Environment Variables

- `ANTHROPIC_API_KEY` — Required for agent execution. Must be set in the Convex dashboard environment variables (alongside existing `OPENAI_API_KEY` and `LANGSMITH_API_KEY`).

## Data Model

### `agents` table

Agents are independent of knowledge bases. They connect to retrievers from any KB via `retrieverIds`.

```typescript
agents: defineTable({
  orgId: v.string(),
  name: v.string(),

  // Structured prompt sections
  identity: v.object({
    agentName: v.string(),
    companyName: v.string(),
    companyUrl: v.optional(v.string()),
    companyContext: v.optional(v.string()),  // auto-generated from URL
    roleDescription: v.string(),
    brandVoice: v.optional(v.string()),
  }),
  guardrails: v.object({
    outOfScope: v.optional(v.string()),
    escalationRules: v.optional(v.string()),
    compliance: v.optional(v.string()),
  }),
  responseStyle: v.object({
    formatting: v.optional(v.string()),
    length: v.optional(v.string()),
    formality: v.optional(v.string()),
    language: v.optional(v.string()),
  }),
  additionalInstructions: v.optional(v.string()),

  // Agent behavior
  model: v.string(),                          // e.g. "claude-sonnet-4-20250514"
  enableReflection: v.boolean(),
  retrieverIds: v.array(v.id("retrievers")),  // from any KB

  status: v.union(
    v.literal("draft"),
    v.literal("ready"),
    v.literal("error")
  ),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
```

### `conversations` table

Supports multi-agent participation (designed for future use; playground uses single agent).

```typescript
conversations: defineTable({
  orgId: v.string(),
  title: v.optional(v.string()),
  agentIds: v.array(v.id("agents")),
  status: v.union(
    v.literal("active"),
    v.literal("archived")
  ),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
```

### `messages` table

These are the application's storage roles, not AI SDK roles. The `runAgent` action maps between these and the AI SDK message format:
- `"user"` → AI SDK `{ role: "user", content }`
- `"assistant"` → AI SDK `{ role: "assistant", content }` (may include `toolInvocations`)
- `"tool_call"` → stored for UI display; included in AI SDK messages as part of assistant `toolInvocations`
- `"tool_result"` → AI SDK `{ role: "tool", content, toolCallId }`
- When reconstructing conversation history for subsequent LLM calls, `tool_call` messages are folded into the preceding `assistant` message's `toolInvocations`, and `tool_result` messages become `role: "tool"` messages.

```typescript
messages: defineTable({
  conversationId: v.id("conversations"),
  order: v.number(),

  role: v.union(
    v.literal("system"),
    v.literal("user"),
    v.literal("assistant"),
    v.literal("tool_call"),
    v.literal("tool_result"),
  ),

  content: v.string(),

  agentId: v.optional(v.id("agents")),

  toolCall: v.optional(v.object({
    toolCallId: v.string(),              // AI SDK tool call ID for mapping results
    toolName: v.string(),
    toolArgs: v.string(),
    retrieverId: v.optional(v.id("retrievers")),
  })),
  toolResult: v.optional(v.object({
    toolCallId: v.string(),              // matches the tool_call's toolCallId
    toolName: v.string(),
    result: v.string(),
    retrieverId: v.optional(v.id("retrievers")),
  })),

  status: v.union(
    v.literal("pending"),
    v.literal("streaming"),
    v.literal("complete"),
    v.literal("error")
  ),

  usage: v.optional(v.object({
    promptTokens: v.number(),
    completionTokens: v.number(),
  })),

  createdAt: v.number(),
})
  .index("by_conversation", ["conversationId", "order"])
```

### `streamDeltas` table

```typescript
streamDeltas: defineTable({
  messageId: v.id("messages"),
  start: v.number(),
  end: v.number(),
  text: v.string(),
})
  .index("by_message", ["messageId", "start"])
```

## Backend Architecture

### Directory Structure

```
convex/
  agents/
    actions.ts          # "use node" — agent execution loop, URL context extraction
    orchestration.ts    # mutations/queries — send message, manage playground
  crud/
    agents.ts           # Agent CRUD (create, update, delete, list, get)
    conversations.ts    # Conversation + message queries
```

### Agent CRUD (`crud/agents.ts`)

Org-scoped operations following existing patterns:

- `byOrg()` — list all agents for the org
- `get(id)` — single agent with org check
- `create(...)` — create with config, status = "draft" initially
- `update(id, ...)` — update config fields
- `remove(id)` — delete agent (does not delete conversations)

### Conversation CRUD (`crud/conversations.ts`)

- `create(agentIds)` — start new conversation
- `get(id)` — conversation with org check
- `listMessages(conversationId)` — all messages ordered by `order`
- `getStreamDeltas(messageId)` — stream deltas for a message

### Agent Execution

#### Send Message Flow

**Step 1 — `sendMessage` mutation** (`agents/orchestration.ts`):
1. Insert user message with next `order`
2. Create pending assistant message (status: `"streaming"`)
3. Schedule agent action via `ctx.scheduler.runAfter(0, ...)`
4. Return pending message ID

**Step 2 — `runAgent` action** (`agents/actions.ts`, `"use node"`):
1. Read agent config + linked retrievers
2. Build system prompt via `composeSystemPrompt()`
3. Construct AI SDK tools — one per retriever:
   - Tool name: slugified retriever name
   - Description: includes KB name and retriever details
   - Parameters: `{ query: string, k?: number }`
   - Execute: embed query via existing `vectorSearchWithFilter` pattern
4. Fetch full conversation history
5. Call AI SDK `streamText()` with:
   - `model: anthropic(agent.model)`
   - `system: composedSystemPrompt`
   - `messages: conversationHistory`
   - `tools: retrieverTools`
   - `maxSteps: 5`
6. On each step: write `tool_call` and `tool_result` messages via mutations
7. Stream final text: write deltas to `streamDeltas` table incrementally
8. Update assistant message to `"complete"`, store usage

**Step 3 — Optional reflection** (if `enableReflection` is true):
- After generating answer, one more LLM call evaluating factual grounding, policy compliance, helpfulness
- If inadequate, revise and update the assistant message

#### Streaming Pattern

1. Action calls `streamText()` from AI SDK
2. Consumes text stream, buffering chunks for ~200ms or 50 characters (whichever comes first) before flushing
3. Each flush → mutation inserting into `streamDeltas` with incrementing `start`/`end` cursors
4. Frontend subscribes to `streamDeltas` by message ID, reconstructs text from ordered deltas
5. On completion: final mutation writes full text to `messages.content`, marks status `"complete"`, and schedules a cleanup action (via `ctx.scheduler.runAfter`) to delete all `streamDeltas` rows for this message in batches

#### URL Context Extraction

Separate action triggered on agent creation/update when `companyUrl` changes:
1. Fetch homepage HTML
2. Extract: title, meta description, OG tags, main text content
3. LLM call: "Summarize this company in 2-3 paragraphs"
4. Store result in `agent.identity.companyContext`

## Prompt Template System

### Template Structure

A pure function `composeSystemPrompt(agent, retrievers)` builds the system prompt from structured sections. It lives in a shared utility (no `"use node"` deps).

Sections (omitted if empty):
1. **Identity** — agent name, company name, role description, company context, brand voice
2. **Response Style** — formality, length, formatting, language
3. **Guardrails** — out of scope topics, escalation rules, compliance
4. **Tools** — lists each retriever with name and description, instructs on tool usage behavior
5. **Self-Evaluation** (if reflection enabled) — factual grounding check, policy compliance, helpfulness
6. **Additional Instructions** — free-form override

### Default Values

| Field | Default |
|-------|---------|
| `roleDescription` | `"You are a helpful customer support agent."` |
| `model` | `"claude-sonnet-4-20250514"` |
| `formality` | `"professional"` |
| `length` | `"concise"` |
| `enableReflection` | `false` |

## Frontend Design

### Layout: Side-by-Side Config + Playground

**Sidebar (220px)**: Agent list only. No KB filter. Selected agent highlighted with accent left border. Each item shows: name, model, retriever count, status badge.

**Context bar**: Agent name + status + delete action.

**Main area — two-column grid**:
- **Left (380px, scrollable)**: Agent configuration form
- **Right (flex, remaining space)**: Playground chat

### Config Panel Sections

1. **Identity & Company** — agent name, company name, URL + Extract button, role description, brand voice
2. **Response Style** — formality/length/formatting dropdowns, language text input
3. **Guardrails & Policies** (collapsible) — out of scope, escalation rules, compliance textareas
4. **Agent Behavior** — model dropdown, reflection toggle
5. **Retriever Tools** — checklist of linked retrievers (showing source KB name + config), "+ Add retriever from any KB"
6. **Additional Instructions** (collapsible) — free-form textarea
7. **Save button** at bottom

### Playground Panel

- Header: "Playground" label + agent name + "Clear chat" button
- Chat area: scrolling message list
  - User messages: right-aligned, accent-tinted background
  - Tool calls: compact chip above agent response ("Searched {retriever name}" with expand arrow)
  - Agent responses: left-aligned, elevated background, agent name label
  - Streaming: blinking cursor at end of partial text
- Input bar: text input + Send button

### Streaming Subscription

1. Subscribe to messages for conversation (reactive query)
2. For messages with status `"streaming"`, also subscribe to `streamDeltas`
3. Reconstruct partial text from ordered deltas
4. Once status → `"complete"`, use `message.content` directly

### Tool Call Expanded View

When user clicks expand on a tool call chip:
- Query used
- Number of chunks returned
- Chunk previews with source document name and relevance score

## Testing Strategy

### Backend Tests (convex-test)

- Agent CRUD: create, update, delete, list, org scoping
- Conversation + message mutations: send message, ordering, status transitions
- Stream delta writes and reads
- `composeSystemPrompt` unit tests (pure function)
- Agent execution: mock AI SDK responses, verify tool call/result messages created correctly

### Frontend

- Manual testing via playground (primary feedback loop for this change)
- Component rendering tests can be added in follow-up

## File Changes Summary

### New files

**Backend:**
- `packages/backend/convex/agents/actions.ts` — agent execution, URL extraction
- `packages/backend/convex/agents/orchestration.ts` — sendMessage, playground management
- `packages/backend/convex/crud/agents.ts` — agent CRUD
- `packages/backend/convex/crud/conversations.ts` — conversation + message queries

**Frontend:**
- `packages/frontend/src/app/agents/page.tsx` — agents module page
- `packages/frontend/src/components/AgentSidebar.tsx` — agent list sidebar
- `packages/frontend/src/components/AgentConfigPanel.tsx` — config form
- `packages/frontend/src/components/AgentPlayground.tsx` — chat playground
- `packages/frontend/src/components/ToolCallChip.tsx` — expandable tool call display

### Modified files

- `packages/backend/convex/schema.ts` — add agents, conversations, messages, streamDeltas tables
- `packages/backend/convex.json` — add `ai`, `@ai-sdk/anthropic` to external packages
- `packages/backend/package.json` — add `ai`, `@ai-sdk/anthropic` dependencies
- `packages/frontend/src/components/Header.tsx` — add "Agents" mode to navigation
- `packages/frontend/src/components/ModeSelector.tsx` — add Agents card
