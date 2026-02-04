## REMOVED Requirements

### Requirement: Upload chunk-level dataset to LangSmith
**Reason**: Chunk-level evaluation is being removed entirely.
**Migration**: Use `uploadDataset` (formerly `uploadTokenLevelDataset`) instead.

### Requirement: Load chunk-level dataset from LangSmith
**Reason**: Chunk-level evaluation is being removed entirely.
**Migration**: Use `loadDataset` (formerly `loadTokenLevelDataset`) instead.

## MODIFIED Requirements

### Requirement: Upload dataset to LangSmith
The system SHALL provide `uploadDataset(groundTruth: GroundTruth[], datasetName?: string): Promise<string>` that creates a LangSmith dataset with examples containing `inputs: { query }` and `outputs: { relevantSpans }` where each span includes `docId`, `start`, `end`, and `text`.

#### Scenario: Upload preserves span data
- **WHEN** uploading ground truth with spans
- **THEN** each example's `outputs.relevantSpans` SHALL contain the full span data including `docId`, `start`, `end`, and `text`

#### Scenario: Default dataset name
- **WHEN** calling `uploadDataset(groundTruth)` without a name
- **THEN** the dataset SHALL be named `"rag-eval-dataset"`

### Requirement: Load dataset from LangSmith
The system SHALL provide `loadDataset(datasetName: string): Promise<GroundTruth[]>` that reads all examples from a LangSmith dataset and returns parsed `GroundTruth` objects with validated `CharacterSpan` values.

#### Scenario: Load and parse examples
- **WHEN** calling `loadDataset("my-dataset")`
- **THEN** the result SHALL be an array of `GroundTruth` with properly typed spans

## RENAMED Requirements

### Requirement: Upload dataset to LangSmith
- **FROM**: `uploadTokenLevelDataset`
- **TO**: `uploadDataset`

### Requirement: Load dataset from LangSmith
- **FROM**: `loadTokenLevelDataset`
- **TO**: `loadDataset`
