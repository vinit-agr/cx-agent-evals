## REMOVED Requirements

### Requirement: runExperiment function
**Reason**: Replaced by `runLangSmithExperiment()` which runs experiments through LangSmith's `evaluate()` function, providing per-query scores, retrieval traces, and experiment comparison.
**Migration**: Use `runLangSmithExperiment()` from the langsmith experiment runner module. The `Retriever` interface and `VectorRAGRetriever` remain unchanged.

### Requirement: ExperimentConfig type
**Reason**: Replaced by `LangSmithExperimentConfig` which includes `datasetName` and `experimentPrefix` instead of inline `groundTruth`.
**Migration**: Use `LangSmithExperimentConfig` from the langsmith experiment runner module. Ground truth is loaded from the LangSmith dataset automatically.

### Requirement: ExperimentResult type
**Reason**: Experiment results are now stored in LangSmith with per-query scores and traces. There is no local result type needed.
**Migration**: Access experiment results through the LangSmith UI or API. The `evaluate()` return value provides programmatic access to results.

### Requirement: Default metrics
**Reason**: Default metrics are now defined in the langsmith experiment runner config, with f1 added to the default set: `[recall, precision, iou, f1]`.
**Migration**: No action needed — the new runner uses a superset of the previous defaults.
