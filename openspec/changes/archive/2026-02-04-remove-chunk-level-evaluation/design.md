## Context

The RAG evaluation system currently supports two evaluation paradigms:
1. **Chunk-level**: Compares retrieved chunk IDs against ground truth chunk IDs (binary set matching)
2. **Token-level**: Compares character positions of retrieved content against ground truth spans (overlap-based)

This dual system creates branching logic throughout:
- Types: `ChunkLevelGroundTruth` vs `TokenLevelGroundTruth`, `ChunkId` vs `CharacterSpan`
- Metrics: `chunk-level/` folder vs `token-level/` folder
- Evaluation classes: `ChunkLevelEvaluation` vs `TokenLevelEvaluation`
- Experiments: Discriminated union `ExperimentConfig`
- Synthetic datagen: Two ground truth assigners
- LangSmith: Separate upload/load functions
- Frontend: Mode selection, branching API calls

Token-level evaluation is strictly more informative (measures overlap, not just binary match) and subsumes chunk-level semantics. All retrievers already return `PositionAwareChunk[]`.

## Goals / Non-Goals

**Goals:**
- Remove all chunk-level evaluation code, types, and APIs
- Rename `TokenLevel*` types/functions to simpler names (remove the prefix)
- Simplify `ExperimentConfig` to a single type (no discriminated union)
- Remove frontend mode selection (single "Generate Questions" flow)
- Require all chunkers to be `PositionAwareChunker`
- Reduce codebase complexity and maintenance burden

**Non-Goals:**
- Adding new evaluation capabilities
- Changing how token-level evaluation works
- Modifying the experiments UI (separate future work)
- Backward compatibility for existing chunk-level datasets

## Decisions

### Decision 1: Rename token-level types to simpler names
**Choice**: Remove `TokenLevel` prefix from all type names.
**Rationale**: With only one evaluation type, the prefix is noise. Simpler names improve readability.
**Alternatives considered**: Keep `TokenLevel` prefix for historical clarity. Rejected because it adds cognitive load with no benefit.

| Old Name | New Name |
|----------|----------|
| `TokenLevelGroundTruth` | `GroundTruth` |
| `TokenLevelDatasetExample` | `DatasetExample` |
| `TokenLevelDatasetExampleSchema` | `DatasetExampleSchema` |
| `TokenLevelGroundTruthAssigner` | `GroundTruthAssigner` |
| `TokenLevelEvaluation` | `Evaluation` |
| `TokenLevelEvaluationConfig` | `EvaluationConfig` |
| `TokenLevelRunOptions` | `RunOptions` |
| `TokenLevelMetric` | `Metric` |
| `TokenLevelExperimentConfig` | `ExperimentConfig` |
| `evaluateTokenLevel` | `evaluate` |
| `uploadTokenLevelDataset` | `uploadDataset` |
| `loadTokenLevelDataset` | `loadDataset` |

### Decision 2: Rename span metrics to simpler names
**Choice**: Remove `span_` prefix from metric names.
**Rationale**: With only span-based metrics, the prefix is redundant.

| Old Name | New Name |
|----------|----------|
| `span_recall` | `recall` |
| `span_precision` | `precision` |
| `span_iou` | `iou` |
| `span_f1` | `f1` |

### Decision 3: Move metric files up from token-level folder
**Choice**: Move files from `src/evaluation/metrics/token-level/` to `src/evaluation/metrics/`.
**Rationale**: Eliminates unnecessary folder nesting. Delete the empty `token-level/` and `chunk-level/` folders.

### Decision 4: Rename token-level.ts to evaluation.ts
**Choice**: Rename the file containing the `Evaluation` class.
**Rationale**: Consistent with the type renaming. The file now contains the only evaluation class.

### Decision 5: Remove EvaluationType entirely
**Choice**: Delete the `EvaluationType` type from primitives.
**Rationale**: With only one evaluation type, a discriminating type is pointless. Code that needs to know "evaluation type" can assume span-based.

### Decision 6: Remove basic chunker adapter
**Choice**: Require all chunkers to be `PositionAwareChunker`. Remove `ChunkerPositionAdapter`.
**Rationale**: Position information is always required. Forcing position-aware chunkers makes the requirement explicit and removes runtime wrapping.

### Decision 7: Simplify ExperimentConfig
**Choice**: Remove discriminated union, make `ExperimentConfig` a single interface.
**Rationale**: No longer need to branch on evaluation type. Ground truth is always `GroundTruth[]`, metrics are always `Metric[]`.

### Decision 8: Keep PositionAwareChunk name
**Choice**: Do not rename `PositionAwareChunk` to `Chunk`.
**Rationale**: The name explicitly documents that chunks have position information, which is now a requirement.

## Risks / Trade-offs

**Risk**: Breaking change for any external consumers using chunk-level APIs.
**Mitigation**: This is an internal tool with no external consumers. No migration path needed.

**Risk**: Existing LangSmith datasets with chunk-level ground truth become unusable.
**Mitigation**: Accept this. Users can regenerate datasets. No backward compatibility requirement.

**Trade-off**: Removing `ChunkerPositionAdapter` means basic chunkers can't be used.
**Mitigation**: The `RecursiveCharacterChunker` already supports position tracking. Any new chunker should implement `PositionAwareChunker`.

## Deletion Plan

### Files to DELETE entirely
1. `src/evaluation/metrics/chunk-level/` (entire folder)
2. `src/evaluation/chunk-level.ts`
3. `src/synthetic-datagen/ground-truth/chunk-level.ts`
4. `src/chunkers/adapter.ts` (ChunkerPositionAdapter)
5. `src/components/ModeSelect.tsx` (frontend)
6. `tests/unit/metrics/chunk-metrics.test.ts`

### Files to RENAME
1. `src/evaluation/token-level.ts` → `src/evaluation/evaluation.ts`
2. Move `src/evaluation/metrics/token-level/*.ts` → `src/evaluation/metrics/`

## Migration Order

1. **Phase 1 - Types**: Remove chunk-level types, rename token-level types
2. **Phase 2 - Metrics**: Delete chunk-level metrics, move token-level metrics up, rename
3. **Phase 3 - Evaluation**: Delete chunk-level class, rename token-level class
4. **Phase 4 - Experiments**: Simplify ExperimentConfig, update runner
5. **Phase 5 - Synthetic datagen**: Remove chunk-level assigner, rename token-level assigner
6. **Phase 6 - LangSmith**: Remove chunk-level functions, rename token-level functions
7. **Phase 7 - Frontend**: Remove mode selection, simplify generate API
8. **Phase 8 - Tests**: Update all tests
9. **Phase 9 - Exports & Docs**: Update index files, README, CLAUDE.md
