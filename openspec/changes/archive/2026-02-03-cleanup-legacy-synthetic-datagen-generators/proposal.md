## Why

The synthetic-datagen module was restructured to separate question generation strategies from ground-truth assignment. The new architecture uses `QuestionStrategy` + `GroundTruthAssigner` composition, but the legacy monolithic generators (`ChunkLevelSyntheticDatasetGenerator`, `TokenLevelSyntheticDatasetGenerator`) were kept for backward compatibility. These legacy classes duplicate logic now handled by the decoupled assigners, cluttering the codebase with unused code.

## What Changes

- **BREAKING**: Remove `ChunkLevelSyntheticDatasetGenerator` class and its folder (`synthetic-datagen/chunk-level/`)
- **BREAKING**: Remove `TokenLevelSyntheticDatasetGenerator` class and its folder (`synthetic-datagen/token-level/`)
- Remove legacy exports from `src/index.ts` and `src/synthetic-datagen/index.ts`
- Delete legacy test file `tests/unit/synthetic-datagen/generators.test.ts` (functionality already covered by `assigners.test.ts`)

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `synthetic-datagen`: Remove legacy generator requirements since they are replaced by strategy + assigner composition

## Impact

- **Exports removed**: `ChunkLevelSyntheticDatasetGenerator`, `TokenLevelSyntheticDatasetGenerator` will no longer be exported from the library
- **External consumers**: Any external code importing these classes will break (internal usage already migrated to strategy-based approach)
- **Test coverage**: No loss — the `assigners.test.ts` file covers the same scenarios as the deleted `generators.test.ts`
