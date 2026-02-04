## Purpose

Synthetic dataset generation for RAG evaluation using question generation strategies and span-based ground truth assignment.

## Requirements

### Requirement: SyntheticDatasetGenerator
The system SHALL provide span-based synthetic data generation by composing a `QuestionStrategy` with the `GroundTruthAssigner`. The assigner SHALL retain existing behavior: LLM-based verbatim excerpt extraction, exact string matching with whitespace-normalized fallback, and span validation.

#### Scenario: Generate ground truth
- **WHEN** calling the generation pipeline with a strategy
- **THEN** the result SHALL be an array of `GroundTruth` objects, each with a query and `CharacterSpan` array

#### Scenario: Span text matches source document
- **WHEN** a span is generated with `start` and `end`
- **THEN** `document.content.slice(span.start, span.end)` SHALL equal `span.text`

#### Scenario: Unfound excerpts are skipped
- **WHEN** the LLM returns an excerpt that cannot be located in the source document
- **THEN** that excerpt SHALL be skipped and a warning SHALL be logged

#### Scenario: Whitespace-normalized fallback matching
- **WHEN** exact `indexOf` fails for an excerpt
- **THEN** the system SHALL attempt whitespace-normalized case-insensitive matching before giving up

#### Scenario: Upload to LangSmith
- **WHEN** calling generate with `uploadToLangsmith: true`
- **THEN** the ground truth SHALL be uploaded to a LangSmith dataset

### Requirement: Simple prompt-based strategy
The system SHALL provide a `SimpleStrategy` implementing `QuestionStrategy` that generates questions using improved prompts with few-shot examples, question-type constraints, anti-patterns, and difficulty distribution guidance. It SHALL accept `queriesPerDoc` as configuration and iterate over corpus documents.

#### Scenario: Generate with queriesPerDoc
- **WHEN** calling `strategy.generate(context)` with `queriesPerDoc: 5` and a corpus of 3 documents
- **THEN** the strategy SHALL generate approximately 15 queries (5 per document)

#### Scenario: Improved prompt quality
- **WHEN** generating questions
- **THEN** the prompt SHALL include few-shot examples, question-type variety instructions, and anti-pattern guards

### Requirement: Base generator with shared LLM calling
The system SHALL provide a base `SyntheticDatasetGenerator` with a `callLLM(systemPrompt, userPrompt): Promise<string>` method that both strategies and ground-truth assigners can use. The model SHALL be configurable via constructor (default `"gpt-4o"`).

#### Scenario: Configurable model
- **WHEN** constructing a generator with `model: "gpt-4o-mini"`
- **THEN** all LLM calls SHALL use that model
