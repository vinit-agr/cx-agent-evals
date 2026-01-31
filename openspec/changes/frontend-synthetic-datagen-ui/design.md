## Context

The rag-evaluation-system library is a TypeScript package for evaluating RAG retrieval pipelines. It includes synthetic dataset generators (`ChunkLevelSyntheticDatasetGenerator`, `TokenLevelSyntheticDatasetGenerator`), chunkers, and evaluation metrics. Currently it is code-only with no visual interface. We need a frontend that lets users interactively load documents, generate synthetic questions, and visually inspect which parts of documents are relevant to each question.

The library lives at the project root (`src/`). The frontend will be a standalone Next.js app in `frontend/` that imports the library.

## Goals / Non-Goals

**Goals:**
- Provide a browser-based UI for synthetic question generation over a local markdown corpus
- Support both chunk-level and token-level evaluation modes
- Stream generated questions to the UI in real-time as they are produced
- Highlight relevant chunks or character spans in the document when a question is selected
- Expose chunker configuration (chunk size, overlap) and questions-per-document count

**Non-Goals:**
- Full evaluation pipeline execution (running embedder + vector store + metrics) — this is just synthetic data generation and inspection
- User authentication or multi-user support
- Deployment to production hosting — this is a local development tool
- Editing or saving generated datasets (export to LangSmith can be added later)
- Supporting non-markdown file formats

## Decisions

### Decision 1: Next.js App Router with API routes as backend

The frontend uses Next.js App Router (`app/` directory). API routes handle all library interactions server-side since the library uses Node.js APIs (filesystem, crypto). The frontend communicates via fetch to these API routes.

**Alternative considered**: Separate Express backend. Rejected because Next.js API routes keep it in one project with simpler setup.

### Decision 2: Server-Sent Events for streaming question generation

Question generation is slow (LLM calls per document). The API route will use Server-Sent Events (SSE) to stream each generated question to the client as it completes, rather than waiting for all questions to finish.

**Alternative considered**: WebSockets. Rejected as overkill for a unidirectional stream.

### Decision 3: Tailwind CSS for styling

Use Tailwind CSS for all styling. No component library — keep it lightweight with custom components.

**Alternative considered**: shadcn/ui. Rejected to keep dependencies minimal for this tool-like UI.

### Decision 4: Local filesystem access via API routes only

The browser cannot access the local filesystem directly. The user types or pastes a folder path, and the API route reads it server-side using `corpusFromFolder`. No native file picker (would require Electron or similar).

**Alternative considered**: `<input type="file" webkitdirectory>` for drag-and-drop. Rejected because it uploads files to the browser rather than reading them server-side, which doesn't integrate cleanly with the library's `corpusFromFolder`.

### Decision 5: LLMClient configuration via environment variable

The frontend reads `OPENAI_API_KEY` from the environment. The API routes construct the OpenAI LLM client server-side. No API key input in the UI.

### Decision 6: Library linked locally via workspace or relative path

The frontend's `package.json` references the library via `"rag-evaluation-system": "file:.."` so it uses the local build directly.

### Decision 7: Highlight rendering with mark elements

For chunk-level: highlight the entire chunk text in the document using `<mark>` elements with distinct background colors. For token-level: highlight exact character spans using start/end offsets to wrap the corresponding substring in `<mark>` elements.

## Risks / Trade-offs

- **[Risk] LLM API key required** → The UI will show a clear error if `OPENAI_API_KEY` is not set, with instructions to set it.
- **[Risk] Large corpora slow to process** → Limit display to first 50 documents. Generation processes all but streams results incrementally.
- **[Risk] Folder path input is less discoverable than a file picker** → Provide placeholder text showing expected format and remember last-used path in localStorage.
- **[Risk] Library build must be up-to-date** → Document that `pnpm build` must be run before starting the frontend.
