## ADDED Requirements

### Requirement: Generation configuration controls
The UI SHALL expose configuration inputs before generation:
- **Questions per document**: number input, default 10, range 1-50
- **Chunk size** (chunk-level mode only): number input, default 1000, range 100-10000
- **Chunk overlap** (chunk-level mode only): number input, default 200, range 0 to chunk size minus 1

#### Scenario: Default configuration values shown
- **WHEN** user reaches the generation view
- **THEN** inputs display default values: 10 questions, 1000 chunk size, 200 overlap

#### Scenario: Chunker config hidden in token-level mode
- **WHEN** evaluation mode is "token"
- **THEN** chunk size and chunk overlap inputs are not displayed

### Requirement: Generate button triggers question generation
A "Generate Questions" button SHALL start synthetic question generation for all documents in the corpus. The button SHALL be disabled while generation is in progress and show a progress indicator.

#### Scenario: Generation starts on click
- **WHEN** user clicks "Generate Questions" with a loaded corpus
- **THEN** the button becomes disabled, a progress indicator appears, and questions begin streaming in

#### Scenario: Generate disabled without corpus
- **WHEN** no corpus is loaded
- **THEN** the "Generate Questions" button is disabled

### Requirement: Real-time streaming of generated questions
Generated questions SHALL appear in the UI as they are produced (via SSE), not after all generation completes. Each question SHALL display the question text and which document it was generated from.

#### Scenario: Questions stream in one by one
- **WHEN** generation is in progress for a corpus of 3 documents at 2 questions each
- **THEN** questions appear incrementally as the backend produces them, showing up to 6 total

#### Scenario: Generation completes
- **WHEN** all documents have been processed
- **THEN** the progress indicator disappears, the button re-enables, and a summary shows total questions generated
