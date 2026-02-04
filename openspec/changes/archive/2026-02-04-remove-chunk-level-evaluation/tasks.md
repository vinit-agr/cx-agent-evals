## 1. Remove Chunk-Level Types

- [x] 1.1 Delete `ChunkId` type and factory function from `src/types/primitives.ts`
- [x] 1.2 Delete `EvaluationType` type from `src/types/primitives.ts`
- [x] 1.3 Delete `ChunkLevelGroundTruth` interface from `src/types/ground-truth.ts`
- [x] 1.4 Delete `ChunkLevelDatasetExample` interface from `src/types/ground-truth.ts`
- [x] 1.5 Delete `ChunkLevelDatasetExampleSchema` Zod schema from `src/types/ground-truth.ts`
- [x] 1.6 Rename `TokenLevelGroundTruth` to `GroundTruth` in `src/types/ground-truth.ts`
- [x] 1.7 Rename `TokenLevelDatasetExample` to `DatasetExample` in `src/types/ground-truth.ts`
- [x] 1.8 Rename `TokenLevelDatasetExampleSchema` to `DatasetExampleSchema` in `src/types/ground-truth.ts`
- [x] 1.9 Update `src/types/index.ts` exports (remove chunk-level, rename token-level)

## 2. Remove Chunk-Level Metrics

- [x] 2.1 Delete `src/evaluation/metrics/chunk-level/` folder entirely
- [x] 2.2 Move files from `src/evaluation/metrics/token-level/` to `src/evaluation/metrics/`
- [x] 2.3 Delete empty `src/evaluation/metrics/token-level/` folder
- [x] 2.4 Rename `spanRecall` to `recall` and change metric name to `"recall"`
- [x] 2.5 Rename `spanPrecision` to `precision` and change metric name to `"precision"`
- [x] 2.6 Rename `spanIoU` to `iou` and change metric name to `"iou"`
- [x] 2.7 Rename `spanF1` to `f1` and change metric name to `"f1"` (if exists)
- [x] 2.8 Rename `TokenLevelMetric` to `Metric` in `src/evaluation/metrics/base.ts`
- [x] 2.9 Delete `ChunkLevelMetric` from `src/evaluation/metrics/base.ts`
- [x] 2.10 Update `src/evaluation/metrics/index.ts` exports

## 3. Remove Chunk-Level Evaluation Class

- [x] 3.1 Delete `src/evaluation/chunk-level.ts` entirely
- [x] 3.2 Rename `src/evaluation/token-level.ts` to `src/evaluation/evaluation.ts`
- [x] 3.3 Rename `TokenLevelEvaluation` class to `Evaluation`
- [x] 3.4 Rename `TokenLevelEvaluationConfig` to `EvaluationConfig`
- [x] 3.5 Rename `TokenLevelRunOptions` to `RunOptions`
- [x] 3.6 Remove `ChunkerPositionAdapter` usage (require `PositionAwareChunker` directly)
- [x] 3.7 Rename `evaluateTokenLevel` to `evaluate` in `src/evaluation/evaluator.ts`
- [x] 3.8 Delete `evaluateChunkLevel` function from `src/evaluation/evaluator.ts`
- [x] 3.9 Rename `TokenLevelEvaluateOptions` to `EvaluateOptions`
- [x] 3.10 Update `src/evaluation/index.ts` exports

## 4. Simplify Experiments Module

- [x] 4.1 Remove `ChunkLevelExperimentConfig` from `src/experiments/types.ts`
- [x] 4.2 Rename `TokenLevelExperimentConfig` to `ExperimentConfig` (remove discriminated union)
- [x] 4.3 Remove `evaluationType` field from `ExperimentConfig`
- [x] 4.4 Update `src/experiments/runner.ts` to remove chunk-level branch
- [x] 4.5 Remove `paChunkToChunkId` function from runner
- [x] 4.6 Update default metrics to `[recall, precision, iou]`
- [x] 4.7 Update `VectorRAGRetriever` to require `PositionAwareChunker`
- [x] 4.8 Update `src/experiments/index.ts` exports

## 5. Remove Chunk-Level Synthetic Datagen

