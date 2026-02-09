## Purpose

Landing page with mode selection cards for choosing between "Generate Questions" and "Run Experiments" flows.

## ADDED Requirements

### Requirement: Mode selector landing page
The system SHALL provide a landing page with two large selectable cards: "Generate Questions" and "Run Experiments". Each card SHALL have a title, brief description, and navigate to the appropriate page on click.

#### Scenario: Landing page displays two mode cards
- **WHEN** user visits the root URL
- **THEN** the page SHALL display two prominent cards for "Generate Questions" and "Run Experiments"

#### Scenario: Generate Questions card navigates to generate page
- **WHEN** user clicks the "Generate Questions" card
- **THEN** the app SHALL navigate to the question generation flow (existing functionality)

#### Scenario: Run Experiments card navigates to experiments page
- **WHEN** user clicks the "Run Experiments" card
- **THEN** the app SHALL navigate to `/experiments`

### Requirement: Mode card descriptions
The "Generate Questions" card SHALL display description: "Create synthetic evaluation datasets". The "Run Experiments" card SHALL display description: "Run retrieval evals on LangSmith datasets".

#### Scenario: Cards show descriptions
- **WHEN** viewing the landing page
- **THEN** each card SHALL display its title and descriptive subtitle

### Requirement: Mode indicator in header
The system SHALL display mode tabs in the header when on generate or experiments pages, allowing users to switch between modes without returning to the landing page.

#### Scenario: Header shows mode tabs on generate page
- **WHEN** user is on the generate questions page
- **THEN** the header SHALL show "Generate Questions" as active and "Run Experiments" as clickable

#### Scenario: Header shows mode tabs on experiments page
- **WHEN** user is on the experiments page
- **THEN** the header SHALL show "Run Experiments" as active and "Generate Questions" as clickable

#### Scenario: Clicking inactive tab navigates
- **WHEN** user clicks an inactive mode tab in the header
- **THEN** the app SHALL navigate to that mode's page
