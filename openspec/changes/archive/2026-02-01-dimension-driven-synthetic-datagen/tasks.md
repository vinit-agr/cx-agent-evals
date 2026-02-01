## 1. Shared Interfaces and Types

- [x] 1.1 Create `src/synthetic-datagen/strategies/types.ts` with `QuestionStrategy`, `StrategyContext`, and `GeneratedQuery` interfaces
- [x] 1.2 Create `src/synthetic-datagen/ground-truth/types.ts` with `GroundTruthAssigner<T>` interface
- [x] 1.3 Add dimension types: `Dimension`, `DimensionCombo`, `RelevanceMatrix` to strategy types

## 2. Ground-Truth Assigners (extract from existing generators)

- [x] 2.1 Create `src/synthetic-datagen/ground-truth/chunk-level.ts` — extract chunking, chunk ID generation, and LLM-based chunk ID assignment from `ChunkLevelSyntheticDatasetGenerator`
- [x] 2.2 Create `src/synthetic-datagen/ground-truth/token-level.ts` — extract excerpt extraction, span finding, and whitespace-normalized fallback from `TokenLevelSyntheticDatasetGenerator`
- [x] 2.3 Write tests for both assigners matching existing test cases in `tests/unit/synthetic-datagen/generators.test.ts`

## 3. Simple Strategy (refactor existing generators)

- [x] 3.1 Create `src/synthetic-datagen/strategies/simple/generator.ts` implementing `QuestionStrategy` with improved prompts (few-shot examples, question-type constraints, anti-patterns)
- [x] 3.2 Write tests for simple strategy

## 4. Dimension-Driven Strategy — Discovery

- [x] 4.1 Create `src/synthetic-datagen/strategies/dimension-driven/discovery.ts` — fetch website content (up to 5 same-domain pages), call LLM to extract dimensions, write JSON file
- [x] 4.2 Create `src/synthetic-datagen/strategies/dimension-driven/dimensions.ts` — load and validate dimensions JSON file (Zod schema)
- [x] 4.3 Write tests for discovery and dimensions loading

## 5. Dimension-Driven Strategy — Filtering

- [x] 5.1 Create `src/synthetic-datagen/strategies/dimension-driven/filtering.ts` — generate all pairwise dimension projections, LLM-filter unrealistic pairs, compose valid full combinations
- [x] 5.2 Write tests for pairwise filtering and combo composition

## 6. Dimension-Driven Strategy — Relevance Matrix and Sampling

- [x] 6.1 Create `src/synthetic-datagen/strategies/dimension-driven/relevance.ts` — LLM-generate doc summaries, batch-assign combos to docs, output `(docId, combo)` pairs
- [x] 6.2 Create `src/synthetic-datagen/strategies/dimension-driven/sampling.ts` — stratified sampling within `totalQuestions` budget (combo coverage + doc coverage constraints)
- [x] 6.3 Write tests for relevance matrix and sampling logic

## 7. Dimension-Driven Strategy — Orchestration

- [x] 7.1 Create `src/synthetic-datagen/strategies/dimension-driven/generator.ts` — `DimensionDrivenStrategy` implementing `QuestionStrategy`, orchestrates: load dimensions → filter → relevance → sample → generate
- [x] 7.2 Write integration test for end-to-end dimension-driven pipeline with mock LLM

## 8. Public API and Wiring

- [x] 8.1 Create `src/synthetic-datagen/index.ts` — public API that composes strategy + assigner, supports both evaluation types and both strategies
- [x] 8.2 Update `frontend/src/app/api/generate/route.ts` to use new API (default to simple strategy for backward compatibility)
- [x] 8.3 Keep old `src/synthetic-datagen/chunk-level/` and `token-level/` directories — legacy re-exports preserved for backward compatibility

## 9. Cleanup and Validation

- [x] 9.1 Old tests in `tests/unit/synthetic-datagen/generators.test.ts` retained as regression tests (still pass)
- [x] 9.2 Verify all existing functionality works via the new structure — 100/100 tests pass, TypeScript compiles clean
