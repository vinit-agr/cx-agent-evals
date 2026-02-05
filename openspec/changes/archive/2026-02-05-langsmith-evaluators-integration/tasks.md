## 1. Rename evaluate to computeMetrics

- [x] 1.1 Rename `evaluate` function to `computeMetrics` in `packages/eval-lib/src/evaluation/evaluator.ts` and update the `EvaluateOptions` type to `ComputeMetricsOptions`
- [x] 1.2 Update all internal imports/callers of `evaluate` to use `computeMetrics` (runner.ts, evaluation.ts, index re-exports, tests)
- [x] 1.3 Run tests to verify rename is non-breaking

## 2. LangSmith Evaluator Adapters

- [x] 2.1 Create `packages/eval-lib/src/langsmith/evaluator-adapters.ts` with `createLangSmithEvaluator(metric: Metric)` that wraps a Metric into a LangSmith evaluator function — deserializes spans from plain JSON, calls `metric.calculate()`, returns `{ key, score }`
- [x] 2.2 Add `createLangSmithEvaluators(metrics: Metric[])` convenience function in the same module
- [x] 2.3 Write tests for the evaluator adapters — verify span deserialization, score passthrough, key naming

## 3. LangSmith Experiment Runner

- [x] 3.1 Define `LangSmithExperimentConfig` type in `packages/eval-lib/src/langsmith/experiment-runner.ts` with corpus, retriever, k, datasetName, optional metrics/experimentPrefix/metadata
- [x] 3.2 Implement `runLangSmithExperiment(config)` — init retriever, create target closure, wrap metrics as evaluators, call LangSmith `evaluate()`, cleanup retriever in finally block
- [x] 3.3 Implement the target function that takes `{ query }` input, calls `retriever.retrieve()`, converts chunks to serialized span objects
- [x] 3.4 Add experiment naming logic — use experimentPrefix or fall back to retriever name, include metadata (retriever name, k, corpusSize)

## 4. Remove Old Experiment Runner and Evaluation Class

- [x] 4.1 Remove `runExperiment()` function from `packages/eval-lib/src/experiments/runner.ts`
- [x] 4.2 Remove `ExperimentConfig` and `ExperimentResult` types from `packages/eval-lib/src/experiments/types.ts`
- [x] 4.3 Remove the `Evaluation` class from `packages/eval-lib/src/evaluation/evaluation.ts`
- [x] 4.4 Update index re-exports to remove old exports and add new ones

## 5. Module Re-exports and Public API

- [x] 5.1 Re-export `createLangSmithEvaluator`, `createLangSmithEvaluators`, `runLangSmithExperiment`, and `LangSmithExperimentConfig` from the langsmith module index
- [x] 5.2 Update the top-level `packages/eval-lib/src/index.ts` to export the new public API and remove old experiment runner exports
- [x] 5.3 Verify `langsmith` package is listed as a dependency (not just optional) in eval-lib's package.json

## 6. Update Tests

- [x] 6.1 Remove or update tests for the old `runExperiment()` and `Evaluation` class
- [x] 6.2 Add integration-style tests for `runLangSmithExperiment()` (mocking LangSmith's `evaluate()`)
- [x] 6.3 Run full test suite and fix any remaining breakage

## 7. Build and Verify

- [x] 7.1 Run `pnpm build` and fix any TypeScript compilation errors
- [x] 7.2 Run `pnpm typecheck` to verify no type errors (pre-existing unused var in matching.ts, unrelated)
- [x] 7.3 Run `pnpm test` to verify all tests pass
