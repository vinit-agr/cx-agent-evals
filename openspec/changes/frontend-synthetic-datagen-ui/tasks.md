## 1. Project Setup

- [x] 1.1 Initialize Next.js app in `frontend/` with App Router, TypeScript, Tailwind CSS
- [x] 1.2 Add `rag-evaluation-system` as local dependency via `file:..`
- [x] 1.3 Configure `next.config.ts` for server-side library usage (transpilePackages, serverExternalPackages for node built-ins)
- [x] 1.4 Create root layout with Tailwind, base styles, and shared header component

## 2. App Shell and Mode Selection

- [x] 2.1 Create home page with two mode cards: "Chunk-Level" and "Token-Level"
- [x] 2.2 Implement mode state management (URL params or React context) that persists across navigation
- [x] 2.3 Add header component showing current mode with a back/reset button

## 3. Backend API Routes

- [x] 3.1 Implement `POST /api/corpus/load` — accepts `{ folderPath }`, returns documents list using `corpusFromFolder`
- [x] 3.2 Implement `POST /api/generate` — accepts generation config, returns SSE stream of generated questions
- [x] 3.3 Wire up `openAIClientAdapter` with `process.env.OPENAI_API_KEY` in generate route
- [x] 3.4 Implement chunk-level generation path: create `RecursiveCharacterChunker` + `ChunkLevelSyntheticDatasetGenerator`, stream each question as SSE event with chunk content
- [x] 3.5 Implement token-level generation path: create `TokenLevelSyntheticDatasetGenerator`, stream each question as SSE event with span positions
- [x] 3.6 Send `{ type: "done", totalQuestions }` event when generation completes
- [x] 3.7 Handle error cases: missing API key (500), invalid folder (400), generation errors (SSE error event)

## 4. Corpus Loader UI

- [x] 4.1 Create folder path text input with "Load" button
- [x] 4.2 Call `/api/corpus/load` on submit and display loaded documents as a scrollable list (filename + first 200 chars preview)
- [x] 4.3 Persist last folder path in localStorage and pre-fill on load
- [x] 4.4 Show error state for invalid/empty folders

## 5. Question Generation UI

- [x] 5.1 Create configuration panel: questions-per-doc input (default 10), chunk size input (default 1000), chunk overlap input (default 200)
- [x] 5.2 Hide chunker config inputs when in token-level mode
- [x] 5.3 Create "Generate Questions" button — disabled when no corpus loaded or generation in progress
- [x] 5.4 Implement SSE client: connect to `/api/generate`, parse streamed events, append questions to state in real-time
- [x] 5.5 Show progress indicator during generation, summary on completion
- [x] 5.6 Display generated questions as a list grouped by source document

## 6. Result Inspector

- [x] 6.1 Create split-panel layout: question list on left, document viewer on right
- [x] 6.2 On question click, display full source document text in the right panel
- [x] 6.3 Implement chunk-level highlighting: find each relevant chunk's text in the document and wrap with `<mark>` elements
- [x] 6.4 Implement token-level span highlighting: use start/end offsets to wrap character ranges with `<mark>` elements
- [x] 6.5 Support multiple highlights with distinct colors
- [x] 6.6 Auto-scroll document viewer to the first highlight when a question is selected

## 7. Polish and Integration

## 8. Folder Browser

- [x] 8.1 Implement `POST /api/browse` endpoint — accepts `{ path? }`, returns directory listing (directories + .md files), sorted directories-first
- [x] 8.2 Create FolderBrowser component — modal/panel with directory listing, breadcrumb navigation, "Select this folder" button
- [x] 8.3 Add "Browse" button next to folder path input in CorpusLoader that opens the folder browser
- [x] 8.4 On folder selection, populate the path input and auto-trigger corpus loading
- [x] 8.5 Resolve relative paths in `/api/corpus/load` by joining with `process.cwd()` so relative paths work too

## 9. Polish and Integration

- [x] 7.1 Add loading states and error boundaries throughout
- [x] 7.2 Test full flow: mode selection → folder load → configure → generate → inspect results
- [x] 7.3 Add brief instructions/placeholder text guiding the user through each step
