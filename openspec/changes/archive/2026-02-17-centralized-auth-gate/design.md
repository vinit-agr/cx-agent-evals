## Context

The app uses Clerk for authentication and Convex for the backend. Every public Convex function calls `getAuthContext(ctx)` which requires both a valid Clerk JWT and an active `org_id` claim. The frontend previously handled auth on a per-page basis with duplicated wrappers. The homepage had no auth check and no navbar. The Clerk JWT template for Convex was missing `org_id`/`org_role` custom claims, and Clerk components had broken styling on dark backgrounds.

## Goals / Non-Goals

**Goals:**
- Single auth enforcement point at the root layout level — no page needs to think about auth
- Branded landing page for unauthenticated users with sign-in/sign-up
- Auto-org-selection so users never see "No active organization selected" errors
- Proper Clerk dark theme styling consistent with the app's design system
- Navbar on all pages including the home page

**Non-Goals:**
- Changing the backend auth model (Clerk JWT claims extraction, `getAuthContext`, org-scoped queries)
- Adding role-based access control within the frontend
- Modifying the Clerk middleware logic

## Decisions

### 1. Root-level AuthGate component

**Decision**: Create a single `AuthGate` component in the root layout that gates all children behind auth + org checks.

**Alternatives considered**:
- Per-page auth wrappers (previous approach) — duplicated, error-prone, inconsistent
- Clerk middleware-level redirect — would require server-side redirect config and loses the branded landing page experience

**Rationale**: A client-side AuthGate inside `ConvexClientProvider` has access to both `useConvexAuth()` and `useOrganization()`, making it the natural place to orchestrate the full auth flow. It's a single component that replaces duplicated logic across all pages.

### 2. Auth state machine: loading → unauthenticated → no org → ready

**Decision**: AuthGate checks states in order: (1) loading → spinner, (2) not authenticated → LandingPage, (3) no org → auto-select or OrgSetup, (4) ready → render children.

**Rationale**: This sequence matches the dependency chain: you must be authenticated before org state is meaningful, and you must have an org before Convex queries will succeed. The OrgGate is a separate internal component so it only runs `useOrganization()` when already authenticated.

### 3. Modal sign-in (not page redirect)

**Decision**: Use Clerk's `SignInButton mode="modal"` and `SignUpButton mode="modal"` on the landing page.

**Rationale**: Keeps users on the branded landing page during the auth flow. No navigation to `/sign-in` or `/sign-up` routes needed.

### 4. Auto-org-selection via useOrganizationList

**Decision**: OrgGate uses `useOrganizationList()` to fetch user's org memberships and calls `setActive()` on the first org if none is active.

**Alternatives considered**:
- Manual org selection screen — slower UX, unnecessary when user only has one org
- Clerk `afterSignInUrl` with org selection page — requires separate route and navigation

**Rationale**: Most users have one org. Auto-selecting it eliminates an unnecessary step. If the user has no orgs at all, the OrgSetup screen with `OrganizationList` is shown as a fallback.

### 5. Clerk JWT template must include org_id and org_role claims

**Decision**: The Clerk JWT template named "convex" must be configured in the Clerk dashboard to include custom claims: `"org_id": "{{org.id}}"` and `"org_role": "{{org.role}}"`.

**Root cause**: The default Convex JWT template from Clerk only includes standard claims (`sub`, `iss`, `aud`). Organization claims are NOT included by default. The backend's `getAuthContext()` extracts `org_id` from the JWT via `ctx.auth.getUserIdentity()` — if the claim is absent, the "No active organization selected" error is thrown regardless of frontend auth state.

**Key insight**: This was a dashboard configuration issue, not a code issue. No amount of client-side timing or gating logic could fix it — the JWT simply never contained `org_id`.

### 6. Clerk dark theme with @clerk/themes

**Decision**: Use `@clerk/themes` package with `baseTheme: dark` on `ClerkProvider`, plus explicit `colorText`, `colorTextSecondary`, `colorInputText`, `colorInputBackground`, and `colorNeutral` variables matching the app's color tokens.

**Alternatives considered**:
- `appearance.variables` without `baseTheme` — insufficient, Clerk components have deeply nested internal styles that `variables` alone don't reach
- CSS overrides targeting Clerk class names — fragile, breaks on Clerk upgrades

**Rationale**: `baseTheme: dark` handles all internal Clerk component styling (modals, popovers, buttons, inputs). Explicit variable overrides ensure colors match the app's design system (`#141419` background, `#e8e8ed` text, `#6ee7b7` accent).

### 7. OrgGate sync check before rendering children

**Decision**: OrgGate checks `clerkAuthOrgId !== organization.id || convexLoading` before rendering children. This ensures the Clerk auth session JWT includes the org_id and Convex has finished syncing the token.

**Rationale**: When Clerk sets an org active, `useOrganization()` updates immediately, but `ConvexProviderWithClerk` needs a moment to refetch the token. This guard prevents Convex queries from firing during the transition.

## Risks / Trade-offs

- **Sign-in/sign-up routes become unreachable** → Acceptable. With modal auth, these routes are unused but remain as a Clerk fallback.
- **All pages gated equally** → No public pages possible. Acceptable for this app where all functionality requires authenticated access to Convex.
- **Dashboard configuration dependency** → The JWT template is a manual Clerk dashboard step that can't be enforced in code. Documented in README setup instructions.
