## Context

The experiment target function in `experiment-runner.ts` returns spans under the key `retrievedSpans`, while the dataset reference outputs (uploaded via `upload.ts`) use `relevantSpans`. The evaluator adapters bridge this by reading `outputs.retrievedSpans` for generated and `referenceOutputs.relevantSpans` for ground truth. LangSmith's diff view compares reference vs generated outputs structurally, so the key name mismatch causes every span to appear as a diff even when content matches.

## Goals / Non-Goals

**Goals:**
- Align the experiment target output key with the dataset reference output key so LangSmith diff view shows only content differences
- Update evaluator adapters to read from the new key name
- Update the `ExperimentResult` type and all test references

**Non-Goals:**
- Changing the dataset upload format (already uses `relevantSpans`)
- Changing internal type names like `GroundTruth.relevantSpans` (already correct)
- Re-running existing experiments (they'll use the old key; new experiments will be correct)

## Decisions

**Use `relevantSpans` as the unified key name.**
The dataset side already uses `relevantSpans`. Changing the target output to match is the simpler direction — one side changes instead of two. The semantic distinction between "relevant" (ground truth) and "retrieved" (generated) is useful in internal code but unnecessary in the LangSmith output structure, where the reference/generated distinction is already captured by the `referenceOutputs` vs `outputs` containers.

## Risks / Trade-offs

- [Existing experiment results use `retrievedSpans`] → No migration needed. Old experiments remain readable. New experiments will use the new key. The evaluator only needs to handle one key name since old and new experiments won't be mixed in a single run.
