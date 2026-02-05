## Why

The current evaluation system computes metrics locally and returns aggregate scores as a plain object. LangSmith is used only as a data store for ground truth. This means there is no per-query score visibility, no experiment comparison, no retrieval tracing, and no persistent experiment history. By migrating the experiment runner to use LangSmith's `evaluate()` function with custom evaluators, we get per-query drill-down, side-by-side experiment comparison, full retrieval traces, and a foundation for future online evaluation — all without changing the core metric logic.

## What Changes

- Rename the local `evaluate()` function to `computeMetrics()` to avoid conflict with LangSmith SDK's `evaluate()`
- Create a LangSmith evaluator adapter layer that wraps each pure `Metric` into a LangSmith evaluator function
- Create a new LangSmith-based experiment runner that uses LangSmith's `evaluate()` as the execution engine
- Refactor the `Evaluation` class to decouple corpus loading, retriever creation, and experiment execution into modular pieces
- **BREAKING**: Remove the local-only `runExperiment()` function and `ExperimentResult` type in favor of the LangSmith-driven experiment runner
- Core metrics (recall, precision, IoU, F1) and their utilities remain unchanged — no LangSmith dependency

## Capabilities

### New Capabilities
- `langsmith-evaluators`: LangSmith evaluator adapter layer — wraps pure `Metric` functions into LangSmith evaluator format, handles span serialization/deserialization
- `langsmith-experiment-runner`: LangSmith-based experiment runner — initializes retriever, creates target function closure, runs evaluation through LangSmith's `evaluate()`, supports experiment naming by retriever config dimensions

### Modified Capabilities
- `evaluation`: Rename `evaluate()` to `computeMetrics()`, refactor `Evaluation` class into modular components
- `experiments`: Replace local `runExperiment()` with LangSmith-based experiment runner, keep `Retriever` interface and `VectorRAGRetriever` unchanged
- `langsmith-integration`: Extend existing upload/load with evaluator adapter functions

## Impact

- `packages/eval-lib/src/evaluation/evaluator.ts` — rename function
- `packages/eval-lib/src/evaluation/evaluation.ts` — refactor into modular pieces
- `packages/eval-lib/src/experiments/runner.ts` — replace with LangSmith-based runner
- `packages/eval-lib/src/langsmith/` — new evaluator adapter module, new experiment runner module
- `packages/eval-lib/src/experiments/types.ts` — update types for new runner
- All internal callers of `evaluate()` and `runExperiment()` — update to new names/APIs
- Test files — update for renamed functions and new runner
- `langsmith` npm package becomes a required (not optional) dependency for experiment running
