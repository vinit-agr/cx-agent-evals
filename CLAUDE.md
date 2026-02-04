# CLAUDE.md

## Project overview

RAG Evaluation System — a TypeScript library + Next.js frontend for evaluating RAG retrieval pipelines. Uses span-based (character-level) evaluation with character span matching for precise retrieval assessment, synthetic question generation, and a visual inspection UI.

## Repository structure

This is a **pnpm workspace monorepo** with three packages:

```
packages/
  eval-lib/                     # Core library (TypeScript, published as rag-evaluation-system)
    src/
      types/                    # Branded types, primitives, document/corpus interfaces
      chunkers/                 # Chunker interface + RecursiveCharacterChunker
      embedders/                # Embedder interface (OpenAI implementation at embedders/openai)
      vector-stores/            # VectorStore interface (InMemory, Chroma at vector-stores/chroma)
      rerankers/                # Reranker interface (Cohere at rerankers/cohere)
      evaluation/               # Evaluation orchestrator and metrics (recall, precision, IoU, F1)
      synthetic-datagen/        # Synthetic question generation
        strategies/             # Question generation strategies
          simple/               # SimpleStrategy — prompt-based, N questions per doc
          dimension-driven/     # DimensionDrivenStrategy — dimension discovery, filtering, relevance, sampling
          real-world-grounded/  # RealWorldGroundedStrategy — question matching with embedding similarity
        ground-truth/           # Ground truth assigner (span-based)
      experiments/              # Experiment runner and baseline retrievers
      langsmith/                # LangSmith upload/load utilities
    tests/                      # Vitest test suites

  frontend/                     # Next.js 16 app (Tailwind CSS v4, dark theme)
    src/app/                    # App router pages and API routes
      api/generate/             # SSE streaming endpoint for question generation
      api/discover-dimensions/  # Dimension auto-discovery endpoint
      api/corpus/               # Corpus loading endpoint
      api/browse/               # Folder browser endpoint
    src/components/             # UI components
    src/lib/                    # Shared types

  backend/                      # Placeholder for future Convex backend

data/                           # Sample data files (shared, at repo root)
openspec/                       # OpenSpec change management artifacts
pnpm-workspace.yaml             # Workspace config
```

## Key commands

```bash
# From repo root (convenience scripts delegate to packages)
pnpm build              # Build eval-lib with tsup (outputs to packages/eval-lib/dist/)
pnpm test               # Run vitest tests in eval-lib
pnpm typecheck          # TypeScript check eval-lib
pnpm dev                # Start frontend Next.js dev server

# Or run directly in packages
pnpm -C packages/eval-lib build
pnpm -C packages/eval-lib test
pnpm -C packages/frontend dev
pnpm -C packages/frontend build    # Production build (good for verifying TypeScript)
```

## Development workflow

After changing library code in `packages/eval-lib/src/`:
1. `pnpm build` at project root (rebuilds eval-lib dist/)
2. Restart the Next.js dev server (Turbopack caches resolved modules)

First-time setup:
```bash
pnpm install    # Run at repo root — links all workspace packages
pnpm build      # Build the eval-lib so frontend can resolve imports
```

## Environment

- `OPENAI_API_KEY` required in `packages/frontend/.env` for generation and dimension discovery
- Node >= 18, pnpm for package management
- TypeScript strict mode, ESM (`"type": "module"`)

## Architecture notes

### Evaluation approach

The system uses span-based (character-level) evaluation exclusively:
- Ground truth is specified as `CharacterSpan[]` with exact text positions in source documents
- Metrics (`recall`, `precision`, `iou`, `f1`) measure character-level overlap
- `PositionAwareChunker` interface required for chunkers that participate in evaluation

### Synthetic data generation

Three strategies, selectable from the frontend:

- **SimpleStrategy**: Prompt-based. Generates N questions per document.
- **DimensionDrivenStrategy**: Structured diversity. Pipeline: load dimensions → pairwise filter combinations → summarize docs → build relevance matrix → stratified sample → batch generate per document. Accepts `onProgress` callback for streaming phase events.
- **RealWorldGroundedStrategy**: Matches real-world questions to documents using embedding similarity.

All strategies produce `GeneratedQuery[]`, which are then passed to the `GroundTruthAssigner` to create labeled evaluation data with character spans.

LLM calls in the dimension-driven pipeline are parallelized with `Promise.all` (filtering, summarization, assignment batches).

### Frontend

- State managed in `page.tsx` via React hooks (no global state library)
- SSE streaming for real-time question generation with phase progress events
- Dimension config persisted to localStorage (`rag-eval:dimension-config`)
- Design system: dark theme, JetBrains Mono, custom color tokens (accent: `#6ee7b7`)

### Testing

- Unit tests in `packages/eval-lib/tests/` with vitest
- Mock LLM clients for testing strategies (return canned JSON responses)
- 104 tests covering strategies, ground-truth assigners, metrics, types, and utilities
