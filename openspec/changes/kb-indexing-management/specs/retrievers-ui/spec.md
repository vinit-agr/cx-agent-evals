## ADDED Requirements

### Requirement: Retrievers page layout
The system SHALL provide a Retrievers page at `/retrievers` with a two-column layout: a fixed-width configuration panel (left, ~420px) and a flexible content panel (right). The page SHALL use the existing dark theme styling consistent with the Generate Questions and Experiments pages.

#### Scenario: Page renders with two columns
- **WHEN** user navigates to `/retrievers`
- **THEN** the page SHALL display a configuration panel on the left and a content panel on the right

### Requirement: KB selector in configuration panel
The configuration panel SHALL include a KB selector dropdown (reusing the existing `KBSelector` component pattern) that lists all knowledge bases for the current org. Selecting a KB SHALL filter the retriever list and playground to that KB.

#### Scenario: KB selection filters retrievers
- **WHEN** user selects "KB Alpha" from the dropdown
- **THEN** the retriever list and playground SHALL show only retrievers belonging to "KB Alpha"

### Requirement: Pipeline config in configuration panel
The configuration panel SHALL include a retriever configuration section with: a preset dropdown (baseline-vector-rag, bm25, hybrid, hybrid-reranked) with saved configs, an inline `PipelineConfigSummary` showing the active config, and a button to open the `PipelineConfigModal` for full editing. The `k` value SHALL be part of the config and displayed in the summary.

#### Scenario: Preset selection sets config
- **WHEN** user selects "hybrid-reranked" preset
- **THEN** the config summary SHALL update to show hybrid search with reranking, and the default k value

#### Scenario: Custom config via modal
- **WHEN** user opens the PipelineConfigModal and adjusts chunk size to 500 and k to 10
- **THEN** the config summary SHALL reflect the custom settings

### Requirement: Create retriever button
The configuration panel SHALL include a "Create Retriever" button that calls the `retrievers.create` mutation with the selected KB and current pipeline config. The button SHALL be disabled when no KB is selected or no config is set. After creation, the new retriever SHALL appear in the retriever list.

#### Scenario: Create retriever triggers indexing
- **WHEN** user clicks "Create Retriever" with KB and config selected
- **THEN** a retriever SHALL be created and appear in the list with status "indexing"

#### Scenario: Duplicate config shows existing
- **WHEN** user clicks "Create Retriever" with a config that matches an existing retriever
- **THEN** the existing retriever SHALL be highlighted in the list (no duplicate created)

### Requirement: Retriever list
The content panel SHALL display a list of retrievers for the selected KB, fetched via `useQuery(api.retrievers.byKb)`. Each retriever card SHALL display: name, status badge (indexing/ready/error with appropriate colors), config summary (index strategy, search strategy, k value), chunk count (when ready), and action buttons.

#### Scenario: Retriever list updates reactively
- **WHEN** a retriever's indexing job completes
- **THEN** the retriever card SHALL reactively update from "indexing" to "ready" status

#### Scenario: Indexing progress shown
- **WHEN** a retriever has status "indexing"
- **THEN** the card SHALL display indexing progress (processed/total docs) by querying the linked indexing job

### Requirement: Retriever card actions
Each retriever card SHALL provide action buttons: "Cleanup" (deletes indexed data, resets to configuring status) and "Delete" (removes the retriever record). Cleanup SHALL show a confirmation prompt. Delete SHALL show a confirmation prompt.

#### Scenario: Cleanup retriever
- **WHEN** user clicks "Cleanup" on a ready retriever and confirms
- **THEN** the retriever's indexed chunks SHALL be deleted and its status SHALL change to "configuring"

#### Scenario: Delete retriever
- **WHEN** user clicks "Delete" on a retriever and confirms
- **THEN** the retriever record SHALL be removed from the list

### Requirement: Playground section below retriever list
The content panel SHALL include a Retriever Playground section below the retriever list (as specified in the `retriever-playground` capability spec). The playground operates on retrievers for the currently selected KB.

#### Scenario: Playground visible when KB selected
- **WHEN** user has selected a KB
- **THEN** the playground section SHALL be visible below the retriever list
