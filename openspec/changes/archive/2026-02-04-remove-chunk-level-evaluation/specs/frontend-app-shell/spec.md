## REMOVED Requirements

### Requirement: Evaluation mode selection on home page
**Reason**: With only span-based evaluation, mode selection is unnecessary.
**Migration**: The home page SHALL directly show the corpus loader / question generation UI.

## MODIFIED Requirements

### Requirement: Next.js project in frontend directory
The system SHALL provide a Next.js application in `frontend/` using the App Router, React 19, Tailwind CSS, and TypeScript. The library SHALL be linked locally via `file:..` dependency.

#### Scenario: Project starts successfully
- **WHEN** user runs `pnpm dev` inside `frontend/`
- **THEN** the application starts on `localhost:3000` and renders the home page

#### Scenario: Home page shows question generation
- **WHEN** user visits the home page
- **THEN** the app SHALL display the corpus loader and question generation UI directly (no mode selection)

### Requirement: Shared layout without mode indicator
The application layout SHALL NOT display an evaluation mode indicator since there is only one evaluation type. The header MAY show the application title.

#### Scenario: No mode in header
- **WHEN** user is on any page
- **THEN** the header SHALL NOT display a mode indicator (no "Chunk-Level" or "Token-Level" badge)
