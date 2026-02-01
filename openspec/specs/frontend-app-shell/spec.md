## ADDED Requirements

### Requirement: Next.js project in frontend directory
The system SHALL provide a Next.js application in `frontend/` using the App Router, React 19, Tailwind CSS, and TypeScript. The library SHALL be linked locally via `file:..` dependency.

#### Scenario: Project starts successfully
- **WHEN** user runs `pnpm dev` inside `frontend/`
- **THEN** the application starts on `localhost:3000` and renders the home page

### Requirement: Evaluation mode selection on home page
The home page SHALL present two mode options: "Chunk-Level" and "Token-Level". The user MUST select one before proceeding to corpus loading.

#### Scenario: User selects chunk-level mode
- **WHEN** user clicks the "Chunk-Level" card
- **THEN** the app navigates to the corpus loader view with evaluation mode set to "chunk"

#### Scenario: User selects token-level mode
- **WHEN** user clicks the "Token-Level" card
- **THEN** the app navigates to the corpus loader view with evaluation mode set to "token"

### Requirement: Shared layout with mode indicator
The application SHALL display the current evaluation mode in the header once selected. A back/reset action SHALL allow returning to mode selection.

#### Scenario: Mode displayed in header
- **WHEN** user has selected an evaluation mode and is on any subsequent page
- **THEN** the header displays the active mode (e.g., "Chunk-Level" or "Token-Level")
