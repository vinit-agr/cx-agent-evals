## Why

The current synthetic question strategies (Simple and Dimension-Driven) generate questions purely from document content and LLM imagination. They have no signal from actual user behavior — real vocabulary, intent distribution, pain points, or question complexity. Strategy 3 from the roadmap addresses this by grounding generation in real-world questions users have actually asked, producing evaluation sets that better reflect production query patterns.

## What Changes

- Add a new `RealWorldGroundedStrategy` implementing `QuestionStrategy` that accepts real user questions and uses embedding-based matching to pair them with corpus documents
- Hybrid mode: all matched real questions are included directly (Mode A) plus additional synthetic questions generated using real questions as few-shot examples (Mode B)
- Add optional `embedder` field to `StrategyContext` so strategies can use embedding when needed
- Add passage-splitting utility for matching (avoids document-level embedding dilution)
- Add frontend modal for uploading real-world questions (CSV upload or paste, one question per line)
- Add "Real-World Grounded" as a third strategy option in the strategy selector
- Persist real-world questions in localStorage (same pattern as dimension config)

## Capabilities

### New Capabilities
- `real-world-question-matching`: Embedding-based matching of real questions to corpus documents via passage splitting
- `real-world-grounded-generation`: Hybrid strategy combining direct question reuse (Mode A) with few-shot synthetic generation (Mode B)
- `real-world-questions-ui`: Frontend modal for uploading/pasting real-world questions, strategy card, and config UI

### Modified Capabilities
- `strategy-ground-truth-separation`: Add optional `embedder` to `StrategyContext` interface
- `strategy-selection-ui`: Add third strategy card for "Real-World Grounded"

## Impact

- **Library**: New strategy module at `src/synthetic-datagen/strategies/real-world-grounded/`, minor change to `StrategyContext` type (additive, non-breaking)
- **Frontend**: New modal component, extended strategy selector, new API route params
- **Dependencies**: Uses existing `Embedder` interface; frontend API route creates `OpenAIEmbedder` as default when user doesn't provide one
- **Exports**: New strategy class and options type exported from library entry points
