## MODIFIED Requirements

### Requirement: ChunkLevelSyntheticDatasetGenerator
The system SHALL provide chunk-level synthetic data generation by composing a `QuestionStrategy` with the `ChunkLevelGroundTruthAssigner`. The chunk-level assigner SHALL retain existing behavior: SHA256-based chunk IDs, LLM-based chunk ID assignment, and invalid ID filtering. The legacy `ChunkLevelSyntheticDatasetGenerator` class SHALL NOT be exported.

#### Scenario: Generate chunk-level ground truth
- **WHEN** calling the generation pipeline with a strategy and chunk-level evaluation type
- **THEN** the result SHALL be an array of `ChunkLevelGroundTruth` objects, each with a query and valid chunk IDs

#### Scenario: Invalid chunk IDs are filtered out
- **WHEN** the LLM returns a chunk ID that does not exist in the chunk index
- **THEN** that ID SHALL be excluded from the ground truth entry

#### Scenario: Upload to LangSmith
- **WHEN** calling generate with `uploadToLangsmith: true`
- **THEN** the ground truth SHALL be uploaded to a LangSmith dataset

### Requirement: TokenLevelSyntheticDatasetGenerator
The system SHALL provide token-level synthetic data generation by composing a `QuestionStrategy` with the `TokenLevelGroundTruthAssigner`. The token-level assigner SHALL retain existing behavior: LLM-based verbatim excerpt extraction, exact string matching with whitespace-normalized fallback, and span validation. The legacy `TokenLevelSyntheticDatasetGenerator` class SHALL NOT be exported.

#### Scenario: Generate token-level ground truth
- **WHEN** calling the generation pipeline with a strategy and token-level evaluation type
- **THEN** the result SHALL be an array of `TokenLevelGroundTruth` objects, each with a query and `CharacterSpan` array

#### Scenario: Span text matches source document
- **WHEN** a span is generated with `start` and `end`
- **THEN** `document.content.slice(span.start, span.end)` SHALL equal `span.text`

#### Scenario: Unfound excerpts are skipped
- **WHEN** the LLM returns an excerpt that cannot be located in the source document
- **THEN** that excerpt SHALL be skipped and a warning SHALL be logged

#### Scenario: Whitespace-normalized fallback matching
- **WHEN** exact `indexOf` fails for an excerpt
- **THEN** the system SHALL attempt whitespace-normalized case-insensitive matching before giving up
