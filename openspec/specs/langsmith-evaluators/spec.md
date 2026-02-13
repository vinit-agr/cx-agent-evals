## Purpose

Vendor-agnostic adapter layer that wraps pure Metric functions into LangSmith evaluator format for use with LangSmith's evaluate() function.

## Requirements

### Requirement: Create LangSmith evaluator from Metric
The system SHALL provide a `createLangSmithEvaluator(metric: Metric)` function that returns a LangSmith evaluator function. The returned evaluator SHALL accept a `run` object and an `example` object, extract `relevantSpans` from `run.outputs` and `relevantSpans` from `example.outputs`, deserialize them into typed `CharacterSpan[]` arrays, call `metric.calculate(retrieved, groundTruth)`, and return `{ key: metric.name, score }`.

#### Scenario: Wrap recall metric as LangSmith evaluator
- **WHEN** calling `createLangSmithEvaluator(recall)` and invoking the result with a run containing `outputs.relevantSpans` and an example containing `outputs.relevantSpans`
- **THEN** the evaluator SHALL return `{ key: "recall", score: <calculated recall value> }`

#### Scenario: Wrap any custom metric
- **WHEN** calling `createLangSmithEvaluator(customMetric)` where `customMetric.name` is `"my-metric"`
- **THEN** the returned evaluator SHALL use `"my-metric"` as the `key` in its result

#### Scenario: Deserialize spans from plain JSON
- **WHEN** the evaluator receives `run.outputs.relevantSpans` as plain JSON objects `[{docId, start, end, text}]`
- **THEN** it SHALL convert them to typed `CharacterSpan[]` with branded `DocumentId` values before passing to `metric.calculate()`

### Requirement: Create multiple LangSmith evaluators from Metric array
The system SHALL provide a `createLangSmithEvaluators(metrics: Metric[])` function that returns an array of LangSmith evaluator functions by mapping `createLangSmithEvaluator` over the metrics array.

#### Scenario: Create evaluators for default metrics
- **WHEN** calling `createLangSmithEvaluators([recall, precision, iou, f1])`
- **THEN** the result SHALL be an array of 4 LangSmith evaluator functions

### Requirement: No LangSmith dependency in adapter module
The `createLangSmithEvaluator` function SHALL NOT import from the `langsmith` package. It SHALL only depend on the `Metric` interface and `CharacterSpan` types from the core eval-lib. The adapter produces plain functions that conform to LangSmith's expected evaluator signature.

#### Scenario: Adapter has no langsmith import
- **WHEN** inspecting the adapter module's imports
- **THEN** there SHALL be no import from `langsmith` or `langsmith/*`
