## ADDED Requirements

### Requirement: Create retriever mutation
The system SHALL provide a Convex mutation `retrievers.create` that accepts `kbId` (Id referencing `knowledgeBases`), `retrieverConfig` (object containing `name`, `index`, `query`, `search`, `refinement`, and `k` fields), and computes both `indexConfigHash` (from the index stage config) and `retrieverConfigHash` (from the full config including `k`). Before creating, it SHALL check for an existing retriever with the same `(kbId, retrieverConfigHash)` — if found, return the existing retriever ID. Otherwise, it SHALL create a `retrievers` record with status `"indexing"`, trigger indexing via `internal.indexing.startIndexing`, link the returned `indexingJobId`, and return the new retriever ID.

#### Scenario: Create new retriever triggers indexing
- **WHEN** calling `retrievers.create` with a KB and pipeline config that has no existing retriever
- **THEN** a retriever record SHALL be created with status `"indexing"`, indexing SHALL be started via the WorkPool indexing service, and the retriever ID SHALL be returned

#### Scenario: Duplicate retriever returns existing
- **WHEN** calling `retrievers.create` with a `(kbId, retrieverConfig)` that matches an existing retriever's `retrieverConfigHash`
- **THEN** the existing retriever's ID SHALL be returned without creating a new record or triggering indexing

#### Scenario: Shared index config skips re-indexing
- **WHEN** creating a retriever whose `indexConfigHash` matches an already-completed indexing job for the same KB
- **THEN** the indexing service SHALL return `alreadyCompleted: true` and the retriever status SHALL be set to `"ready"` immediately

### Requirement: List retrievers by KB query
The system SHALL provide a Convex query `retrievers.byKb` that accepts a `kbId` and returns all retrievers for that KB, including `name`, `status`, `retrieverConfig`, `indexConfigHash`, `retrieverConfigHash`, `chunkCount`, `createdAt`, and `indexingJobId`. Results SHALL be ordered by creation date descending.

#### Scenario: List retrievers for a KB
- **WHEN** calling `retrievers.byKb` with a valid KB ID
- **THEN** the query SHALL return all retrievers for that KB with their current status

### Requirement: List retrievers by org query
The system SHALL provide a Convex query `retrievers.byOrg` that returns all retrievers for the current user's org, optionally filtered by `status`. This enables the experiments page to list all "ready" retrievers across KBs.

#### Scenario: List ready retrievers for org
- **WHEN** calling `retrievers.byOrg` with status filter `"ready"`
- **THEN** the query SHALL return only retrievers with status `"ready"` across all KBs in the org

### Requirement: Get retriever query
The system SHALL provide a Convex query `retrievers.get` that accepts a retriever ID and returns the full retriever record including config, status, and indexing job details.

#### Scenario: Get retriever with indexing progress
- **WHEN** calling `retrievers.get` for a retriever with status `"indexing"`
- **THEN** the query SHALL return the retriever record with the `indexingJobId` that can be used to query indexing progress

### Requirement: Delete retriever mutation
The system SHALL provide a Convex mutation `retrievers.remove` that accepts a retriever ID, verifies org ownership, and deletes the retriever record. It SHALL NOT delete the underlying document chunks (those are shared by `indexConfigHash` and may be used by other retrievers).

#### Scenario: Delete retriever preserves chunks
- **WHEN** deleting a retriever
- **THEN** the retriever record SHALL be removed but document chunks with the same `indexConfigHash` SHALL remain in the `documentChunks` table

### Requirement: Cleanup retriever indexed data mutation
The system SHALL provide a Convex mutation `retrievers.cleanup` that accepts a retriever ID, deletes all `documentChunks` matching the retriever's `(kbId, indexConfigHash)`, deletes the associated `indexingJobs` record, and updates the retriever status to `"configuring"`. Before deleting chunks, it SHALL verify no other retriever with the same `(kbId, indexConfigHash)` exists (to avoid breaking shared chunks).

#### Scenario: Cleanup when no other retriever shares chunks
- **WHEN** cleaning up a retriever whose `indexConfigHash` is not shared by any other retriever on the same KB
- **THEN** the document chunks SHALL be deleted, the indexing job record SHALL be deleted, and the retriever status SHALL be set to `"configuring"`

#### Scenario: Cleanup blocked when chunks are shared
- **WHEN** cleaning up a retriever whose `indexConfigHash` is shared by another retriever on the same KB
- **THEN** the cleanup SHALL fail with an error indicating the chunks are shared

### Requirement: Update retriever status on indexing completion
The system SHALL update the retriever's status from `"indexing"` to `"ready"` when the linked indexing job completes successfully, and to `"error"` when the indexing job fails. The `chunkCount` field SHALL be populated from the indexing job's `totalChunks`. This can be achieved by querying the indexing job status reactively or via a callback.

#### Scenario: Retriever becomes ready after indexing
- **WHEN** the indexing job linked to a retriever completes with status `"completed"`
- **THEN** the retriever's status SHALL be updated to `"ready"` and `chunkCount` SHALL be set

#### Scenario: Retriever shows error after indexing failure
- **WHEN** the indexing job linked to a retriever fails
- **THEN** the retriever's status SHALL be updated to `"error"` with the error message from the indexing job

### Requirement: Compute retrieverConfigHash
The system SHALL compute `retrieverConfigHash` as a deterministic SHA-256 hash of the full retriever config including all four stages (index, query, search, refinement) and `k`. The hash SHALL use sorted keys for deterministic serialization, matching the pattern used by `computeIndexConfigHash` in eval-lib.

#### Scenario: Same config produces same hash
- **WHEN** two retriever configs have identical index, query, search, refinement, and k values but different names
- **THEN** they SHALL produce the same `retrieverConfigHash`

#### Scenario: Different k produces different hash
- **WHEN** two retriever configs are identical except for k (k=5 vs k=10)
- **THEN** they SHALL produce different `retrieverConfigHash` values
