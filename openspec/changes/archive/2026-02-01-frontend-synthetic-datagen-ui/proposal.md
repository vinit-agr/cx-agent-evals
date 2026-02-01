## Why

The rag-evaluation-system library provides synthetic dataset generation and evaluation capabilities, but has no visual interface. Users must write code to generate questions, inspect results, and understand which chunks or spans are relevant. A frontend would make it accessible to explore corpora, generate synthetic questions interactively, and visually inspect the relationship between questions and their source text.

## What Changes

- Add a Next.js frontend application in `frontend/` at the project root
- Provide a folder picker to load a corpus of markdown files from the local filesystem
- Display loaded documents in a document browser
- Allow choosing between chunk-level and token-level evaluation modes
- Expose chunker configuration (chunk size, overlap) and questions-per-document setting
- Generate synthetic questions via the library's generators, streaming results to the UI in real-time
- When selecting a generated question, highlight the relevant chunks or character spans in the original document text
- Add a backend API layer (Next.js API routes) that wraps the library's synthetic data generation

## Capabilities

### New Capabilities
- `frontend-app-shell`: Next.js project setup, layout, navigation, and evaluation mode selection (chunk-level vs token-level)
- `corpus-loader`: Folder selection from filesystem, markdown file discovery, document listing UI
- `question-generation-ui`: Configuration controls (questions per doc, chunker settings), generate button, real-time streaming of generated questions
- `result-inspector`: Question selection, document viewer with chunk highlighting or character span highlighting depending on evaluation mode
- `backend-api`: Next.js API routes that bridge the frontend to the library's corpus loading, chunking, and synthetic data generation

### Modified Capabilities
None.

## Impact

- **New directory**: `frontend/` with a standalone Next.js application
- **Dependencies**: next, react, react-dom, tailwindcss, and the rag-evaluation-system library (linked locally)
- **APIs**: New API routes under `frontend/app/api/` for corpus loading, chunking, and question generation
- **No changes** to the existing library code in `src/`
