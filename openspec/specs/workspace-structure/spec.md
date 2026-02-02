### Requirement: pnpm workspace configuration
The repository root SHALL contain a `pnpm-workspace.yaml` that declares `packages/*` as workspace members. The root `package.json` SHALL have `"private": true` and MUST NOT export any library code.

#### Scenario: Workspace packages are discovered
- **WHEN** `pnpm install` is run at the repository root
- **THEN** pnpm discovers and links all packages under `packages/`

#### Scenario: Root is not publishable
- **WHEN** inspecting the root `package.json`
- **THEN** it has `"private": true` and no `"exports"` field

### Requirement: eval-lib package at packages/eval-lib
The eval library source, build config, and tests SHALL reside in `packages/eval-lib/`. The package name in `package.json` SHALL remain `rag-evaluation-system`. The `tsup.config.ts`, `tsconfig.json`, and `vitest.config.ts` SHALL be present in this package directory.

#### Scenario: Library builds successfully
- **WHEN** `pnpm build` is run in `packages/eval-lib/`
- **THEN** `dist/` is produced with ESM, CJS, and type definitions

#### Scenario: Tests run successfully
- **WHEN** `pnpm test` is run in `packages/eval-lib/`
- **THEN** all existing tests pass from `tests/` within the package

### Requirement: frontend package at packages/frontend
The Next.js frontend SHALL reside in `packages/frontend/`. It SHALL depend on `rag-evaluation-system` using the `"workspace:*"` protocol.

#### Scenario: Frontend resolves eval-lib via workspace
- **WHEN** `pnpm install` is run at root and `pnpm dev` is run in `packages/frontend/`
- **THEN** the frontend imports from `rag-evaluation-system` resolve to `packages/eval-lib/dist/`

#### Scenario: No import changes required
- **WHEN** inspecting frontend source files
- **THEN** all imports from `"rag-evaluation-system"` are unchanged from before migration

### Requirement: backend placeholder at packages/backend
An empty `packages/backend/` directory SHALL exist with a minimal `package.json` (name and `"private": true`).

#### Scenario: Backend placeholder exists
- **WHEN** inspecting `packages/backend/package.json`
- **THEN** it contains `"name"` and `"private": true` with no source code

### Requirement: shared assets remain at root
The `data/`, `openspec/`, `CLAUDE.md`, and `README.md` SHALL remain at the repository root, not inside any package.

#### Scenario: Root-level assets are not moved
- **WHEN** inspecting the repository root after migration
- **THEN** `data/`, `openspec/`, `CLAUDE.md`, and `README.md` are present at root

### Requirement: root convenience scripts
The root `package.json` SHALL include convenience scripts that delegate to workspace packages (e.g., `"build"` runs the eval-lib build, `"test"` runs eval-lib tests).

#### Scenario: Root build script delegates
- **WHEN** `pnpm build` is run at the repository root
- **THEN** it executes the build in `packages/eval-lib/`
