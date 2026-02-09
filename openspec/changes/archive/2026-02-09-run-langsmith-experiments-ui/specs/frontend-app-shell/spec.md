## Purpose

Updates to Next.js application shell to support mode-based navigation.

## MODIFIED Requirements

### Requirement: Next.js project in frontend directory
The system SHALL provide a Next.js application in `frontend/` using the App Router, React 19, Tailwind CSS, and TypeScript. The library SHALL be linked locally via `file:..` dependency. The application SHALL support multiple pages for different modes.

#### Scenario: Project starts successfully
- **WHEN** user runs `pnpm dev` inside `frontend/`
- **THEN** the application starts on `localhost:3000` and renders the home page

#### Scenario: Home page shows mode selection
- **WHEN** user visits the home page
- **THEN** the app SHALL display mode selection cards for "Generate Questions" and "Run Experiments"

### Requirement: Shared layout with mode tabs
The application layout SHALL display mode tabs in the header when on generate or experiments pages. The tabs SHALL indicate the active mode and allow navigation between modes.

#### Scenario: Mode tabs in header
- **WHEN** user is on the generate or experiments page
- **THEN** the header SHALL display mode tabs showing both options with the current mode highlighted

#### Scenario: Tabs navigate between modes
- **WHEN** user clicks an inactive mode tab
- **THEN** the app SHALL navigate to that mode's page

## ADDED Requirements

### Requirement: Generate page route
The system SHALL provide a `/generate` page that contains the existing question generation flow (corpus loader, strategy config, question list, document viewer).

#### Scenario: Generate page renders existing flow
- **WHEN** user navigates to `/generate`
- **THEN** the page SHALL display the full question generation UI with 3-column layout

### Requirement: Experiments page route
The system SHALL provide an `/experiments` page for running LangSmith experiments.

#### Scenario: Experiments page renders
- **WHEN** user navigates to `/experiments`
- **THEN** the page SHALL display the experiments configuration and console UI
