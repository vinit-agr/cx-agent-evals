## ADDED Requirements

### Requirement: Real-world questions modal
The UI SHALL provide a modal for entering real-world questions with two tabs: "Upload CSV" and "Paste". The modal SHALL be opened from the strategy config area when "Real-World Grounded" is selected.

#### Scenario: Upload CSV tab
- **WHEN** the user selects the "Upload CSV" tab and uploads a CSV file with a single column
- **THEN** the system SHALL parse each row as a question and display the count of loaded questions

#### Scenario: Paste tab
- **WHEN** the user selects the "Paste" tab and pastes text with one question per line
- **THEN** the system SHALL split on newlines, trim whitespace, and filter empty lines

#### Scenario: Save and close
- **WHEN** the user clicks "Save" in the modal
- **THEN** the questions SHALL be stored in component state and the modal SHALL close

#### Scenario: Edit existing questions
- **WHEN** questions are already loaded and the user clicks "Edit"
- **THEN** the modal SHALL reopen showing the currently loaded questions

### Requirement: Real-world questions persistence
Real-world questions SHALL be saved to localStorage under the key `rag-eval:real-world-questions` when the user saves in the modal. On page load, if the key exists and the "Real-World Grounded" strategy is selected, the questions SHALL be restored.

#### Scenario: Persist on save
- **WHEN** the user saves 200 questions in the modal
- **THEN** the questions SHALL be stored in localStorage as a JSON array

#### Scenario: Restore on load
- **WHEN** the page loads and localStorage contains real-world questions
- **THEN** the questions SHALL be loaded into state

### Requirement: Strategy config display for real-world grounded
When "Real-World Grounded" is selected, the config area SHALL show: the count of loaded questions with an "Edit" button (or "Set Up Questions" if none loaded), a "Synthetic questions" number input for the synthetic budget, and the Generate button (disabled if no questions loaded).

#### Scenario: No questions loaded
- **WHEN** "Real-World Grounded" is selected and no questions are loaded
- **THEN** a "Set Up Questions" button SHALL be displayed and the Generate button SHALL be disabled

#### Scenario: Questions loaded
- **WHEN** "Real-World Grounded" is selected and 200 questions are loaded
- **THEN** the display SHALL show "200 questions loaded [Edit]" and a synthetic budget input

### Requirement: API request includes real-world questions
When generating with the "Real-World Grounded" strategy, the frontend SHALL send the real-world questions array and synthetic budget in the API request body.

#### Scenario: API request body
- **WHEN** the user clicks Generate with "Real-World Grounded" strategy
- **THEN** the request body SHALL include `strategy: "real-world-grounded"`, `realWorldQuestions: string[]`, and `totalSyntheticQuestions: number`
