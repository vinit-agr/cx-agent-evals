## ADDED Requirements

### Requirement: Dimension auto-discovery from website
The system SHALL accept a URL and fetch content from the company's website (up to 5 linked same-domain pages). It SHALL send the content to an LLM to identify question dimensions (e.g., user persona, query intent, complexity, tone) with concrete values for each. It SHALL save the discovered dimensions to a JSON file.

#### Scenario: Discover dimensions from a website URL
- **WHEN** calling `discoverDimensions({ url: "https://example.com", outputPath: "./dimensions.json" })`
- **THEN** the system SHALL fetch the website content, extract dimensions via LLM, and write a JSON file with an array of `{ name, description, values[] }` objects

#### Scenario: Limit page fetching
- **WHEN** the website contains many linked pages
- **THEN** the system SHALL fetch at most 5 same-domain pages (the root URL plus up to 4 linked pages)

### Requirement: Dimensions file format
The system SHALL use a JSON file as the source of truth for dimensions. The file SHALL contain an array of dimension objects, each with `name` (string), `description` (string), and `values` (string array). The user MAY edit this file after auto-discovery.

#### Scenario: Valid dimensions file
- **WHEN** reading a dimensions file
- **THEN** each dimension SHALL have a non-empty `name`, `description`, and at least 2 `values`

#### Scenario: Load dimensions from file
- **WHEN** calling `loadDimensions(filePath)`
- **THEN** the system SHALL parse and validate the JSON file, returning typed dimension objects

### Requirement: Pairwise combination filtering
The system SHALL generate all pairwise projections of dimension values (one pair of dimensions at a time) and ask an LLM to identify which value pairs are unrealistic. A full combination SHALL be considered valid only if ALL of its pairwise projections are valid.

#### Scenario: Filter unrealistic pairwise combinations
- **WHEN** dimensions have values `persona: [new_user, admin]` and `complexity: [basic, advanced]`
- **THEN** the LLM SHALL evaluate all 4 pairs and mark unrealistic ones (e.g., `new_user × advanced`)

#### Scenario: Compose valid full combinations
- **WHEN** pairwise filtering is complete across all dimension pairs
- **THEN** only full combinations where every pairwise projection is valid SHALL be retained

### Requirement: Document-combo relevance matrix
The system SHALL build a relevance matrix mapping which filtered combinations are plausible for which documents. It SHALL first generate a one-line summary per document via LLM, then use those summaries to batch-assign combos to documents.

#### Scenario: Generate document summaries
- **WHEN** building the relevance matrix for a corpus
- **THEN** the system SHALL call the LLM once per document to produce a one-line summary (topic, audience, purpose)

#### Scenario: Assign combos to documents
- **WHEN** document summaries and filtered combos are available
- **THEN** the system SHALL call the LLM (in batches) to determine which combos are plausible for which documents, producing a list of `(docId, combo)` pairs

### Requirement: Stratified sampling within question budget
The system SHALL accept a `totalQuestions` parameter and sample from valid `(docId, combo)` pairs with two constraints: (1) every combo in the relevance matrix SHALL be sampled at least once if budget allows, (2) every document SHALL have at least one question. Remaining budget SHALL be distributed proportionally across documents.

#### Scenario: Sample with sufficient budget
- **WHEN** `totalQuestions` is greater than the number of unique combos and documents
- **THEN** every combo SHALL appear at least once and every document SHALL have at least one question

#### Scenario: Sample with tight budget
- **WHEN** `totalQuestions` is less than the number of unique combos
- **THEN** document coverage SHALL be prioritized first, then combo coverage SHALL be maximized

### Requirement: Dimension-constrained question generation
The system SHALL generate one question per sampled `(docId, combo)` pair by building a prompt that includes the document content and the dimension values as constraints (persona, intent, complexity, tone, etc.). The output SHALL be a `GeneratedQuery` with the query text, target document ID, and dimension metadata.

#### Scenario: Generate question with dimension constraints
- **WHEN** generating for combo `{ persona: "developer", intent: "troubleshooting", complexity: "multi_step" }` against a document
- **THEN** the prompt SHALL instruct the LLM to generate a question matching that profile, and the output SHALL include the dimension values in metadata

### Requirement: Dimension-driven strategy orchestration
The system SHALL provide a `DimensionDrivenStrategy` implementing the `QuestionStrategy` interface that orchestrates the full pipeline: load dimensions → pairwise filter → build relevance matrix → stratified sample → generate questions. It SHALL accept a dimensions file path and `totalQuestions` as configuration.

#### Scenario: End-to-end dimension-driven generation
- **WHEN** calling `strategy.generate(context)` with a dimensions file and totalQuestions
- **THEN** the system SHALL execute the full pipeline and return an array of `GeneratedQuery` objects with dimension metadata
