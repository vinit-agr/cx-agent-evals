## Why

The backend now supports two synthetic question generation strategies (simple prompt-based and dimension-driven), but the frontend only exposes the simple strategy. Users need a way to choose their strategy and, for the dimension-driven path, configure dimensions through an interactive workflow — auto-discovering from a company website, reviewing/editing dimensions, and setting a question budget.

## What Changes

- Add a **strategy selector** to the generation config sidebar — two cards letting the user choose "Simple" or "Dimension-Driven"
- Add a **dimension setup wizard** (modal overlay, 3 steps) for the dimension-driven strategy:
  - Step 1: Enter company website URL → auto-discover dimensions via new API endpoint
  - Step 2: Review and edit discovered dimensions (add/remove dimensions, edit values)
  - Step 3: Set total question count and confirm
- After wizard completion, show a **configured summary** in the sidebar with dimension count and an "Edit" button that re-opens the wizard
- Add a **new API endpoint** `POST /api/discover-dimensions` that accepts a URL and returns discovered dimensions
- Update **`POST /api/generate`** to accept strategy type and dimension-driven parameters (dimensions array, totalQuestions)

## Capabilities

### New Capabilities
- `strategy-selection-ui`: Strategy picker in sidebar and conditional config display for each strategy
- `dimension-wizard-ui`: Three-step modal wizard for dimension discovery, review/edit, and question budget configuration
- `dimension-discovery-api`: New API endpoint for auto-discovering dimensions from a company website

### Modified Capabilities
- `question-generation-ui`: GenerateConfig component now includes strategy selection and dimension-driven config summary
- `backend-api`: Generate endpoint accepts strategy type and dimension-driven parameters; pipeline LLM calls parallelized for performance

## Impact

- `frontend/src/components/GenerateConfig.tsx` — major changes for strategy selection and config display
- `frontend/src/components/` — new components: StrategySelector, DimensionWizard, DimensionEditor, DimensionSummary
- `frontend/src/app/api/generate/route.ts` — accept strategy + dimensions params, use DimensionDrivenStrategy
- `frontend/src/app/api/discover-dimensions/route.ts` — new endpoint
- `frontend/src/app/page.tsx` — state management for strategy and dimensions, localStorage persistence
- `src/synthetic-datagen/strategies/dimension-driven/filtering.ts` — parallelized pairwise filter LLM calls
- `src/synthetic-datagen/strategies/dimension-driven/relevance.ts` — parallelized doc summarization and combo assignment LLM calls
- `src/synthetic-datagen/strategies/dimension-driven/generator.ts` — per-document batch generation, progress callback
- `src/synthetic-datagen/strategies/types.ts` — ProgressCallback, ProgressEvent types
