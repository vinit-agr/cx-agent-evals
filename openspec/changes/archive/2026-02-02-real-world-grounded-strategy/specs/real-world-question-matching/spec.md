## ADDED Requirements

### Requirement: Passage splitting for matching
The system SHALL split each document into passages by splitting on double newlines (`\n\n`), merging consecutive short paragraphs, and capping each passage at approximately 500 characters. This splitting is used only for embedding-based matching, not for evaluation chunking.

#### Scenario: Split a document into passages
- **WHEN** a document with multiple paragraphs is split
- **THEN** each passage SHALL be at most ~500 characters and contain coherent text boundaries

#### Scenario: Short paragraphs are merged
- **WHEN** consecutive paragraphs are each under 100 characters
- **THEN** they SHALL be merged into a single passage up to the ~500 char cap

### Requirement: Embed questions and passages
The system SHALL embed all real-world questions and all document passages using the provided `Embedder`. Embedding SHALL be batched (100 items per batch) and batches SHALL be parallelized.

#### Scenario: Batch embedding
- **WHEN** 250 questions are provided
- **THEN** they SHALL be embedded in 3 batches (100, 100, 50) executed in parallel

### Requirement: Cosine similarity matching
The system SHALL compute cosine similarity between each question embedding and all passage embeddings. For each question, the passage with the highest similarity determines the matched document. Questions with a best score below the threshold SHALL be excluded.

#### Scenario: Question matches a document
- **WHEN** a real question has highest cosine similarity 0.65 against a passage in "auth.md"
- **THEN** the question SHALL be matched to document "auth.md" with score 0.65

#### Scenario: Question below threshold is excluded
- **WHEN** a question's best passage score is 0.20 and threshold is 0.35
- **THEN** the question SHALL NOT be included in the matched results

### Requirement: Match result structure
The matching function SHALL return a `Map<docId, MatchedQuestion[]>` where each `MatchedQuestion` contains the question text, similarity score, and the matched passage text.

#### Scenario: Multiple questions match same document
- **WHEN** 5 questions all have highest similarity to passages in "setup.md"
- **THEN** the map entry for "setup.md" SHALL contain all 5 matched questions sorted by score descending
