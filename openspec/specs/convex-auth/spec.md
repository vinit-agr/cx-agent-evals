## ADDED Requirements

### Requirement: Clerk + Convex authentication setup
The system SHALL configure Clerk as the authentication provider for Convex. The Next.js frontend SHALL wrap the application with `ClerkProvider` and `ConvexProviderWithClerk` in the root layout. The Clerk JWT template SHALL be configured to include `org_id` and `org_role` in token claims sent to Convex.

#### Scenario: Authenticated user can call Convex functions
- **WHEN** a user is signed in via Clerk and has an active organization selected
- **THEN** all Convex queries, mutations, and actions SHALL have access to the user's identity via `ctx.auth.getUserIdentity()`

#### Scenario: Unauthenticated requests are rejected
- **WHEN** a Convex function is called without a valid Clerk JWT
- **THEN** `ctx.auth.getUserIdentity()` SHALL return null, and the function SHALL throw an "Unauthenticated" error

### Requirement: Convex auth config file
The system SHALL provide a `convex/auth.config.ts` file with a default export satisfying `AuthConfig` from `convex/server`. The config SHALL specify Clerk as a provider with `domain` set to `process.env.CLERK_JWT_ISSUER_DOMAIN` and `applicationID: "convex"`. The `CLERK_JWT_ISSUER_DOMAIN` environment variable SHALL be set in the Convex dashboard (not in local `.env` files) with the Issuer URL from the Clerk "convex" JWT template.

#### Scenario: Convex validates Clerk JWTs
- **WHEN** the backend is deployed with `CLERK_JWT_ISSUER_DOMAIN` set in the Convex dashboard
- **THEN** Convex SHALL validate incoming Clerk JWTs using the configured issuer domain

#### Scenario: Missing issuer domain blocks deployment
- **WHEN** `CLERK_JWT_ISSUER_DOMAIN` is not set in the Convex dashboard
- **THEN** `npx convex dev` SHALL fail with an error indicating the environment variable is required

### Requirement: Auth context helper function
The system SHALL provide a `getAuthContext(ctx)` helper function in `convex/lib/auth.ts` that extracts and validates the authenticated user's identity. It SHALL return an object with `userId` (from `identity.subject`), `orgId` (from custom claim `org_id` on the identity object, accessed by casting to `Record<string, unknown>`), and `orgRole` (from custom claim `org_role`, defaulting to `"org:member"`). It SHALL throw an error if the user is not authenticated or has no active organization selected.

#### Scenario: Valid auth context with active org
- **WHEN** `getAuthContext(ctx)` is called with a valid authenticated context that includes an active organization
- **THEN** it SHALL return `{ userId, orgId, orgRole }` extracted from the JWT claims

#### Scenario: No active organization selected
- **WHEN** `getAuthContext(ctx)` is called with a valid user but no active organization
- **THEN** it SHALL throw an error indicating no organization is selected

### Requirement: All Convex functions require authentication
Every public Convex query, mutation, and action SHALL call `getAuthContext(ctx)` at the start of its handler. Resource queries SHALL filter by the `orgId` from the auth context. Resource mutations SHALL set `orgId` from the auth context when creating resources.

#### Scenario: Query filters by org
- **WHEN** a user in org "org_abc" queries for knowledge bases
- **THEN** the query SHALL only return knowledge bases where `orgId === "org_abc"`

#### Scenario: Mutation sets org on creation
- **WHEN** a user in org "org_abc" creates a new dataset
- **THEN** the dataset SHALL be created with `orgId: "org_abc"` regardless of any client-provided value

### Requirement: User sync from Clerk
The system SHALL provide a mechanism to create or update a user record in the `users` table when a user first authenticates. The user record SHALL be looked up by `clerkId` and created if not found.

#### Scenario: First-time user auto-created
- **WHEN** a user authenticates for the first time with Clerk ID "user_123"
- **THEN** a record SHALL be created in the `users` table with `clerkId: "user_123"`, and the user's email and name from the JWT

#### Scenario: Returning user found by Clerk ID
- **WHEN** a user authenticates with an existing Clerk ID
- **THEN** the system SHALL find and return the existing user record

### Requirement: Clerk middleware in Next.js
The system SHALL configure Clerk middleware in Next.js to apply authentication across the application. The middleware SHALL use `clerkMiddleware()` with a matcher that covers all routes except static files and Next.js internals.

#### Scenario: Middleware applied to all pages
- **WHEN** a request is made to any Next.js page
- **THEN** the Clerk middleware SHALL process the request and make auth state available
