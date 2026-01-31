## Purpose

Upload and load evaluation datasets to/from LangSmith.

## Requirements

### Requirement: Upload chunk-level dataset to LangSmith
The system SHALL provide `uploadChunkLevelDataset(groundTruth: ChunkLevelGroundTruth[], datasetName?: string): Promise<string>` that creates a LangSmith dataset and uploads each ground truth entry as an example with `inputs: { query }` and `outputs: { relevantChunkIds }`. The `langsmith` package SHALL be loaded via dynamic `import()`.

#### Scenario: Upload creates dataset and examples
- **WHEN** calling `uploadChunkLevelDataset(groundTruth, "my-chunk-dataset")`
- **THEN** a LangSmith dataset named `"my-chunk-dataset"` SHALL be created with one example per ground truth entry

#### Scenario: Default dataset name
- **WHEN** calling `uploadChunkLevelDataset(groundTruth)` without a name
- **THEN** the dataset SHALL be named `"rag-eval-chunk-level"`

### Requirement: Upload token-level dataset to LangSmith
The system SHALL provide `uploadTokenLevelDataset(groundTruth: TokenLevelGroundTruth[], datasetName?: string): Promise<string>` that creates a LangSmith dataset with examples containing `inputs: { query }` and `outputs: { relevantSpans }` where each span includes `docId`, `start`, `end`, and `text`.

#### Scenario: Upload preserves span data
- **WHEN** uploading token-level ground truth with spans
- **THEN** each example's `outputs.relevantSpans` SHALL contain the full span data including `docId`, `start`, `end`, and `text`

### Requirement: Load chunk-level dataset from LangSmith
The system SHALL provide `loadChunkLevelDataset(datasetName: string): Promise<ChunkLevelGroundTruth[]>` that reads all examples from a LangSmith dataset and returns parsed `ChunkLevelGroundTruth` objects with branded types.

#### Scenario: Load and parse chunk-level examples
- **WHEN** calling `loadChunkLevelDataset("my-chunk-dataset")`
- **THEN** the result SHALL be an array of `ChunkLevelGroundTruth` with properly branded `QueryId`, `QueryText`, and `ChunkId` values

### Requirement: Load token-level dataset from LangSmith
The system SHALL provide `loadTokenLevelDataset(datasetName: string): Promise<TokenLevelGroundTruth[]>` that reads all examples from a LangSmith dataset and returns parsed `TokenLevelGroundTruth` objects with validated `CharacterSpan` values.

#### Scenario: Load and parse token-level examples
- **WHEN** calling `loadTokenLevelDataset("my-token-dataset")`
- **THEN** the result SHALL be an array of `TokenLevelGroundTruth` with properly typed spans

### Requirement: LangSmith client shared initialization
The system SHALL provide a shared `getLangSmithClient()` function that loads the `langsmith` package via dynamic `import()` and returns a `Client` instance. It SHALL throw a descriptive error if the package is not installed.

#### Scenario: Missing langsmith package
- **WHEN** `getLangSmithClient()` is called and `langsmith` is not installed
- **THEN** it SHALL throw an error with installation instructions
