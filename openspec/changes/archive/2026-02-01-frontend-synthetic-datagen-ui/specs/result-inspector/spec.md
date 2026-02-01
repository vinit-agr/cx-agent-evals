## ADDED Requirements

### Requirement: Question selection shows source document
When the user selects a generated question from the list, the UI SHALL display the full text of the source document alongside the question.

#### Scenario: Click a question to see its document
- **WHEN** user clicks a question that was generated from "intro.md"
- **THEN** the right panel displays the full content of "intro.md"

### Requirement: Chunk-level highlighting
In chunk-level mode, selecting a question SHALL highlight the relevant chunk texts within the source document. Each relevant chunk SHALL be highlighted with a distinct background color using `<mark>` elements.

#### Scenario: Relevant chunks highlighted
- **WHEN** user selects a question in chunk-level mode that has 2 relevant chunks
- **THEN** both chunk text regions are highlighted in the document view with visible background colors

#### Scenario: No relevant chunks
- **WHEN** a question has no relevant chunks (all were filtered as invalid)
- **THEN** the document is displayed without any highlights and a notice says "No relevant chunks found"

### Requirement: Token-level span highlighting
In token-level mode, selecting a question SHALL highlight the exact character spans in the source document. Spans are highlighted using start/end character offsets to wrap the substring in `<mark>` elements.

#### Scenario: Character spans highlighted
- **WHEN** user selects a question in token-level mode with a span from position 10 to 50
- **THEN** characters 10 through 49 of the document text are wrapped in a highlight

#### Scenario: Multiple spans highlighted
- **WHEN** a question has 3 relevant spans in the same document
- **THEN** all 3 spans are highlighted, potentially with different colors to distinguish them

### Requirement: Highlighted text scrolls into view
When a question is selected and highlights are rendered, the document view SHALL auto-scroll to the first highlighted region.

#### Scenario: Auto-scroll to highlight
- **WHEN** user selects a question whose first relevant span is deep in a long document
- **THEN** the document viewer scrolls so the first highlight is visible

### Requirement: Document viewer fixed width
The document viewer pane SHALL maintain a constant width regardless of content. Long text and URLs SHALL wrap within the pane using word-break. The viewer SHALL NOT cause horizontal scrolling or push the left sidebars off-screen.

#### Scenario: Long unbroken text in document
- **WHEN** a document contains long URLs or unbroken strings
- **THEN** the text wraps within the viewer pane and no horizontal scrollbar appears

#### Scenario: Sidebar stability on question selection
- **WHEN** user clicks different questions with varying content lengths
- **THEN** the left sidebar panels (corpus loader, question list) remain at their fixed widths without shifting
