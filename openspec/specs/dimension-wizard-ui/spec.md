## ADDED Requirements

### Requirement: Wizard modal with 3 steps
The dimension setup wizard SHALL be a modal overlay with backdrop blur, following the existing FolderBrowser modal pattern. It SHALL have 3 steps with a step indicator, Back/Next navigation, and a close button.

#### Scenario: Open wizard
- **WHEN** user clicks "Set Up Dimensions" or "Edit" button
- **THEN** the wizard modal opens with backdrop overlay and step indicator showing current step

#### Scenario: Navigate between steps
- **WHEN** user clicks "Next" or "Back"
- **THEN** the wizard advances or retreats one step, and the step indicator updates

#### Scenario: Close wizard
- **WHEN** user clicks the close button or backdrop
- **THEN** the wizard closes without saving changes (unless explicitly saved)

### Requirement: Step 1 — Dimension Discovery
Step 1 SHALL display a URL input field and a "Discover Dimensions" button. It SHALL call the `/api/discover-dimensions` endpoint and show a loading state while processing. A "Skip — define manually" link SHALL add one empty dimension and advance to Step 2.

#### Scenario: Discover from URL
- **WHEN** user enters a URL and clicks "Discover Dimensions"
- **THEN** a loading state appears ("Analyzing website..."), and on success, the discovered dimensions are loaded and the wizard advances to Step 2

#### Scenario: Discovery error
- **WHEN** the discovery API returns an error
- **THEN** an error message is shown below the URL input, and the user can retry or skip

#### Scenario: Skip discovery
- **WHEN** user clicks "Skip — define manually"
- **THEN** one empty dimension template is created and the wizard advances to Step 2

### Requirement: Step 2 — Dimension Review and Editing
Step 2 SHALL display all dimensions in an editable list. Each dimension SHALL show its name, description, and values as editable fields. Users SHALL be able to add new dimensions, remove existing ones, and add/remove values within a dimension.

#### Scenario: Edit dimension name and description
- **WHEN** user modifies a dimension's name or description field
- **THEN** the change is reflected immediately in the wizard state

#### Scenario: Add a value to a dimension
- **WHEN** user types in the "add value" input and presses Enter or clicks add
- **THEN** the value is added to that dimension's values list as a tag/chip

#### Scenario: Remove a value from a dimension
- **WHEN** user clicks the remove button on a value tag
- **THEN** that value is removed from the dimension

#### Scenario: Add a new dimension
- **WHEN** user clicks "Add Dimension"
- **THEN** a new empty dimension is appended to the list with empty name, description, and values

#### Scenario: Remove a dimension
- **WHEN** user clicks the remove button on a dimension
- **THEN** that dimension is removed from the list

#### Scenario: Validation
- **WHEN** user tries to advance to Step 3 with a dimension that has no name or fewer than 2 values
- **THEN** a validation error is shown on the invalid dimension

### Requirement: Step 3 — Configuration and Confirmation
Step 3 SHALL display a summary of configured dimensions (count, total values), a "Total questions" number input (min 1, default 50), and a "Save & Close" button. Saving SHALL close the wizard and update the sidebar config.

#### Scenario: Summary display
- **WHEN** user reaches Step 3
- **THEN** a summary shows: number of dimensions, list of dimension names, total value combinations

#### Scenario: Save configuration
- **WHEN** user clicks "Save & Close"
- **THEN** the wizard closes, dimensions and totalQuestions are saved to the parent state, and the sidebar shows the configured summary

### Requirement: Wizard re-entry for editing
When the wizard is opened via the "Edit" button (dimensions already configured), it SHALL open at Step 2 with the previously configured dimensions pre-loaded.

#### Scenario: Edit existing dimensions
- **WHEN** user clicks "Edit" on the configured dimension summary
- **THEN** the wizard opens at Step 2 with all previously configured dimensions loaded for editing
