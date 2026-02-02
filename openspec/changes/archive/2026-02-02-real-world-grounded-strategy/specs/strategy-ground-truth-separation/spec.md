## MODIFIED Requirements

### Requirement: StrategyContext includes optional embedder
The `StrategyContext` interface SHALL include an optional `embedder` field of type `Embedder`. Existing strategies SHALL continue to work without providing an embedder.

#### Scenario: Embedder is optional
- **WHEN** a strategy is called with a `StrategyContext` that has no `embedder` field
- **THEN** the strategy SHALL function normally (existing behavior unchanged)

#### Scenario: Embedder is provided
- **WHEN** a strategy is called with a `StrategyContext` that includes an `embedder`
- **THEN** the strategy MAY use it for embedding-based operations
