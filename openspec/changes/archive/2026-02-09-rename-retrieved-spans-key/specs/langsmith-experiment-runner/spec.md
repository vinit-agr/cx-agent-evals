## MODIFIED Requirements

### Requirement: Target function shape
The target function passed to LangSmith's `evaluate()` SHALL accept `{ query: string }` as input and return `{ relevantSpans: Array<{ docId: string, start: number, end: number, text: string }> }`. It SHALL call `retriever.retrieve(query, k)` and convert the resulting `PositionAwareChunk[]` to serialized span objects.

#### Scenario: Target function retrieves and serializes
- **WHEN** LangSmith calls the target function with `{ query: "What is X?" }`
- **THEN** it SHALL call `retriever.retrieve("What is X?", k)` and return the chunks converted to span objects in `relevantSpans`
