## MODIFIED Requirements

### Requirement: Root-level AuthGate component
The OrgGate SHALL call `users:getOrCreate` after org confirmation and before rendering children. This ensures the authenticated user has a record in the `users` table. Children SHALL NOT render until the mutation has completed.

#### Scenario: User record created on first sign-in
- **WHEN** a user signs in for the first time and reaches the OrgGate with an active org
- **THEN** the OrgGate SHALL call `users:getOrCreate`, which creates a new user record with the Clerk ID, email, and name

#### Scenario: Existing user record found
- **WHEN** a returning user signs in and reaches the OrgGate
- **THEN** the OrgGate SHALL call `users:getOrCreate`, which returns the existing user record without modification

#### Scenario: Children blocked until user record sync completes
- **WHEN** the `users:getOrCreate` mutation is in progress
- **THEN** the OrgGate SHALL show a spinner and not render page content
