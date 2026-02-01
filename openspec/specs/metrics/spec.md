## Purpose

Chunk-level metrics (recall, precision, F1) and token-level span metrics (recall, precision, IoU).

## Requirements

### Requirement: Chunk-level metric interface
The system SHALL define a `ChunkLevelMetric` as `{ readonly name: string; readonly calculate: (retrieved: readonly ChunkId[], groundTruth: readonly ChunkId[]) => number }`.

#### Scenario: Metric has a name and calculate function
- **WHEN** accessing a chunk-level metric
- **THEN** it SHALL have a `name` string and a `calculate` function accepting two `ChunkId` arrays

### Requirement: Token-level metric interface
The system SHALL define a `TokenLevelMetric` as `{ readonly name: string; readonly calculate: (retrieved: readonly CharacterSpan[], groundTruth: readonly CharacterSpan[]) => number }`.

#### Scenario: Metric has a name and calculate function
- **WHEN** accessing a token-level metric
- **THEN** it SHALL have a `name` string and a `calculate` function accepting two `CharacterSpan` arrays

### Requirement: ChunkRecall metric
The system SHALL provide a `chunkRecall` metric that computes `|retrieved ∩ groundTruth| / |groundTruth|`. It SHALL return `1.0` when `groundTruth` is empty (vacuous truth).

#### Scenario: Perfect recall
- **WHEN** retrieved = ["a", "b"] and groundTruth = ["a", "b"]
- **THEN** the result SHALL be `1.0`

#### Scenario: Partial recall
- **WHEN** retrieved = ["a"] and groundTruth = ["a", "b"]
- **THEN** the result SHALL be `0.5`

#### Scenario: Empty ground truth
- **WHEN** groundTruth is empty
- **THEN** the result SHALL be `1.0`

### Requirement: ChunkPrecision metric
The system SHALL provide a `chunkPrecision` metric that computes `|retrieved ∩ groundTruth| / |retrieved|`. It SHALL return `0.0` when `retrieved` is empty.

#### Scenario: Perfect precision
- **WHEN** retrieved = ["a", "b"] and groundTruth = ["a", "b"]
- **THEN** the result SHALL be `1.0`

#### Scenario: Low precision
- **WHEN** retrieved = ["a", "b", "c", "d"] and groundTruth = ["a"]
- **THEN** the result SHALL be `0.25`

### Requirement: ChunkF1 metric
The system SHALL provide a `chunkF1` metric computing `2 * precision * recall / (precision + recall)`. It SHALL return `0.0` when both precision and recall are `0`.

#### Scenario: Balanced F1
- **WHEN** retrieved = ["a", "b"] and groundTruth = ["a", "c"]
- **THEN** recall = 0.5, precision = 0.5, F1 SHALL be `0.5`

### Requirement: Span merging utility
The system SHALL provide `mergeOverlappingSpans(spans: SpanRange[]): SpanRange[]` that merges overlapping or adjacent spans within the same document. Spans from different documents SHALL NOT be merged. Each character SHALL be counted at most once after merging.

#### Scenario: Merge overlapping spans
- **WHEN** merging spans (0,50) and (30,80) in the same document
- **THEN** the result SHALL be a single span (0,80)

#### Scenario: No merge across documents
- **WHEN** merging span (0,50) in doc1 and (0,50) in doc2
- **THEN** the result SHALL be two separate spans

#### Scenario: Adjacent spans merge
- **WHEN** merging spans (0,50) and (50,100) in the same document
- **THEN** the result SHALL be a single span (0,100)

### Requirement: SpanRecall metric
The system SHALL provide a `spanRecall` metric computing the fraction of ground truth characters covered by retrieved spans: `overlap_chars / total_gt_chars`. Spans SHALL be merged before computation. It SHALL return `1.0` when ground truth is empty or has zero total characters.

#### Scenario: Perfect span recall
- **WHEN** retrieved covers exactly the ground truth span
- **THEN** the result SHALL be `1.0`

#### Scenario: Half recall
- **WHEN** ground truth is (0,100) and retrieved is (0,50) in the same document
- **THEN** the result SHALL be `0.5`

### Requirement: SpanPrecision metric
The system SHALL provide a `spanPrecision` metric computing `overlap_chars / total_retrieved_chars`. It SHALL return `0.0` when retrieved is empty.

#### Scenario: Perfect span precision
- **WHEN** retrieved exactly matches ground truth
- **THEN** the result SHALL be `1.0`

#### Scenario: Low precision from over-retrieval
- **WHEN** ground truth is (0,50) and retrieved is (0,100) in the same document
- **THEN** the result SHALL be `0.5`

### Requirement: SpanIoU metric
The system SHALL provide a `spanIoU` metric computing `intersection / union` where `union = total_retrieved + total_gt - intersection`. It SHALL return `1.0` when both are empty, and `0.0` when exactly one is empty.

#### Scenario: Partial overlap IoU
- **WHEN** ground truth is (0,100) and retrieved is (50,150) in the same document
- **THEN** intersection = 50, union = 150, IoU SHALL be approximately `0.333`

### Requirement: Overlap calculation
The system SHALL provide `calculateOverlap(spansA: SpanRange[], spansB: SpanRange[]): number` that returns the total character overlap between two sets of spans after merging each set.

#### Scenario: Cross-document overlap is zero
- **WHEN** spansA are in doc1 and spansB are in doc2
- **THEN** the overlap SHALL be `0`
