## ADDED Requirements

### Requirement: Strategy selector in generation config
The UI SHALL display two selectable cards ("Simple" and "Dimension-Driven") in the generation config area after corpus is loaded. The selected strategy SHALL be visually highlighted with an accent border.

#### Scenario: Default selection
- **WHEN** the generation config is first displayed
- **THEN** "Simple" strategy SHALL be selected by default

#### Scenario: Switch to dimension-driven
- **WHEN** user clicks the "Dimension-Driven" card
- **THEN** it becomes selected, and the config area below updates to show dimension-driven controls

### Requirement: Conditional config display based on strategy
When "Simple" is selected, the existing queriesPerDoc input (and chunk settings for chunk mode) SHALL be displayed. When "Dimension-Driven" is selected, a "Set Up Dimensions" button SHALL be shown if dimensions are not yet configured, or a dimension summary with "Edit" button if they are.

#### Scenario: Simple strategy config
- **WHEN** "Simple" strategy is selected
- **THEN** the queriesPerDoc input and chunk settings (in chunk mode) are displayed, and the Generate button uses queriesPerDoc

#### Scenario: Dimension-driven not yet configured
- **WHEN** "Dimension-Driven" strategy is selected and no dimensions are configured
- **THEN** a "Set Up Dimensions" button is displayed, and the Generate button is disabled

#### Scenario: Dimension-driven configured
- **WHEN** "Dimension-Driven" is selected and dimensions have been configured
- **THEN** a summary of configured dimensions is shown with an "Edit" button, total questions input, and the Generate button is enabled

### Requirement: Three strategy cards
The strategy selector SHALL display three selectable cards: "Simple", "Dimension-Driven", and "Real-World Grounded". The layout SHALL accommodate three cards.

#### Scenario: Third card displayed
- **WHEN** the strategy selector is rendered
- **THEN** three cards SHALL be displayed including "Real-World Grounded"

#### Scenario: Select real-world grounded
- **WHEN** the user clicks the "Real-World Grounded" card
- **THEN** it becomes selected and the config area updates to show real-world grounded controls
