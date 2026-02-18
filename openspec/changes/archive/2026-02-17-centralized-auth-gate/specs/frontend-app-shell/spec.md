## ADDED Requirements

### Requirement: Root-level AuthGate component
The system SHALL provide an `AuthGate` client component in `src/components/AuthGate.tsx` that wraps all page content in the root layout. It SHALL use `useConvexAuth()` from `convex/react` for authentication state and `useOrganization()` from `@clerk/nextjs` for organization state. The AuthGate SHALL enforce the following state machine in order: (1) if auth is loading, render a branded loading screen, (2) if user is not authenticated, render a branded landing page with sign-in/sign-up, (3) if user has no active organization, auto-select the first available org or show an org setup screen, (4) if all checks pass, render children.

#### Scenario: Loading state shows branded spinner
- **WHEN** the auth state is loading (initial page load)
- **THEN** the AuthGate SHALL display a centered loading screen with the "rag-eval" brand mark and a spinner

#### Scenario: Unauthenticated user sees landing page
- **WHEN** a user visits any page without being authenticated
- **THEN** the AuthGate SHALL display a branded landing page with "Sign In" and "Create Account" buttons using Clerk modal mode

#### Scenario: Authenticated user without org is auto-assigned
- **WHEN** a user is authenticated, has org memberships, but no active organization
- **THEN** the OrgGate SHALL automatically select the user's first organization via `useOrganizationList().setActive()`

#### Scenario: Authenticated user with no orgs sees org setup
- **WHEN** a user is authenticated but has no organization memberships at all
- **THEN** the AuthGate SHALL display an org setup screen with Clerk's `OrganizationList` component (`hidePersonal={true}`)

#### Scenario: Fully authenticated user sees page content
- **WHEN** a user is authenticated and has an active organization
- **THEN** the AuthGate SHALL render the page children (the actual route content)

### Requirement: AuthGate wired into root layout
The root layout (`src/app/layout.tsx`) SHALL wrap `{children}` with `<AuthGate>` inside `<ConvexClientProvider>`. This ensures all routes are protected by the auth gate without per-page auth logic.

#### Scenario: All routes are auth-gated
- **WHEN** a user navigates to any route (`/`, `/generate`, `/experiments`)
- **THEN** the AuthGate SHALL evaluate auth state before rendering the route's page component

### Requirement: Landing page design
The landing page for unauthenticated users SHALL display the "rag-eval" brand (name + pulsing accent dot), a subtitle describing the app, a primary "Sign In" button (accent-colored), a secondary "Create Account" button (outline style), and a footer with feature labels. It SHALL use Clerk's `SignInButton` and `SignUpButton` with `mode="modal"`.

#### Scenario: Sign in via modal
- **WHEN** an unauthenticated user clicks "Sign In" on the landing page
- **THEN** a Clerk sign-in modal SHALL open without navigating away from the page

#### Scenario: Sign up via modal
- **WHEN** an unauthenticated user clicks "Create Account" on the landing page
- **THEN** a Clerk sign-up modal SHALL open without navigating away from the page

### Requirement: Clerk JWT template includes org claims
The Clerk JWT template named "convex" SHALL include custom claims `"org_id": "{{org.id}}"` and `"org_role": "{{org.role}}"`. Without these claims, the backend's `getAuthContext()` cannot extract the org context from the JWT, and all org-scoped Convex queries will fail with "No active organization selected".

#### Scenario: Convex receives org_id in JWT
- **WHEN** a user with an active organization makes a Convex query
- **THEN** the JWT token SHALL contain `org_id` matching the active organization ID and `org_role` matching the user's role

### Requirement: Clerk dark theme configuration
The `ClerkProvider` SHALL use `baseTheme: dark` from `@clerk/themes` with explicit color variable overrides (`colorBackground`, `colorText`, `colorTextSecondary`, `colorInputText`, `colorInputBackground`, `colorPrimary`, `colorNeutral`, `colorTextOnPrimaryBackground`) matching the app's dark design system.

#### Scenario: Clerk modals render with dark theme
- **WHEN** a Clerk modal (sign-in, sign-up, org switcher) opens
- **THEN** it SHALL display with dark backgrounds and light text consistent with the app's theme

### Requirement: OrgGate sync check
The OrgGate SHALL verify that `useAuth().orgId` matches `useOrganization().organization.id` and that `useConvexAuth().isLoading` is false before rendering children. This prevents Convex queries from firing during the brief window when Clerk has set the org but the Convex token hasn't been refreshed yet.

#### Scenario: Children blocked during token sync
- **WHEN** the active organization changes (via auto-select or manual switch)
- **THEN** the OrgGate SHALL show a spinner until the Clerk auth session and Convex token are both updated

## MODIFIED Requirements

### Requirement: Home page shows mode selection with navbar
- **WHEN** an authenticated user with an active org visits the home page
- **THEN** the app SHALL display the Header component (with navbar, org switcher, user avatar) and mode selection cards for "Generate Questions" and "Run Experiments"

Note: The home page content is unchanged, but it now includes the Header (previously only on generate/experiments pages) and is only visible to authenticated users with an active organization, enforced by the root-level AuthGate.

#### Scenario: Home page shows header and mode selection
- **WHEN** an authenticated user with an active org visits the home page
- **THEN** the app SHALL display the Header with org switcher and user avatar, plus mode selection cards

#### Scenario: Unauthenticated user cannot see home page
- **WHEN** an unauthenticated user visits the home page
- **THEN** the AuthGate SHALL show the landing page instead of mode selection

## REMOVED Requirements

### Requirement: Per-page auth wrappers on generate page
**Reason**: Replaced by centralized AuthGate at root layout level. Individual pages no longer need `Authenticated`/`Unauthenticated`/`AuthLoading` wrappers or `OrgRequired` components.
**Migration**: Remove auth wrapper imports and components from `generate/page.tsx`. The page component now only contains business logic.

### Requirement: Per-page auth wrappers on experiments page
**Reason**: Same as above — replaced by centralized AuthGate.
**Migration**: Remove auth wrapper imports and components from `experiments/page.tsx`. The page component now only contains business logic.
