## Why

The project has three emerging modules — the eval library, a Next.js frontend, and an upcoming Convex backend — that share code but have distinct dependency trees and build pipelines. The current structure (library at root, frontend as a subfolder with `file:..` linking) doesn't scale cleanly to a third package and makes dependency boundaries implicit. Restructuring into a pnpm workspace monorepo formalizes package boundaries while keeping everything in one repo with atomic commits.

## What Changes

- **BREAKING**: Move `src/` into `packages/eval-lib/` (library source, build config, tests)
- **BREAKING**: Move `frontend/` into `packages/frontend/`
- Create empty `packages/backend/` placeholder for future Convex backend
- Add `pnpm-workspace.yaml` at repo root defining `packages/*`
- Replace root `package.json` with a workspace root (shared scripts only, no library exports)
- Frontend dependency changes from `"file:.."` to `"workspace:*"` protocol
- `data/` and `examples/` remain at repo root (shared across packages)
- All TypeScript import statements remain unchanged (package name `rag-evaluation-system` stays the same)

## Capabilities

### New Capabilities
- `workspace-structure`: pnpm workspace configuration, root workspace package.json, cross-package dependency resolution via `workspace:*` protocol

### Modified Capabilities
_(No spec-level behavior changes — this is a structural reorganization. All existing capabilities retain the same requirements.)_

## Impact

- **Build workflow**: `npm run build` moves to `packages/eval-lib/`; root scripts delegate to workspace packages
- **CI/scripts**: Any paths referencing `src/` or `frontend/` at root must update
- **Dev workflow**: `pnpm install` at root links all workspace packages; same rebuild-then-restart cycle
- **Package resolution**: Frontend (and future backend) resolve `rag-evaluation-system` via pnpm workspace linking instead of `file:` protocol
- **Git history**: File moves show as renames with `git mv`
