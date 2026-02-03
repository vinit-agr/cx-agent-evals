## 1. Remove Legacy Folders

- [x] 1.1 Delete `packages/eval-lib/src/synthetic-datagen/chunk-level/` folder (generator.ts, index.ts)
- [x] 1.2 Delete `packages/eval-lib/src/synthetic-datagen/token-level/` folder (generator.ts, index.ts)

## 2. Update Exports

- [x] 2.1 Remove legacy exports from `packages/eval-lib/src/synthetic-datagen/index.ts` (lines 34-35: ChunkLevelSyntheticDatasetGenerator, TokenLevelSyntheticDatasetGenerator re-exports and comment)
- [x] 2.2 Remove legacy exports from `packages/eval-lib/src/index.ts` (lines 74-75: ChunkLevelSyntheticDatasetGenerator, TokenLevelSyntheticDatasetGenerator exports)

## 3. Update Tests

- [x] 3.1 Delete `packages/eval-lib/tests/unit/synthetic-datagen/generators.test.ts` (functionality covered by assigners.test.ts)

## 4. Verify

- [x] 4.1 Run `pnpm build` to verify no broken imports
- [x] 4.2 Run `pnpm test` to verify all tests pass
- [x] 4.3 Run `pnpm typecheck` to verify TypeScript compilation (pre-existing unused var warning in unrelated file)