- [x] 5.1 Delete `src/synthetic-datagen/ground-truth/chunk-level.ts`
- [x] 5.2 Rename `TokenLevelGroundTruthAssigner` to `GroundTruthAssigner`
- [x] 5.3 Remove `evaluationType` parameter from `generate()` function in `src/synthetic-datagen/index.ts`
- [x] 5.4 Update `src/synthetic-datagen/index.ts` exports
- [x] 5.5 Delete `ChunkLevelAssigner` type from `src/synthetic-datagen/ground-truth/types.ts`

## 6. Remove Chunk-Level LangSmith Functions

- [x] 6.1 Delete `uploadChunkLevelDataset` from `src/langsmith/upload.ts`
- [x] 6.2 Rename `uploadTokenLevelDataset` to `uploadDataset`
- [x] 6.3 Update default dataset name to `"rag-eval-dataset"`
- [x] 6.4 Delete `loadChunkLevelDataset` from `src/langsmith/client.ts`
- [x] 6.5 Rename `loadTokenLevelDataset` to `loadDataset`
- [x] 6.6 Update `src/langsmith/index.ts` exports

## 7. Remove Chunker Adapter

- [x] 7.1 Delete `src/chunkers/adapter.ts` (ChunkerPositionAdapter)
- [x] 7.2 Update `src/chunkers/index.ts` exports
- [x] 7.3 Update any code that uses ChunkerPositionAdapter to require PositionAwareChunker

## 8. Update Frontend

- [x] 8.1 Delete `src/components/ModeSelect.tsx`
- [x] 8.2 Remove `mode` state and `EvalMode` type usage from `src/app/page.tsx`
- [x] 8.3 Remove mode selection UI, show corpus loader directly
- [x] 8.4 Remove mode parameter from API calls in `page.tsx`
- [x] 8.5 Remove mode-related conditionals from `page.tsx`
- [x] 8.6 Remove `mode` parameter handling from `src/app/api/generate/route.ts`
- [x] 8.7 Remove chunk-level branches from generate API route
- [x] 8.8 Delete `EvalMode` type from `src/lib/types.ts`
- [x] 8.9 Remove mode indicator from Header component
- [x] 8.10 Remove chunk size/overlap inputs from GenerateConfig (if mode-dependent)

## 9. Update Main Exports

- [x] 9.1 Update `packages/eval-lib/src/index.ts` to remove all chunk-level exports
- [x] 9.2 Update `packages/eval-lib/src/index.ts` to use renamed exports
- [x] 9.3 Verify all public API exports are correct

## 10. Update Tests

- [x] 10.1 Delete `tests/unit/metrics/chunk-metrics.test.ts`
- [x] 10.2 Update `tests/unit/evaluation/evaluator.test.ts` (remove chunk-level tests, rename functions)
- [x] 10.3 Update `tests/unit/experiments/runner.test.ts` (remove chunk-level tests)
- [x] 10.4 Update `tests/integration/evaluation.test.ts` (remove ChunkLevelEvaluation tests)
- [x] 10.5 Update `tests/unit/langsmith/langsmith.test.ts` (remove chunk-level tests, rename functions)
- [x] 10.6 Update `tests/unit/synthetic-datagen/ground-truth/assigners.test.ts` (remove chunk-level tests)
- [x] 10.7 Update `tests/unit/types/core-types.test.ts` (remove ChunkId tests if any)
- [x] 10.8 Update metric test imports and assertions to use new names
- [x] 10.9 Run all tests and fix any remaining failures

## 11. Update Documentation

- [x] 11.1 Update `packages/eval-lib/README.md` (remove chunk-level references) - Skipped (no README exists)
- [x] 11.2 Update `CLAUDE.md` (remove chunk-level from architecture notes)
- [x] 11.3 Update OpenSpec main specs during archive - Deferred to archive phase

## 12. Final Verification

- [x] 12.1 Run `pnpm build` and verify no TypeScript errors
- [x] 12.2 Run `pnpm test` and verify all tests pass
- [x] 12.3 Run `pnpm -C packages/frontend build` and verify frontend builds
- [x] 12.4 Manual test: Start frontend, load corpus, generate questions
