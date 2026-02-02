## 1. Create workspace scaffolding

- [x] 1.1 Create `packages/` directory
- [x] 1.2 Create `pnpm-workspace.yaml` with `packages: ["packages/*"]`

## 2. Move eval-lib

- [x] 2.1 Create `packages/eval-lib/` and `git mv src/` into it
- [x] 2.2 `git mv` tests/ into `packages/eval-lib/tests/`
- [x] 2.3 `git mv` tsup.config.ts, vitest.config.ts, tsconfig.json into `packages/eval-lib/`
- [x] 2.4 Move current root package.json to `packages/eval-lib/package.json` and adjust relative paths (dist/, src/ references)
- [x] 2.5 Remove `dist/` and `.gitignore` eval-lib's dist from the right place

## 3. Move frontend

- [x] 3.1 `git mv frontend/` to `packages/frontend/`
- [x] 3.2 Update `packages/frontend/package.json`: change `"rag-evaluation-system": "file:.."` to `"workspace:*"`

## 4. Create backend placeholder

- [x] 4.1 Create `packages/backend/package.json` with name `@rag-eval/backend` and `"private": true`

## 5. Create root workspace package.json

- [x] 5.1 Create new root `package.json` with `"private": true`, workspace convenience scripts (`build`, `test`, `typecheck`, `dev`)

## 6. Verify and update docs

- [x] 6.1 Run `pnpm install` at root, verify workspace linking
- [x] 6.2 Build eval-lib (`pnpm -C packages/eval-lib build`) and verify dist/ output
- [x] 6.3 Run tests (`pnpm -C packages/eval-lib test`) and verify all pass
- [x] 6.4 Start frontend dev server (`pnpm -C packages/frontend dev`) and verify it resolves eval-lib imports
- [x] 6.5 Update CLAUDE.md with new directory structure and commands
