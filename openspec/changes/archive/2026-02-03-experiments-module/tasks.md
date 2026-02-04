## 1. Experiments Module Structure

- [x] 1.1 Create `experiments/` folder structure with `index.ts`, `retriever.interface.ts`, `runner.ts`, `types.ts`
- [x] 1.2 Create `experiments/baseline-vector-rag/` folder with `index.ts` and `retriever.ts`

## 2. Types and Interfaces

- [x] 2.1 Define `Retriever` interface in `retriever.interface.ts` with `name`, `init()`, `retrieve()`, `cleanup()`
- [x] 2.2 Define `ExperimentConfigBase` with shared fields (`name`, `corpus`, `retriever`, `k`)
- [x] 2.3 Define `ChunkLevelExperimentConfig` and `TokenLevelExperimentConfig` discriminated union types
- [x] 2.4 Define `ExperimentResult` type with `experimentName`, `retrieverName`, `metrics`, `metadata`

## 3. Pure Evaluator Functions

- [x] 3.1 Create `evaluation/evaluator.ts` with `evaluateChunkLevel()` function
- [x] 3.2 Add `evaluateTokenLevel()` function to `evaluation/evaluator.ts`
- [x] 3.3 Update `evaluation/index.ts` to export new evaluator functions

## 4. Experiment Runner

- [x] 4.1 Implement `runExperiment()` function in `experiments/runner.ts`
- [x] 4.2 Add PAChunk to ChunkId conversion logic for chunk-level evaluation
- [x] 4.3 Add PAChunk to CharacterSpan conversion logic for token-level evaluation
- [x] 4.4 Implement default metrics selection based on evaluation type
- [x] 4.5 Add duration tracking and metadata collection

## 5. VectorRAGRetriever Implementation

- [x] 5.1 Implement `VectorRAGRetriever` class with constructor accepting config
- [x] 5.2 Implement `init()` method: chunk corpus, generate IDs, embed in batches, add to vector store
- [x] 5.3 Implement `retrieve()` method: embed query, search, optionally rerank, return PAChunks
- [x] 5.4 Implement `cleanup()` method: clear vector store
- [x] 5.5 Export `VectorRAGRetriever` from `baseline-vector-rag/index.ts`

## 6. Backward Compatibility Refactoring

- [x] 6.1 Refactor `ChunkLevelEvaluation.run()` to delegate to `VectorRAGRetriever` + `runExperiment()`
- [x] 6.2 Refactor `TokenLevelEvaluation.run()` to delegate to `VectorRAGRetriever` + `runExperiment()`
- [x] 6.3 Ensure existing tests pass with refactored implementation

## 7. Exports and Integration

- [x] 7.1 Update `experiments/index.ts` to export all public types and functions
- [x] 7.2 Update `packages/eval-lib/src/index.ts` to export experiments module
- [x] 7.3 Build and verify no TypeScript errors

## 8. Testing

- [x] 8.1 Add unit tests for `evaluateChunkLevel()` and `evaluateTokenLevel()` pure functions
- [x] 8.2 Add unit tests for `VectorRAGRetriever` lifecycle (init, retrieve, cleanup)
- [x] 8.3 Add unit tests for `runExperiment()` with mock retriever
- [x] 8.4 Add integration tests verifying backward compatibility of evaluation classes
