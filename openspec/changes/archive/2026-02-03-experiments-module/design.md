## Context

The eval-lib currently has evaluation orchestrators (`ChunkLevelEvaluation`, `TokenLevelEvaluation`) that combine retrieval logic with metric calculation. This tight coupling prevents testing alternative retrieval strategies (BM25, HyDE, agent-based search) without code duplication.

The codebase follows a consistent pattern: interfaces in `*.interface.ts` files with implementations in sibling files (e.g., `chunkers/chunker.interface.ts` + `chunkers/recursive-character.ts`). The synthetic-datagen module uses a strategy pattern (`QuestionStrategy` interface) that we can mirror for retrievers.

## Goals / Non-Goals

**Goals:**
- Extract retrieval logic into a pluggable `Retriever` interface
- Enable running experiments with different retrieval methods against the same ground truth
- Provide type-safe experiment configuration based on evaluation type
- Maintain backward compatibility for existing `ChunkLevelEvaluation` and `TokenLevelEvaluation` APIs
- Create pure evaluation functions that can be used independently

**Non-Goals:**
- Implementing additional retrieval methods beyond VectorRAG (future work)
- Changing the metrics implementation
- Adding experiment persistence or comparison UI
- Modifying the ground truth or dataset formats

## Decisions

### Decision 1: Retriever returns PositionAwareChunk[]

**Choice:** The `Retriever` interface always returns `PositionAwareChunk[]`, regardless of evaluation type.

**Rationale:** `PositionAwareChunk` is the richest representation, containing all information needed for both chunk-level (content hash → ChunkId) and token-level (docId, start, end → CharacterSpan) evaluation. This allows a single retriever implementation to be used with either evaluation type.

**Alternatives considered:**
- Generic `Retriever<T>` with type parameter: Adds complexity, requires separate implementations for each evaluation type
- Separate `ChunkLevelRetriever` and `TokenLevelRetriever`: Code duplication, retrievers doing the same work

### Decision 2: Discriminated union for ExperimentConfig

**Choice:** Use TypeScript discriminated union with `evaluationType` as the discriminant.

```typescript
type ExperimentConfig = ChunkLevelExperimentConfig | TokenLevelExperimentConfig;
```

**Rationale:** Provides compile-time type safety ensuring ground truth and metrics types match the evaluation type. TypeScript's type narrowing works naturally in the runner implementation.

**Alternatives considered:**
- Generic `ExperimentConfig<T>`: More complex, less ergonomic for consumers
- Runtime validation only: Misses type errors at compile time

### Decision 3: Conversion happens in runner, not retriever

**Choice:** The `runExperiment()` function handles converting `PositionAwareChunk[]` to `ChunkId[]` or `CharacterSpan[]` based on `evaluationType`.

**Rationale:** Keeps retriever implementations simple and focused on retrieval. The runner already knows the evaluation type from the config, making it the natural place for conversion.

### Decision 4: Backward compatibility via delegation

**Choice:** Keep existing `ChunkLevelEvaluation` and `TokenLevelEvaluation` classes, but internally delegate to `VectorRAGRetriever` + `runExperiment()`.

**Rationale:** Existing documentation and usage patterns reference these classes. Delegation preserves the API while benefiting from the new architecture.

### Decision 5: File organization follows existing patterns

**Choice:**
```
experiments/
  index.ts
  retriever.interface.ts
  runner.ts
  types.ts
  baseline-vector-rag/
    index.ts
    retriever.ts
```

**Rationale:** Mirrors the structure of other modules (chunkers, embedders, vector-stores). Interface in dedicated file, implementations in subfolders.

## Risks / Trade-offs

**[Risk] Backward compatibility bugs** → Comprehensive tests comparing old and new behavior for same inputs. Run existing test suite against refactored code.

**[Risk] Performance regression from extra abstraction layer** → The additional function calls are negligible compared to I/O (embedding, vector search). No measurable impact expected.

**[Trade-off] PAChunk includes more data than chunk-level eval needs** → Accepted for simplicity. Memory overhead is minimal since chunks already exist in vector store.

**[Trade-off] Runner must know conversion logic** → Accepted. Conversion is simple (two map operations) and keeps retriever implementations clean.
