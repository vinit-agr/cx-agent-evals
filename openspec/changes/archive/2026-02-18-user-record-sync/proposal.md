## Why

The backend requires a `users` table record (keyed by Clerk ID) for every authenticated user. Several mutations (`knowledgeBases:create`, `generation:start`, `experiments:run`, `jobs:list`) look up the user by `clerkId` and throw "User not found" if no record exists. The `users:getOrCreate` mutation exists in the backend but is never called from the frontend, so the user record is never created and all write operations fail.

## What Changes

- Call `users:getOrCreate` from the frontend after authentication and org selection are confirmed, before rendering page content
- This ensures the user record exists in the `users` table before any mutation that requires it

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `frontend-app-shell`: The AuthGate/OrgGate flow adds a user record sync step after org is confirmed, calling `users:getOrCreate` before rendering children.

## Impact

- `packages/frontend/src/components/AuthGate.tsx` — add `useMutation(api.users.getOrCreate)` call after org is confirmed
- No backend changes. The `users:getOrCreate` mutation already exists and handles both creation and idempotent lookup.
