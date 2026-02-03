## Context

The synthetic-datagen module was restructured in a previous change to separate concerns:
- **Strategies** (`strategies/`) generate questions via different approaches (simple, dimension-driven, real-world-grounded)
- **Ground-truth assigners** (`ground-truth/`) assign chunk IDs or character spans to generated questions

The legacy monolithic generators (`chunk-level/generator.ts`, `token-level/generator.ts`) combined both responsibilities in single classes. They were kept with "legacy re-exports for backward compatibility" but are no longer used by the frontend or internal code. The new `generate()` function in `index.ts` orchestrates strategy + assigner composition.

## Goals / Non-Goals

**Goals:**
- Remove unused legacy code to reduce maintenance burden
- Simplify the module's public API surface
- Ensure no test coverage is lost

**Non-Goals:**
- Refactoring the new strategy/assigner architecture
- Adding new functionality
- Changing the behavior of the new `generate()` function

## Decisions

### 1. Delete legacy folders entirely (vs. deprecation warnings)

**Decision**: Delete `chunk-level/` and `token-level/` folders completely.

**Rationale**: These are internal-facing classes with no external consumers (the library is not published to npm yet). Adding deprecation warnings would just delay the inevitable and keep dead code around.

### 2. Delete legacy test file (vs. migrating tests)

**Decision**: Delete `generators.test.ts` entirely.

**Rationale**: The `ground-truth/assigners.test.ts` file already covers the exact same scenarios:
- Valid chunk ID assignment
- Invalid chunk ID filtering
- Valid span assignment
- Unfound excerpts skipped

No test migration needed — coverage is already present in the assigner tests.

### 3. Keep `base.ts` (SyntheticDatasetGenerator base class)

**Decision**: Keep `base.ts` in place.

**Rationale**: While the legacy generators extended this base class, it's also used for the `LLMClient` type and `openAIClientAdapter` which are still needed by strategies and assigners.

## Risks / Trade-offs

**[Risk] External code may import legacy classes** → The library is not published to npm. Internal usage has been migrated. Breaking external consumers is acceptable for this internal cleanup.

**[Risk] Test coverage loss** → Verified that `assigners.test.ts` covers the same scenarios. No coverage loss.
