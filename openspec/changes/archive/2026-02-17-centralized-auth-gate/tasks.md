## 1. AuthGate Component

- [x] 1.1 Create `src/components/AuthGate.tsx` with loading, unauthenticated (LandingPage), no-org (OrgSetup), and ready states
- [x] 1.2 Add OrgGate with auto-org-selection via `useOrganizationList().setActive()` for users with orgs but none active
- [x] 1.3 Add OrgGate sync check (`clerkAuthOrgId !== organization.id || convexLoading`) before rendering children
- [x] 1.4 Wire AuthGate into root layout (`src/app/layout.tsx`) inside ConvexClientProvider

## 2. Clerk Configuration

- [x] 2.1 Configure Clerk JWT template for Convex to include `org_id` and `org_role` custom claims (Clerk dashboard)
- [x] 2.2 Install `@clerk/themes` and configure `baseTheme: dark` with explicit color overrides in ConvexClientProvider

## 3. Home Page

- [x] 3.1 Add Header component to `ModeSelector.tsx` so home page has navbar with org switcher and user avatar

## 4. Simplify Pages

- [x] 4.1 Remove per-page auth wrappers from `generate/page.tsx` (OrgRequired, Authenticated, Unauthenticated, AuthLoading, unused Clerk imports)
- [x] 4.2 Remove per-page auth wrappers from `experiments/page.tsx` (same cleanup)

## 5. Verification

- [x] 5.1 Confirm frontend build passes with no TypeScript errors
- [x] 5.2 Verify unauthenticated users see branded landing page on all routes
- [x] 5.3 Verify authenticated users with an org see page content with no console errors
- [x] 5.4 Verify Convex JWT contains org_id claim (debug logging confirmed)
