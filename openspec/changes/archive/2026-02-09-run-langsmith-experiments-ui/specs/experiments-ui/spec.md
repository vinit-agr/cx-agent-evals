## Purpose

Frontend page and components for configuring and running LangSmith experiments with real-time progress streaming.

## ADDED Requirements

### Requirement: Experiments page layout
The system SHALL provide an experiments page at `/experiments` with a two-column layout: a fixed-width configuration panel (left) and a flexible console panel (right). The page SHALL use the existing dark theme with JetBrains Mono font and emerald accent color.

#### Scenario: Page renders with two columns
- **WHEN** user navigates to `/experiments`
- **THEN** the page SHALL display a configuration panel on the left and a console panel on the right

### Requirement: Dataset picker
The system SHALL provide a dataset picker dropdown that fetches datasets from LangSmith via `/api/datasets/list`, ordered by creation date (most recent first). The picker SHALL display dataset names and show a loading state while fetching.

#### Scenario: Datasets load on page mount
- **WHEN** the experiments page loads
- **THEN** the dataset picker SHALL fetch and display available LangSmith datasets

#### Scenario: Dataset selection shows corpus info
- **WHEN** user selects a dataset
- **THEN** the UI SHALL display the corpus folder path and document count from the dataset metadata

#### Scenario: Missing corpus path fallback
- **WHEN** a dataset has no `folderPath` in metadata
- **THEN** the UI SHALL show a text input for the user to enter the corpus path manually

### Requirement: Retriever configuration UI
The system SHALL provide configuration controls for VectorRAG retriever including: chunker type with size and overlap inputs, embedder dropdown, vector store dropdown, optional reranker dropdown, and k (top results) input.

#### Scenario: Chunker configuration
- **WHEN** configuring the chunker
- **THEN** the UI SHALL show a dropdown for chunker type (Recursive Character) and number inputs for chunk size (default 512) and overlap (default 50)

#### Scenario: Embedder selection with API key status
- **WHEN** configuring the embedder
- **THEN** the UI SHALL show a dropdown with available embedders and display the API key status (configured/missing) for the selected embedder

#### Scenario: Reranker selection with API key warning
- **WHEN** user selects a reranker that requires an API key
- **THEN** the UI SHALL show a warning if the required API key is missing

### Requirement: Metrics selection
The system SHALL provide checkboxes for selecting evaluation metrics: recall, precision, IoU, and F1. All metrics SHALL be selected by default.

#### Scenario: Toggle metrics
- **WHEN** user unchecks a metric
- **THEN** that metric SHALL be excluded from the experiment configuration

### Requirement: Experiment name input
The system SHALL auto-generate an experiment name from the retriever configuration (e.g., `recursive-512-50-openai-small-k5`) and allow the user to edit it.

#### Scenario: Name auto-generates from config
- **WHEN** user changes chunker size to 256
- **THEN** the experiment name SHALL update to reflect the new value (e.g., `recursive-256-50-openai-small-k5`)

#### Scenario: User can edit name
- **WHEN** user edits the experiment name
- **THEN** the custom name SHALL be used instead of auto-generated name

### Requirement: Run experiment button
The system SHALL provide a prominent "Run Experiment" button that triggers the experiment via `/api/experiments/run`. The button SHALL be disabled while an experiment is running or if required configuration is missing.

#### Scenario: Button disabled during run
- **WHEN** an experiment is running
- **THEN** the Run Experiment button SHALL be disabled and show "Running..." text

#### Scenario: Button disabled without dataset
- **WHEN** no dataset is selected
- **THEN** the Run Experiment button SHALL be disabled

### Requirement: Experiment progress display
The system SHALL display real-time experiment progress via SSE streaming, showing: current phase (Initializing, Chunking, Embedding, Running), progress bar with query count (e.g., "45/100"), and elapsed time.

#### Scenario: Progress updates in real-time
- **WHEN** the experiment is running
- **THEN** the progress bar and query count SHALL update as each query completes

#### Scenario: Phase transitions displayed
- **WHEN** the experiment moves from "Chunking" to "Embedding" phase
- **THEN** the phase indicator SHALL update to show "Embedding..."

### Requirement: Experiment completion display
The system SHALL display experiment results upon completion, showing: aggregate metric scores, a link to view the experiment in LangSmith, and add the experiment to the recent experiments list.

#### Scenario: Scores displayed on completion
- **WHEN** an experiment completes successfully
- **THEN** the UI SHALL display the aggregate scores for each selected metric

#### Scenario: LangSmith link provided
- **WHEN** an experiment completes
- **THEN** the UI SHALL show a "View in LangSmith" link that opens the experiment in a new tab

### Requirement: Recent experiments list
The system SHALL display a list of recent experiments for the selected dataset, fetched from LangSmith via `/api/experiments/list`. Each experiment card SHALL show the experiment name, key metric scores, and a "View in LangSmith" link.

#### Scenario: Experiments list loads on dataset selection
- **WHEN** user selects a dataset
- **THEN** the recent experiments list SHALL fetch and display experiments for that dataset

#### Scenario: Compare link when multiple experiments
- **WHEN** there are 2 or more experiments for the selected dataset
- **THEN** the UI SHALL show a "Compare All in LangSmith" link

### Requirement: Error handling
The system SHALL display error states for: failed dataset fetch, failed experiment run, and missing API keys. Errors SHALL be dismissible and allow retry.

#### Scenario: Experiment run fails
- **WHEN** an experiment fails during execution
- **THEN** the UI SHALL display the error message and a "Retry" button

#### Scenario: API key error displayed
- **WHEN** an experiment fails due to missing API key
- **THEN** the error message SHALL indicate which API key is required
