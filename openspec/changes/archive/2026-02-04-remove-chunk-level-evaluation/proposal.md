## Why

The dual evaluation system (chunk-level and token-level) creates unnecessary complexity throughout the codebase. Every feature—synthetic data generation, metrics calculation, experiments, frontend UI—must branch on evaluation type. Token-level evaluation is strictly more informative (measures character-level overlap vs binary chunk matching), making chunk-level redundant. Removing chunk-level simplifies the architecture and reduces maintenance burden.

## What Changes

- **BREAKING**: Remove all chunk-level evaluation code, types, and APIs
- **BREAKING**: Remove `ChunkId` type and chunk ID-based ground truth
- **BREAKING**: Remove `EvaluationType` discriminated union (no longer needed)
- **BREAKING**: Remove frontend mode selection (chunk vs token)
- Rename `TokenLevel*` types/functions to simpler names (e.g., `GroundTruth`, `Evaluation`, `evaluate`)
- Rename span metrics from `span_*` to simpler names (`recall`, `precision`, `iou`, `f1`)
- Move token-level metrics from `metrics/token-level/` to `metrics/`
- Require all chunkers to be `PositionAwareChunker` (remove basic chunker adapter)
- Simplify `ExperimentConfig` to single type (remove discriminated union)

## Capabilities

### New Capabilities

None - this is a simplification/removal change.

### Modified Capabilities

- `evaluation`: Remove `ChunkLevelEvaluation` class, rename `TokenLevelEvaluation` to `Evaluation`, update metric names
- `experiments`: Remove chunk-level experiment config, simplify to single `ExperimentConfig` type
- `metrics`: Remove chunk-level metrics folder, rename span metrics to simpler names
- `core-types`: Remove `ChunkId`, `EvaluationType`, `ChunkLevelGroundTruth`; rename token-level types
- `synthetic-datagen`: Remove chunk-level ground truth assigner, rename token-level assigner
- `langsmith-integration`: Remove chunk-level upload/load functions, rename token-level functions
- `frontend-app-shell`: Remove mode selection, simplify to single generation flow
- `question-generation-ui`: Remove mode-dependent logic and chunk-level branches

## Impact

**Eval-lib package:**
- Delete: `src/evaluation/chunk-level.ts`, `src/evaluation/metrics/chunk-level/` folder, `src/synthetic-datagen/ground-truth/chunk-level.ts`
- Rename: `src/evaluation/token-level.ts` → `evaluation.ts`, move metric files up from `token-level/`
- Modify: All type exports, all index files, experiment runner, evaluator functions

**Frontend package:**
- Delete: `src/components/ModeSelect.tsx`
- Modify: `page.tsx` (remove mode state), `api/generate/route.ts` (remove mode parameter), `lib/types.ts`

**Tests:**
- Delete: chunk-level metric tests, chunk-level evaluation tests
- Modify: All tests referencing chunk-level types or renamed functions

**Breaking for consumers:**
- Any code importing `ChunkId`, `ChunkLevelGroundTruth`, `ChunkLevelEvaluation`, or chunk metrics will break
- Any code using `evaluationType: "chunk-level"` will break
- Metric names change from `span_*` to simpler names
