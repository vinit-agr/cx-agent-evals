## MODIFIED Requirements

### Requirement: POST /api/generate endpoint with SSE streaming
The API SHALL accept generation parameters including strategy type and stream results via Server-Sent Events. Request body SHALL accept `strategy: "simple" | "dimension-driven"` in addition to existing fields. When strategy is "dimension-driven", `dimensions` (array) and `totalQuestions` (number) SHALL be required. When strategy is "simple" (default), existing behavior is preserved.

#### Scenario: Stream with simple strategy (default)
- **WHEN** POST `/api/generate` with `strategy: "simple"` or no strategy field
- **THEN** uses SimpleStrategy with queriesPerDoc, streaming questions as before

#### Scenario: Stream with dimension-driven strategy
- **WHEN** POST `/api/generate` with `strategy: "dimension-driven"`, `dimensions: [...]`, and `totalQuestions: 50`
- **THEN** writes dimensions to a temp file, uses DimensionDrivenStrategy, streams questions as they are generated, and cleans up the temp file

#### Scenario: Missing dimensions for dimension-driven
- **WHEN** POST `/api/generate` with `strategy: "dimension-driven"` but no `dimensions` array
- **THEN** response is 400 with `{ "error": "dimensions and totalQuestions are required for dimension-driven strategy" }`

#### Scenario: Stream chunk-level questions
- **WHEN** POST `/api/generate` with mode "chunk" (any strategy)
- **THEN** response is an SSE stream where each `data:` message is a JSON object: `{ type: "question", docId: string, query: string, relevantChunkIds: string[], chunks: Array<{ id: string, content: string }> }`

#### Scenario: Stream token-level questions
- **WHEN** POST `/api/generate` with mode "token" (any strategy)
- **THEN** response is an SSE stream where each `data:` message is a JSON object: `{ type: "question", docId: string, query: string, relevantSpans: Array<{ docId: string, start: number, end: number, text: string }> }`

#### Scenario: Generation complete event
- **WHEN** all questions have been generated
- **THEN** the stream sends a final event `{ type: "done", totalQuestions: number }` and closes
