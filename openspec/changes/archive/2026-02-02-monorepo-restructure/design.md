## Context

The project currently has a flat structure: library source at `src/`, frontend at `frontend/`, with the frontend depending on the library via `"file:.."` in package.json. A Convex backend is planned as a third module that will also depend on the eval library. The `file:` linking approach doesn't scale cleanly to three packages.

Current dependency resolution: frontend runs `pnpm install`, which creates a symlink from `node_modules/rag-evaluation-system` → `..` (the root). The frontend then imports from the built `dist/` directory.

## Goals / Non-Goals

**Goals:**
- Restructure into `packages/eval-lib/`, `packages/frontend/`, `packages/backend/` (placeholder)
- Use pnpm workspace protocol (`workspace:*`) for cross-package dependencies
- Zero changes to any TypeScript import statements
- Keep `data/`, `examples/`, `openspec/`, and docs at repo root
- Preserve git history via `git mv`

**Non-Goals:**
- Adding Turborepo or Nx (not needed at this scale)
- Implementing the Convex backend (just a placeholder)
- Creating a shared `tsconfig.base.json` (can be done later)
- Changing the library's published package name
- Moving `data/` or `examples/` into any package

## Decisions

### 1. pnpm workspaces (no additional tooling)

A `pnpm-workspace.yaml` with `packages: ["packages/*"]` is sufficient. Turborepo adds build caching and task orchestration, but with only 2 active packages and fast builds, the complexity isn't justified. Can be added later with zero structural changes.

**Alternative considered**: Nx — too heavy for this project size. npm workspaces — pnpm is already the package manager and its workspace support is more mature.

### 2. Package naming: keep `rag-evaluation-system`

The eval-lib package retains its current name `rag-evaluation-system` in its `package.json`. This means all existing imports (`import { ... } from "rag-evaluation-system"`) work without changes. The workspace protocol resolves the name to the local package automatically.

**Alternative considered**: Scoped name like `@rag-eval/lib` — would require updating every import in frontend (and future backend). No benefit since we're not publishing to npm.

### 3. Root package.json becomes workspace root only

The root `package.json` will have `"private": true`, no library exports, and convenience scripts that delegate to workspace packages (e.g., `"build": "pnpm -C packages/eval-lib build"`).

### 4. File moves via `git mv`

All moves use `git mv` to preserve blame history. The sequence: create `packages/` dir, move eval-lib files, move frontend, create backend placeholder.

### 5. eval-lib keeps its own tests

`tests/` moves into `packages/eval-lib/tests/`. The vitest config moves with it. Tests run from within the eval-lib package.

## Risks / Trade-offs

- **[Path breakage in CI/scripts]** → Grep for hardcoded references to `src/`, `frontend/`, `tests/` in any config files and update them during migration.
- **[pnpm install from root required]** → Same as current workflow; document in CLAUDE.md.
- **[Stale dist/ after lib changes]** → Same rebuild-then-restart cycle as today. No regression.
- **[openspec paths]** → openspec stays at repo root, no impact.

## Migration Plan

1. Create `packages/` directory
2. `git mv` eval-lib files (src/, tests/, tsup.config.ts, vitest.config.ts, tsconfig.json) into `packages/eval-lib/`
3. Move current root `package.json` to `packages/eval-lib/package.json` (adjust paths)
4. `git mv frontend/` to `packages/frontend/`
5. Update frontend's dep from `"file:.."` to `"workspace:*"`
6. Create `packages/backend/package.json` (minimal placeholder)
7. Create new root `package.json` (workspace root)
8. Create `pnpm-workspace.yaml`
9. Update `CLAUDE.md` with new paths and commands
10. `pnpm install` at root, verify build + dev server + tests all pass

**Rollback**: `git reset --hard` to pre-migration commit. No data loss risk.
