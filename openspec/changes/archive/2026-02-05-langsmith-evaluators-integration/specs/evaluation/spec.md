## RENAMED Requirements

### Requirement: Pure evaluate function
- **FROM:** `evaluate`
- **TO:** `computeMetrics`

## MODIFIED Requirements

### Requirement: Pure computeMetrics function
The system SHALL provide a pure function `computeMetrics(options: { results: Array<{ retrieved: CharacterSpan[], groundTruth: CharacterSpan[] }>, metrics: Metric[] }): Record<string, number>` that computes metric scores for each result and returns averaged scores. It SHALL perform no I/O operations.

#### Scenario: Compute metrics for results
- **WHEN** calling `computeMetrics({ results, metrics })`
- **THEN** the function SHALL compute each metric for each result and return averaged scores

#### Scenario: Empty results returns zeros
- **WHEN** calling `computeMetrics({ results: [], metrics })`
- **THEN** the function SHALL return metric scores of `0` for each metric

## REMOVED Requirements

### Requirement: Evaluation orchestrator
**Reason**: The `Evaluation` class coupled corpus loading, retriever creation, and experiment execution. This is replaced by the modular `runLangSmithExperiment()` function in the `langsmith-experiment-runner` capability.
**Migration**: Use `runLangSmithExperiment()` from the new langsmith experiment runner module. Pass corpus, retriever, k, datasetName, and metrics directly.
