## Why

The experiment target function returns spans under the key `retrievedSpans`, while the dataset reference outputs use `relevantSpans`. This causes every span to show as a diff in LangSmith's comparison view, even when the actual span content matches. Aligning the key names makes the diff view show only meaningful content differences.

## What Changes

- Rename the output key in the experiment target function from `retrievedSpans` to `relevantSpans`
- Update the evaluator adapters to read generated spans from `outputs.relevantSpans` instead of `outputs.retrievedSpans`
- Update the `ExperimentResult` type to use `relevantSpans` as the property name
- Update all tests referencing `retrievedSpans` to use `relevantSpans`

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `langsmith-experiment-runner`: The target function output key changes from `retrievedSpans` to `relevantSpans`
- `langsmith-evaluators`: The evaluator reads generated spans from `outputs.relevantSpans` instead of `outputs.retrievedSpans`

## Impact

- `packages/eval-lib/src/langsmith/experiment-runner.ts` — target function output key
- `packages/eval-lib/src/langsmith/evaluator-adapters.ts` — evaluator span extraction
- `packages/eval-lib/src/types/results.ts` — `ExperimentResult` type
- `packages/eval-lib/tests/` — test assertions referencing `retrievedSpans`
- OpenSpec specs for `langsmith-experiment-runner` and `langsmith-evaluators`
