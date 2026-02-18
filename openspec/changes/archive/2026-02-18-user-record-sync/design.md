## Context

The backend `users` table stores a record per Clerk user (clerkId, email, name). Multiple mutations require a `users` record to set `createdBy` foreign keys. The `users:getOrCreate` mutation already exists — it looks up by `clerkId` and creates the record if missing. The problem is purely a frontend wiring gap.

## Goals / Non-Goals

**Goals:**
- Ensure every authenticated user has a `users` table record before any page content renders

**Non-Goals:**
- Changing the backend `users:getOrCreate` mutation
- Adding user profile management
- Handling user deletion or account linking

## Decisions

### 1. Call getOrCreate in OrgGate after org is confirmed

**Decision**: Add a `useMutation` + `useEffect` in OrgGate that calls `users:getOrCreate` once after org confirmation. Gate children on the mutation having completed.

**Alternatives considered**:
- Clerk webhook to auto-create users on sign-up — requires webhook infrastructure, doesn't handle existing users who signed up before the webhook was set up
- Call getOrCreate on every page that needs it — duplicated, error-prone (same pattern we just removed for auth)
- Call in a separate provider component — unnecessary indirection for a single mutation call

**Rationale**: OrgGate already gates all page content behind auth + org. Adding the user sync here ensures it runs exactly once per session, before any mutations fire. The mutation is idempotent so repeated calls are safe.

## Risks / Trade-offs

- **Extra mutation on every page load** → Mitigated: the mutation is fast (single index lookup) and idempotent. Only fires once per OrgGate mount.
- **Brief additional loading state** → The mutation completes in <50ms. Users see the existing branded spinner for marginally longer.
