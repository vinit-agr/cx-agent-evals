## 1. Core Source Changes

- [x] 1.1 Rename `retrievedSpans` to `relevantSpans` in the target function output at `packages/eval-lib/src/langsmith/experiment-runner.ts:37`
- [x] 1.2 Update `args.outputs?.retrievedSpans` to `args.outputs?.relevantSpans` in `packages/eval-lib/src/langsmith/evaluator-adapters.ts:27`
- [x] 1.3 Rename `retrievedSpans` to `relevantSpans` in the `ExperimentResult` type at `packages/eval-lib/src/types/results.ts:10`

## 2. Test Updates

- [x] 2.1 Update `packages/eval-lib/tests/unit/langsmith/evaluator-adapters.test.ts` — change `retrievedSpans` references in test helper and test cases
- [x] 2.2 Update `packages/eval-lib/tests/unit/experiments/runner.test.ts` — change `retrievedSpans` in assertion at line 204
- [x] 2.3 Update `packages/eval-lib/tests/integration/evaluation.test.ts` — change `retrievedSpans` references in target function assertions

## 3. Verification

- [x] 3.1 Run `pnpm build` to verify compilation
- [x] 3.2 Run `pnpm test` to verify all tests pass
