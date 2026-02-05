## ADDED Requirements

### Requirement: Re-export evaluator adapters
The langsmith module SHALL re-export `createLangSmithEvaluator` and `createLangSmithEvaluators` from the evaluator adapter module, making them accessible through the existing `langsmith/` import path.

#### Scenario: Import evaluator adapter from langsmith module
- **WHEN** importing `createLangSmithEvaluator` from the langsmith module
- **THEN** it SHALL be available without knowing the internal adapter module path

### Requirement: Re-export experiment runner
The langsmith module SHALL re-export `runLangSmithExperiment` and `LangSmithExperimentConfig` from the experiment runner module.

#### Scenario: Import experiment runner from langsmith module
- **WHEN** importing `runLangSmithExperiment` from the langsmith module
- **THEN** it SHALL be available through the langsmith module's public API
