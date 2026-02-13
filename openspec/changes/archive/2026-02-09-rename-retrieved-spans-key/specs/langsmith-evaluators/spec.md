## MODIFIED Requirements

### Requirement: Create LangSmith evaluator from Metric
The system SHALL provide a `createLangSmithEvaluator(metric: Metric)` function that returns a LangSmith evaluator function. The returned evaluator SHALL accept a `run` object and an `example` object, extract `relevantSpans` from `run.outputs` and `relevantSpans` from `example.outputs`, deserialize them into typed `CharacterSpan[]` arrays, call `metric.calculate(retrieved, groundTruth)`, and return `{ key: metric.name, score }`.

#### Scenario: Wrap recall metric as LangSmith evaluator
- **WHEN** calling `createLangSmithEvaluator(recall)` and invoking the result with a run containing `outputs.relevantSpans` and an example containing `outputs.relevantSpans`
- **THEN** the evaluator SHALL return `{ key: "recall", score: <calculated recall value> }`

#### Scenario: Deserialize spans from plain JSON
- **WHEN** the evaluator receives `run.outputs.relevantSpans` as plain JSON objects `[{docId, start, end, text}]`
- **THEN** it SHALL convert them to typed `CharacterSpan[]` with branded `DocumentId` values before passing to `metric.calculate()`
