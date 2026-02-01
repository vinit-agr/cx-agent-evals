## Purpose

LLM-powered synthetic dataset generation for both chunk-level and token-level evaluation.

## Requirements

### Requirement: LLMClient interface
The system SHALL define an `LLMClient` interface with a `complete(params: { model: string; messages: ReadonlyArray<{ role: string; content: string }>; responseFormat?: "json" | "text" }): Promise<string>` method. An `openAIClientAdapter` function SHALL wrap an OpenAI SDK client to conform to this interface.

#### Scenario: LLMClient returns string response
- **WHEN** calling `client.complete({ model: "gpt-4o", messages: [...], responseFormat: "json" })`
- **THEN** the result SHALL be the string content of the LLM's response

#### Scenario: OpenAI adapter wraps SDK client
- **WHEN** calling `openAIClientAdapter(openaiClient)`
- **THEN** the result SHALL be an `LLMClient` that delegates to `openaiClient.chat.completions.create`

### Requirement: ChunkLevelSyntheticDatasetGenerator
The system SHALL provide a `ChunkLevelSyntheticDatasetGenerator` that accepts an `LLMClient`, `Corpus`, and `Chunker`. It SHALL chunk all documents, then use the LLM to generate queries with associated relevant chunk IDs. It SHALL validate that returned chunk IDs exist in the chunk index, discarding invalid ones. It SHALL track document association per chunk.

#### Scenario: Generate chunk-level ground truth
- **WHEN** calling `generator.generate({ queriesPerDoc: 5 })`
- **THEN** the result SHALL be an array of `ChunkLevelGroundTruth` objects, each with a query and valid chunk IDs

#### Scenario: Invalid chunk IDs are filtered out
- **WHEN** the LLM returns a chunk ID that does not exist in the chunk index
- **THEN** that ID SHALL be excluded from the ground truth entry

#### Scenario: Upload to LangSmith
- **WHEN** calling `generate({ uploadToLangsmith: true, datasetName: "my-dataset" })`
- **THEN** the ground truth SHALL be uploaded to a LangSmith dataset with the given name

### Requirement: TokenLevelSyntheticDatasetGenerator
The system SHALL provide a `TokenLevelSyntheticDatasetGenerator` that accepts an `LLMClient` and `Corpus` (no chunker required). It SHALL use a two-step process: (1) LLM generates diverse questions per document, (2) LLM extracts verbatim excerpts answering each question. A post-processing step SHALL locate exact character positions via string matching. Excerpts that cannot be located SHALL be skipped with a warning.

#### Scenario: Generate token-level ground truth
- **WHEN** calling `generator.generate({ queriesPerDoc: 5 })`
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

### Requirement: Base generator with shared LLM calling
The system SHALL provide a base `SyntheticDatasetGenerator` with a `callLLM(systemPrompt, userPrompt): Promise<string>` method that both generators extend. The model SHALL be configurable via constructor (default `"gpt-4o"`).

#### Scenario: Configurable model
- **WHEN** constructing a generator with `model: "gpt-4o-mini"`
- **THEN** all LLM calls SHALL use that model
