## MODIFIED Requirements

### Requirement: Generation configuration controls
The UI SHALL expose configuration inputs before generation. The controls displayed SHALL depend on the selected strategy:
- **Simple strategy**: Questions per document (number, default 10, range 1-50)
- **Dimension-driven strategy**: Dimension summary with Edit button, total questions (number, default 50, min 1)

Chunk size and overlap inputs SHALL NOT be displayed (chunking is handled internally with position tracking).

#### Scenario: Default configuration values shown
- **WHEN** user reaches the generation view with Simple strategy selected
- **THEN** inputs display default values: 10 questions

#### Scenario: No chunker config inputs
- **WHEN** user is on the generation view
- **THEN** chunk size and chunk overlap inputs SHALL NOT be displayed

#### Scenario: Dimension-driven configuration shown
- **WHEN** user has Dimension-Driven strategy selected with dimensions configured
- **THEN** a compact summary shows dimension count and names, an Edit button, and a total questions input (default 50)

### Requirement: Generate button triggers question generation
A "Generate Questions" button SHALL start synthetic question generation using the selected strategy. For Simple strategy, it sends queriesPerDoc. For Dimension-Driven strategy, it sends the dimensions array and totalQuestions. The button SHALL be disabled while generation is in progress, when no corpus is loaded, or when Dimension-Driven is selected but not configured. The `mode` parameter SHALL NOT be sent (always span-based).

#### Scenario: Generation starts with simple strategy
- **WHEN** user clicks "Generate Questions" with Simple strategy and a loaded corpus
- **THEN** the request includes `strategy: "simple"` and `questionsPerDoc` (no `mode` parameter)

#### Scenario: Generation starts with dimension-driven strategy
- **WHEN** user clicks "Generate Questions" with Dimension-Driven strategy configured
- **THEN** the request includes `strategy: "dimension-driven"`, `dimensions`, and `totalQuestions` (no `mode` parameter)

#### Scenario: Generate disabled without dimensions
- **WHEN** Dimension-Driven strategy is selected but dimensions are not configured
- **THEN** the "Generate Questions" button is disabled
