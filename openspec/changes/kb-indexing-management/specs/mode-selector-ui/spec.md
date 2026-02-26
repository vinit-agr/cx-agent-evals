## MODIFIED Requirements

### Requirement: Mode selector landing page
The system SHALL provide a landing page with three large selectable cards: "Generate Questions", "Retrievers", and "Run Experiments". Each card SHALL have a title, brief description, and navigate to the appropriate page on click. The grid SHALL use a three-column layout on medium+ screens.

#### Scenario: Landing page displays three mode cards
- **WHEN** user visits the root URL
- **THEN** the page SHALL display three prominent cards for "Generate Questions", "Retrievers", and "Run Experiments"

#### Scenario: Retrievers card navigates to retrievers page
- **WHEN** user clicks the "Retrievers" card
- **THEN** the app SHALL navigate to `/retrievers`

#### Scenario: Generate Questions card navigates to generate page
- **WHEN** user clicks the "Generate Questions" card
- **THEN** the app SHALL navigate to the question generation flow

#### Scenario: Run Experiments card navigates to experiments page
- **WHEN** user clicks the "Run Experiments" card
- **THEN** the app SHALL navigate to `/experiments`

### Requirement: Mode card descriptions
The "Generate Questions" card SHALL display description: "Create synthetic evaluation datasets". The "Retrievers" card SHALL display description: "Configure, index, and test retrieval pipelines". The "Run Experiments" card SHALL display description: "Evaluate retrievers against datasets and compare metrics".

#### Scenario: Cards show descriptions
- **WHEN** viewing the landing page
- **THEN** each card SHALL display its title and descriptive subtitle

### Requirement: Mode indicator in header
The system SHALL display mode tabs in the header when on generate, retrievers, or experiments pages, allowing users to switch between modes without returning to the landing page.

#### Scenario: Header shows mode tabs on retrievers page
- **WHEN** user is on the retrievers page
- **THEN** the header SHALL show "Retrievers" as active and the other two modes as clickable

#### Scenario: Header shows three tabs
- **WHEN** user is on any mode page
- **THEN** the header SHALL show all three mode tabs: "Generate Questions", "Retrievers", and "Run Experiments"

#### Scenario: Clicking inactive tab navigates
- **WHEN** user clicks an inactive mode tab in the header
- **THEN** the app SHALL navigate to that mode's page
