## Why

The current synthetic data generation uses a single prompt-based approach that produces questions with limited diversity — questions cluster around prominent information, lack variety in user personas/intents/complexity, and don't reflect the distribution of real-world queries. Adding a dimension-driven generation strategy and restructuring the module to cleanly separate strategies from ground-truth assignment will produce higher-quality evaluation sets and make it straightforward to add future strategies.

## What Changes

- Restructure `src/synthetic-datagen/` to separate **strategies** (what questions to generate) from **ground-truth assigners** (how to label them as chunk-level or token-level). All strategies work with both evaluation types.
- Add a **dimension-driven strategy** with a full pipeline: auto-discover dimensions from a company website, save to an editable file, pairwise-filter unrealistic dimension value combinations, build a doc-combo relevance matrix, stratified-sample within a question budget, and generate questions with dimension constraints.
- Retain the existing **simple prompt-based strategy** (improved prompts) as a lightweight alternative that doesn't require dimension configuration. Uses `queriesPerDoc`.
- Both strategies produce the same output types (`ChunkLevelGroundTruth[]` / `TokenLevelGroundTruth[]`).

## Capabilities

### New Capabilities
- `dimension-driven-generation`: Auto-discovery of question dimensions from company website, pairwise filtering of unrealistic combinations, doc-combo relevance matrix, stratified sampling, and dimension-constrained question generation.
- `strategy-ground-truth-separation`: Restructured module separating question-generation strategies from chunk-level/token-level ground-truth assignment, enabling any strategy to work with any evaluation type.

### Modified Capabilities
- `synthetic-datagen`: Existing generators are refactored into the new structure. The simple prompt-based approach remains as a strategy. Public API may change due to restructuring.

## Impact

- `src/synthetic-datagen/` — full restructure (strategies/, ground-truth/, quality/ subdirectories)
- `src/types/` — possible new types for dimensions, combos, relevance matrix
- `frontend/src/app/api/generate/route.ts` — will need to support strategy selection (can be deferred to a frontend change)
- `tests/unit/synthetic-datagen/` — tests need updating for new structure
- New dependency: web fetching/crawling for dimension auto-discovery
