## Why

The frontend has no centralized auth enforcement. Each page (generate, experiments) duplicates auth/org checking logic with `Authenticated`/`Unauthenticated`/`AuthLoading` wrappers and per-page `OrgRequired` components. The homepage has no auth check at all and no navbar. This causes runtime errors ("No active organization selected") when Convex queries fire before auth/org state is resolved, and creates an inconsistent user experience across pages. Additionally, the Clerk JWT template for Convex was missing `org_id`/`org_role` custom claims, meaning org-scoped Convex queries always failed regardless of frontend auth state. Clerk component styling was also broken (dark text on dark background) due to missing theme configuration.

## What Changes

- Add a centralized `AuthGate` component at the root layout level that handles all auth states: loading, unauthenticated (branded landing page with sign-in/sign-up), no org selected (org setup step with auto-select), and ready (renders page content)
- Configure the Clerk JWT template for Convex to include `org_id` and `org_role` custom claims (Clerk dashboard change)
- Add `@clerk/themes` dark base theme with explicit color variables to fix Clerk component visibility on dark backgrounds
- Add auto-org-selection in `OrgGate` — if user has orgs but none is active, automatically select the first one
- Add Header (with navbar, org switcher, user avatar) to the home page
- Remove duplicated per-page auth wrappers (`OrgRequired`, `Authenticated`, `Unauthenticated`, `AuthLoading`) from generate and experiments pages
- All pages are now protected by default — no Convex queries can fire until the user is authenticated and has an active organization

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `frontend-app-shell`: Root layout now wraps all pages with an `AuthGate` component. Unauthenticated users see a branded landing page. Users without an active organization are auto-assigned their first org or shown an org setup step. Pages no longer need individual auth wrappers. Clerk dark theme applied globally. Home page now has a navbar.

## Impact

- `packages/frontend/src/components/AuthGate.tsx` — new component (AuthGate + OrgGate + LandingPage)
- `packages/frontend/src/components/ConvexClientProvider.tsx` — added `@clerk/themes` dark base theme with color overrides
- `packages/frontend/src/components/ModeSelector.tsx` — added Header component for home page navbar
- `packages/frontend/src/app/layout.tsx` — wraps children with AuthGate
- `packages/frontend/src/app/generate/page.tsx` — simplified (auth wrappers removed)
- `packages/frontend/src/app/experiments/page.tsx` — simplified (auth wrappers removed)
- `packages/frontend/package.json` — added `@clerk/themes` dependency
- Clerk Dashboard: JWT template for Convex updated with `org_id` and `org_role` claims
- No backend code changes. No API changes.
