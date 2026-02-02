# RAG & Agent Evals

A TypeScript framework for evaluating RAG retrieval pipelines, with a Next.js frontend for visual inspection.

## Repository structure

```
packages/
  eval-lib/     # Core evaluation library (rag-evaluation-system)
  frontend/     # Next.js UI for question generation and inspection
  backend/      # Placeholder for Convex backend (coming soon)
```

## Prerequisites

- Node.js >= 18
- pnpm

## Quick start

```bash
# Install all workspace packages
pnpm install

# Build the eval library
pnpm build

# Start the frontend dev server (http://localhost:3000)
pnpm dev
```

The frontend requires an OpenAI API key:

```bash
echo "OPENAI_API_KEY=sk-your-key" > packages/frontend/.env
```

## Common commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build eval-lib |
| `pnpm dev` | Start frontend dev server |
| `pnpm test` | Run eval-lib tests |
| `pnpm typecheck` | TypeScript check eval-lib |
| `pnpm -C packages/frontend build` | Production build of frontend |

## Packages

See each package's README for detailed documentation:

- [eval-lib](packages/eval-lib/README.md) — Core library: chunkers, embedders, metrics, evaluation orchestrators, synthetic data generation
- [frontend](packages/frontend/README.md) — Next.js app for visual question generation and result inspection

## License

MIT
