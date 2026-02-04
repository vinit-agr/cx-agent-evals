## REMOVED Requirements

### Requirement: ChunkLevelSyntheticDatasetGenerator
**Reason**: Chunk-level evaluation is being removed entirely.
**Migration**: Use the span-based `GroundTruthAssigner` (formerly `TokenLevelGroundTruthAssigner`) instead.

## MODIFIED Requirements

### Requirement: SyntheticDatasetGenerator
The system SHALL provide span-based synthetic data generation by composing a `QuestionStrategy` with the `GroundTruthAssigner`. The assigner SHALL retain existing behavior: LLM-based verbatim excerpt extraction, exact string matching with whitespace-normalized fallback, and span validation. The `evaluationType` parameter SHALL NOT be required (always span-based).

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

## RENAMED Requirements

### Requirement: SyntheticDatasetGenerator
- **FROM**: `TokenLevelGroundTruthAssigner`
- **TO**: `GroundTruthAssigner`
