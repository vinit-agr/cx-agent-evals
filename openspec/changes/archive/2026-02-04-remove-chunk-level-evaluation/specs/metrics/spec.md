## REMOVED Requirements

### Requirement: Chunk-level metric interface
**Reason**: Chunk-level evaluation is being removed entirely.
**Migration**: Use span-based `Metric` interface instead.

### Requirement: ChunkRecall metric
**Reason**: Chunk-level evaluation is being removed entirely.
**Migration**: Use span-based `recall` metric instead.

### Requirement: ChunkPrecision metric
**Reason**: Chunk-level evaluation is being removed entirely.
**Migration**: Use span-based `precision` metric instead.

### Requirement: ChunkF1 metric
**Reason**: Chunk-level evaluation is being removed entirely.
**Migration**: Use span-based `f1` metric instead.

## MODIFIED Requirements

### Requirement: Metric interface
The system SHALL define a `Metric` as `{ readonly name: string; readonly calculate: (retrieved: readonly CharacterSpan[], groundTruth: readonly CharacterSpan[]) => number }`.

#### Scenario: Metric has a name and calculate function
- **WHEN** accessing a metric
- **THEN** it SHALL have a `name` string and a `calculate` function accepting two `CharacterSpan` arrays

### Requirement: Recall metric
The system SHALL provide a `recall` metric computing the fraction of ground truth characters covered by retrieved spans: `overlap_chars / total_gt_chars`. Spans SHALL be merged before computation. It SHALL return `1.0` when ground truth is empty or has zero total characters. The metric name SHALL be `"recall"`.

#### Scenario: Perfect recall
- **WHEN** retrieved covers exactly the ground truth span
- **THEN** the result SHALL be `1.0`

#### Scenario: Half recall
- **WHEN** ground truth is (0,100) and retrieved is (0,50) in the same document
- **THEN** the result SHALL be `0.5`

### Requirement: Precision metric
The system SHALL provide a `precision` metric computing `overlap_chars / total_retrieved_chars`. It SHALL return `0.0` when retrieved is empty. The metric name SHALL be `"precision"`.

#### Scenario: Perfect precision
- **WHEN** retrieved exactly matches ground truth
- **THEN** the result SHALL be `1.0`

#### Scenario: Low precision from over-retrieval
- **WHEN** ground truth is (0,50) and retrieved is (0,100) in the same document
- **THEN** the result SHALL be `0.5`

### Requirement: IoU metric
The system SHALL provide an `iou` metric computing `intersection / union` where `union = total_retrieved + total_gt - intersection`. It SHALL return `1.0` when both are empty, and `0.0` when exactly one is empty. The metric name SHALL be `"iou"`.

#### Scenario: Partial overlap IoU
- **WHEN** ground truth is (0,100) and retrieved is (50,150) in the same document
- **THEN** intersection = 50, union = 150, IoU SHALL be approximately `0.333`

### Requirement: F1 metric
The system SHALL provide an `f1` metric computing `2 * precision * recall / (precision + recall)`. It SHALL return `0.0` when both precision and recall are `0`. The metric name SHALL be `"f1"`.

#### Scenario: Balanced F1
- **WHEN** retrieved and ground truth have 50% overlap
- **THEN** F1 SHALL equal `2 * 0.5 * 0.5 / (0.5 + 0.5) = 0.5`

## RENAMED Requirements

### Requirement: Metric interface
- **FROM**: `TokenLevelMetric`
- **TO**: `Metric`

### Requirement: Recall metric
- **FROM**: `spanRecall` with name `"span_recall"`
- **TO**: `recall` with name `"recall"`

### Requirement: Precision metric
- **FROM**: `spanPrecision` with name `"span_precision"`
- **TO**: `precision` with name `"precision"`

### Requirement: IoU metric
- **FROM**: `spanIoU` with name `"span_iou"`
- **TO**: `iou` with name `"iou"`
