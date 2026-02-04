## Why

The current evaluation module (`ChunkLevelEvaluation`, `TokenLevelEvaluation`) has retrieval logic hardcoded into the orchestrator, making it impossible to test alternative retrieval methods (BM25, HyDE, agent-based search, hybrid approaches) without duplicating code. We need to separate retrieval from evaluation so experiments with different retrieval strategies can be run against the same ground truth datasets.

## What Changes

- Extract retrieval logic from evaluation orchestrators into a pluggable `Retriever` interface
- Create a new `experiments/` module with:
  - `Retriever` interface that returns `PositionAwareChunk[]`
  - `runExperiment()` function that orchestrates retriever + evaluation
  - Type-safe `ExperimentConfig` with discriminated union based on `evaluationType`
  - `VectorRAGRetriever` as baseline implementation (extracted from current code)
- Add pure `evaluateChunkLevel()` and `evaluateTokenLevel()` functions in evaluation module
- Refactor `ChunkLevelEvaluation` and `TokenLevelEvaluation` to delegate to new architecture (backward compatible)

## Capabilities

### New Capabilities
- `experiments`: Pluggable experiment runner with `Retriever` interface, type-safe config, and baseline vector RAG retriever

### Modified Capabilities
- `evaluation`: Add pure evaluator functions; refactor orchestrators to delegate to experiments module internally (backward compatible)

## Impact

- **Code**: New `packages/eval-lib/src/experiments/` folder with retriever interface, runner, types, and baseline implementation
- **Code**: Modified `packages/eval-lib/src/evaluation/` with new `evaluator.ts` and refactored orchestrators
- **Exports**: New exports from `packages/eval-lib/src/index.ts` for experiments module
- **Dependencies**: None (uses existing interfaces)
- **Breaking Changes**: None (old API preserved as facades)
