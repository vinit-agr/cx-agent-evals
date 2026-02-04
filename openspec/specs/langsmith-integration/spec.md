## Purpose

Upload and load evaluation datasets to/from LangSmith.

## Requirements

### Requirement: Upload dataset to LangSmith
The system SHALL provide `uploadDataset(groundTruth: GroundTruth[], datasetName?: string): Promise<string>` that creates a LangSmith dataset with examples containing `inputs: { query }` and `outputs: { relevantSpans }` where each span includes `docId`, `start`, `end`, and `text`. The `langsmith` package SHALL be loaded via dynamic `import()`.

#### Scenario: Upload creates dataset and examples
- **WHEN** calling `uploadDataset(groundTruth, "my-dataset")`
- **THEN** a LangSmith dataset named `"my-dataset"` SHALL be created with one example per ground truth entry

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

### Requirement: LangSmith client shared initialization
The system SHALL provide a shared `getLangSmithClient()` function that loads the `langsmith` package via dynamic `import()` and returns a `Client` instance. It SHALL throw a descriptive error if the package is not installed.

#### Scenario: Missing langsmith package
- **WHEN** `getLangSmithClient()` is called and `langsmith` is not installed
- **THEN** it SHALL throw an error with installation instructions
