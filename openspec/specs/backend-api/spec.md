## ADDED Requirements

### Requirement: POST /api/corpus/load endpoint
The API SHALL accept a JSON body `{ folderPath: string }` and return the loaded corpus as `{ documents: Array<{ id: string, content: string, contentLength: number }> }`. It SHALL use the library's `corpusFromFolder` function.

#### Scenario: Load valid folder
- **WHEN** POST `/api/corpus/load` with `{ "folderPath": "/path/to/docs" }`
- **THEN** response is 200 with the list of documents found

#### Scenario: Relative folder path
- **WHEN** POST `/api/corpus/load` with `{ "folderPath": "data/docs" }`
- **THEN** the API resolves the path relative to `process.cwd()` using `path.resolve()` and loads from the absolute path

#### Scenario: Invalid folder path
- **WHEN** POST `/api/corpus/load` with a non-existent path
- **THEN** response is 400 with `{ "error": "Directory not found: <resolved-path>" }` showing the resolved absolute path

#### Scenario: Folder exists but has no markdown files
- **WHEN** POST `/api/corpus/load` with a valid directory containing no `.md` files
- **THEN** response is 400 with `{ "error": "No markdown files found in: <resolved-path>" }`

### Requirement: POST /api/generate endpoint with SSE streaming
The API SHALL accept generation parameters and stream results via Server-Sent Events. Request body: `{ folderPath: string, mode: "chunk" | "token", questionsPerDoc: number, chunkSize?: number, chunkOverlap?: number }`. Each SSE event SHALL contain one generated question with its relevant chunks or spans.

#### Scenario: Stream chunk-level questions
- **WHEN** POST `/api/generate` with mode "chunk"
- **THEN** response is an SSE stream where each `data:` message is a JSON object: `{ type: "question", docId: string, query: string, relevantChunkIds: string[], chunks: Array<{ id: string, content: string }> }`

#### Scenario: Stream token-level questions
- **WHEN** POST `/api/generate` with mode "token"
- **THEN** response is an SSE stream where each `data:` message is a JSON object: `{ type: "question", docId: string, query: string, relevantSpans: Array<{ docId: string, start: number, end: number, text: string }> }`

#### Scenario: Generation complete event
- **WHEN** all documents have been processed
- **THEN** the stream sends a final event `{ type: "done", totalQuestions: number }` and closes

#### Scenario: Missing OPENAI_API_KEY
- **WHEN** the `OPENAI_API_KEY` environment variable is not set
- **THEN** response is 500 with `{ "error": "OPENAI_API_KEY environment variable is required" }`

### Requirement: POST /api/browse endpoint for server-side folder browsing
The API SHALL accept a JSON body `{ path?: string }` and return the directory listing at that path. If no path is provided, it SHALL default to the project root (or a configurable base directory). The response SHALL be `{ currentPath: string, parentPath: string | null, entries: Array<{ name: string, type: "directory" | "file", path: string }> }`. Only directories and `.md` files SHALL be listed. Entries SHALL be sorted with directories first, then files.

#### Scenario: Browse root directory
- **WHEN** POST `/api/browse` with no path or `{ "path": "/" }`
- **THEN** response is 200 with the listing of the root directory showing directories and .md files

#### Scenario: Browse subdirectory
- **WHEN** POST `/api/browse` with `{ "path": "/Users/me/docs/subfolder" }`
- **THEN** response is 200 with entries for that subdirectory, and parentPath points to `/Users/me/docs`

#### Scenario: Invalid path
- **WHEN** POST `/api/browse` with a path that does not exist
- **THEN** response is 400 with `{ "error": "Directory not found" }`

### Requirement: LLMClient constructed server-side
The API routes SHALL construct the `openAIClientAdapter` and pass it to the synthetic data generators. The OpenAI client SHALL read the API key from `process.env.OPENAI_API_KEY`.

#### Scenario: LLM client uses environment API key
- **WHEN** a generate request is made
- **THEN** the backend creates an OpenAI client using the environment variable, not a hardcoded key
