## MODIFIED Requirements

### Requirement: Generation configuration controls
The UI SHALL expose configuration inputs before generation. The controls displayed SHALL depend on the selected strategy:
- **Simple strategy**: Questions per document (number, default 10, range 1-50), chunk size and overlap (chunk mode only)
- **Dimension-driven strategy**: Dimension summary with Edit button, total questions (number, default 50, min 1), chunk size and overlap (chunk mode only)

#### Scenario: Default configuration values shown
- **WHEN** user reaches the generation view with Simple strategy selected
- **THEN** inputs display default values: 10 questions, 1000 chunk size, 200 overlap

#### Scenario: Chunker config hidden in token-level mode
- **WHEN** evaluation mode is "token"
- **THEN** chunk size and chunk overlap inputs are not displayed (regardless of strategy)

#### Scenario: Dimension-driven configuration shown
- **WHEN** user has Dimension-Driven strategy selected with dimensions configured
- **THEN** a compact summary shows dimension count and names, an Edit button, and a total questions input (default 50)

### Requirement: Generate button triggers question generation
A "Generate Questions" button SHALL start synthetic question generation using the selected strategy. For Simple strategy, it sends queriesPerDoc. For Dimension-Driven strategy, it sends the dimensions array and totalQuestions. The button SHALL be disabled while generation is in progress, when no corpus is loaded, or when Dimension-Driven is selected but not configured.

#### Scenario: Generation starts with simple strategy
- **WHEN** user clicks "Generate Questions" with Simple strategy and a loaded corpus
- **THEN** the request includes `strategy: "simple"` and `questionsPerDoc`

#### Scenario: Generation starts with dimension-driven strategy
- **WHEN** user clicks "Generate Questions" with Dimension-Driven strategy configured
- **THEN** the request includes `strategy: "dimension-driven"`, `dimensions`, and `totalQuestions`

#### Scenario: Generate disabled without dimensions
- **WHEN** Dimension-Driven strategy is selected but dimensions are not configured
- **THEN** the "Generate Questions" button is disabled

### Requirement: Real-time streaming of generated questions
Generated questions SHALL appear in the UI as they are produced (via SSE), not after all generation completes. Each question SHALL display the question text and which document it was generated from.

#### Scenario: Questions stream in one by one
- **WHEN** generation is in progress for a corpus of 3 documents at 2 questions each
- **THEN** questions appear incrementally as the backend produces them, showing up to 6 total

#### Scenario: Generation completes
- **WHEN** all documents have been processed
- **THEN** the progress indicator disappears, the button re-enables, and a summary shows total questions generated
