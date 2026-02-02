## ADDED Requirements

### Requirement: RealWorldGroundedStrategy class
The system SHALL provide a `RealWorldGroundedStrategy` implementing `QuestionStrategy` with the following options: `questions` (string[]), `totalSyntheticQuestions` (number), optional `matchThreshold` (default 0.35), optional `fewShotExamplesPerDoc` (default 5), optional `onProgress` (ProgressCallback).

#### Scenario: Strategy name
- **WHEN** accessing `strategy.name`
- **THEN** it SHALL return `"real-world-grounded"`

### Requirement: Mode A — Direct question reuse
All real-world questions that match a document above the threshold SHALL be included as `GeneratedQuery` entries with `metadata.mode = "direct"` and `metadata.strategy = "real-world-grounded"`.

#### Scenario: Matched question becomes a direct query
- **WHEN** a real question "How do I reset OAuth?" matches "auth.md" with score 0.72
- **THEN** a `GeneratedQuery` SHALL be produced with `query: "How do I reset OAuth?"`, `targetDocId: "auth.md"`, `metadata.mode: "direct"`, `metadata.matchScore: "0.72"`

### Requirement: Mode B — Few-shot synthetic generation
For each document with matched questions, the strategy SHALL use the top-K matched real questions (by score) as few-shot examples to generate additional synthetic questions. The LLM prompt SHALL instruct the model to generate questions matching the style, vocabulary, and complexity of the real examples.

#### Scenario: Few-shot generation for a document
- **WHEN** "auth.md" has 10 matched real questions and fewShotExamplesPerDoc is 5
- **THEN** the top 5 questions by score SHALL be used as few-shot examples in the generation prompt

#### Scenario: Generated query metadata
- **WHEN** a synthetic question is generated via few-shot
- **THEN** its metadata SHALL include `mode: "generated"` and `strategy: "real-world-grounded"`

### Requirement: Synthetic budget distribution
The `totalSyntheticQuestions` budget SHALL be distributed across documents proportional to their real-question match count. Documents with zero matches SHALL receive a minimum allocation of 1 synthetic question, using the global top-K questions as generic few-shot examples.

#### Scenario: Proportional distribution
- **WHEN** doc A has 60 matches, doc B has 30 matches, and totalSyntheticQuestions is 50
- **THEN** doc A SHALL receive ~33 synthetic questions and doc B SHALL receive ~17

#### Scenario: Unmatched document gets minimum allocation
- **WHEN** a document has zero matched real questions and totalSyntheticQuestions > 0
- **THEN** it SHALL receive at least 1 synthetic question using global top-K examples

### Requirement: Embedder is required
The strategy SHALL require `context.embedder` to be set in the `StrategyContext`. If `context.embedder` is undefined, the strategy SHALL throw an error.

#### Scenario: Missing embedder
- **WHEN** `context.embedder` is undefined
- **THEN** the strategy SHALL throw with a message indicating an embedder is required

### Requirement: Progress events
The strategy SHALL emit progress events via `onProgress` for each pipeline phase: `embedding-questions`, `embedding-passages`, `matching`, `generating` (per doc), and `done`.

#### Scenario: Progress during embedding
- **WHEN** the strategy begins embedding questions
- **THEN** it SHALL emit `{ phase: "embedding-questions", totalQuestions: N }`

#### Scenario: Progress during generation
- **WHEN** generating synthetic questions for a document
- **THEN** it SHALL emit `{ phase: "generating", docId, docIndex, totalDocs, questionsForDoc }`
