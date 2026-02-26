## ADDED Requirements

### Requirement: Multi-retriever query interface
The system SHALL provide a playground section within the Retrievers page that allows the user to select one or more "ready" retrievers for the current KB via checkboxes, enter a query string, and submit a single search. The playground SHALL fire parallel `retrieve` action calls (one per selected retriever) and display results side-by-side in columns.

#### Scenario: Single retriever query
- **WHEN** user selects one ready retriever, enters a query, and clicks Search
- **THEN** the playground SHALL call the `retrieve` action and display ranked chunks with scores in a single column

#### Scenario: Multi-retriever comparison
- **WHEN** user selects two ready retrievers, enters a query, and clicks Search
- **THEN** the playground SHALL fire two parallel retrieve calls and display results in two side-by-side columns, one per retriever

#### Scenario: Only ready retrievers selectable
- **WHEN** a retriever has status "indexing" or "error"
- **THEN** its checkbox SHALL be disabled in the playground

### Requirement: Result display per retriever
Each retriever's result column SHALL display: the retriever name, number of results, latency (time from request to response), and a list of chunks ordered by score. Each chunk SHALL show: rank number, document ID with character range (e.g., `doc-3:420-890`), similarity score (formatted to 2 decimal places), and a truncated content preview (expandable on click).

#### Scenario: Results show ranked chunks
- **WHEN** a retrieve call returns 5 chunks
- **THEN** the column SHALL display all 5 chunks with rank, doc reference, score, and content preview

#### Scenario: Latency displayed
- **WHEN** a retrieve call completes
- **THEN** the column SHALL display the round-trip latency in milliseconds

### Requirement: Loading and error states
The playground SHALL show a loading spinner in each retriever's column while the retrieve call is pending. If a retrieve call fails, the column SHALL display the error message in red without affecting other columns.

#### Scenario: One retriever fails, others succeed
- **WHEN** querying three retrievers and one fails
- **THEN** the failed retriever's column SHALL show the error, while the other two columns SHALL show their results normally

### Requirement: Empty state
The playground SHALL display an informational message when no ready retrievers exist for the selected KB, guiding the user to create one first.

#### Scenario: No ready retrievers
- **WHEN** the selected KB has no retrievers with status "ready"
- **THEN** the playground SHALL display "No ready retrievers. Create one above to start querying."
