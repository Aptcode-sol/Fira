# Implementation Plan: Venue Owner Account Unification

## Overview

Convert the design into incremental, test-driven coding steps grounded in the design's concrete file inventory. The scope is small and mostly consistency wiring: retire the duplicate venue-owner auth URL space (redirect to the unified surface), funnel every client-side owner check through the existing `isVenueOwner(user)` helper, re-point all in-app links and the 401 handler at `/signin`/`/signup`, and add one owner-only Create-venue FAB on the public venues page. Per `ponytail.md` the guiding principle is *deletion over addition* — retire duplicate routes rather than maintain them, and reuse `isVenueOwner`, the existing FAB pattern, and the already-correct `DashboardSwitcher` rather than writing new ones.

Language: TypeScript (client is Next.js/React; tests use `vitest` + `fast-check@4` + `@testing-library/react`, all already installed). No backend changes — Requirement 6 is preserve/verify only.

Each `*`-marked sub-task is an optional test task and must not be implemented as part of core wiring; unmarked sub-tasks are required.

## Tasks

- [ ] 1. Retire the duplicate venue-owner auth routes
  - [ ] 1.1 Replace `client/src/app/venue-portal/signin/page.tsx` with a server-component `redirect('/signin')`
    - Overwrite the entire file with a non-`'use client'` page that imports `redirect` from `next/navigation` and calls `redirect('/signin')`
    - Keep the file (do not delete) so the route resolves and redirects rather than 404s
    - _Requirements: 1.1, 1.3_
  - [ ] 1.2 Replace `client/src/app/venue-portal/signup/page.tsx` with a server-component `redirect('/signup')`
    - Same pattern as 1.1, targeting `/signup`
    - _Requirements: 1.2, 1.4_
  - [ ]* 1.3 Write routing tests for the retired-route redirects
    - Assert `/venue-portal/signin` resolves to `/signin` and `/venue-portal/signup` to `/signup`
    - _Requirements: 1.3, 1.4_

- [ ] 2. Fix the API client 401 redirect
  - [ ] 2.1 Simplify the `api.ts` 401 handler to always target `/signin`
    - In `client/src/lib/api.ts`, drop the `onVenuePortal` branch; set `target = '/signin'` for every non-auth 401
    - Preserve the existing `isAuthAttempt` (`endpoint.startsWith('/auth/')`) guard and the `localStorage` cleanup
    - _Requirements: 2.3_
  - [ ]* 2.2 Write property test for 401 redirect target path-invariance
    - **Feature: venue-owner-account-unification, Property 3: For any current browser path, when the API client handles a 401 for a non-auth request, the redirect target selected is `/signin`.**
    - Generate arbitrary `window.location.pathname` values (fast-check, min 100 iterations); mock `fetch`/`localStorage`/`location`; assert navigation target is `/signin`
    - **Validates: Requirements 2.3, 2.4**

- [ ] 3. Unify the RouteGuard owner check and redirects
  - [ ] 3.1 Switch `RouteGuard.tsx` to `isVenueOwner(user)` and the unified sign-in
    - In `client/src/components/RouteGuard.tsx`: import `isVenueOwner` from `@/lib/types`; replace `user?.role` branches with `isVenueOwner(user)` (owner ⇒ allow owner/user routes; non-owner on owner route ⇒ `router.replace('/dashboard')`)
    - Change the unauthenticated owner-route redirect from `/venue-portal/signin` to `/signin`
    - Remove `/venue-portal/signin` and `/venue-portal/signup` from `publicRoutes` (they now redirect and no longer need whitelisting)
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.4_
  - [ ]* 3.2 Write property test for the owner-route access decision
    - **Feature: venue-owner-account-unification, Property 2: For any account and any owner-workspace route, access is granted exactly when `isVenueOwner(account)` is true, and a non-owner authenticated account is redirected to `/dashboard`.**
    - Generate arbitrary accounts + owner-route paths (fast-check, min 100 iterations) with router mocked; assert grant ⇔ `isVenueOwner`, non-owner ⇒ redirect `/dashboard`
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [ ] 4. Checkpoint - core routing authority unified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Gate owner-workspace pages on `isVenueOwner`
  - [ ] 5.1 Update the workspace landing pages (dashboard, venues, bookings, events, analytics, settings)
    - In each of `client/src/app/venue-portal/{dashboard,venues,bookings,events,analytics,settings}/page.tsx`: unauth redirect `/venue-portal/signin` → `/signin`; role gate `user?.role !== 'venue_owner'` → `!isVenueOwner(user)`; switch any `user?.role === 'venue_owner'` data-fetch guards to `isVenueOwner(user)`; import `isVenueOwner` where needed
    - _Requirements: 3.5, 5.5, 6.6_
  - [ ] 5.2 Update the venue sub-route pages (create, [id]/edit, [id]/preview)
    - Apply the same gate change in `client/src/app/venue-portal/venues/create/page.tsx`, `.../venues/[id]/edit/page.tsx`, and `.../venues/[id]/preview/page.tsx`
    - _Requirements: 3.5, 6.6_

- [ ] 6. Re-point every in-app link and logout to the unified surface
  - [ ] 6.1 Update navbars and the owner section links
    - `client/src/components/venue-portal/VenuePortalLandingNavbar.tsx`, `.../VenuePortalNavbar.tsx` (if present): links → `/signin` / `/signup`
    - `client/src/components/VenueOwnerSection.tsx`: link → `/signin`
    - _Requirements: 2.1, 2.2_
  - [ ] 6.2 Update the venue-portal landing page links
    - `client/src/app/venue-portal/landing/page.tsx`: links → `/signin` / `/signup`
    - _Requirements: 2.1, 2.2_
  - [ ] 6.3 Update the venues-page CTA and city-listing link
    - `client/src/app/venues/page.tsx`: "List Your Venue" CTA link → `/signin`
    - `client/src/app/venues/in/[city]/page.tsx`: link → `/signup`
    - _Requirements: 2.1, 2.2_
  - [ ] 6.4 Fix the owner-workspace logout redirect
    - `client/src/components/venue-portal/VenueDashboardLayout.tsx`: logout redirect → `/signin`
    - _Requirements: 2.5_
  - [ ] 6.5 Cosmetic cleanup of retired routes in FAB hidden-paths and robots
    - `client/src/components/FloatingActionButton.tsx`: drop retired auth routes from the hidden-paths list
    - `client/src/app/robots.ts`: drop retired routes from the disallow list
    - _Requirements: 2.1, 2.2_
  - [ ]* 6.6 Write a routing static-check test
    - Assert no in-app `href` or router `push`/`replace` target `/venue-portal/signin` or `/venue-portal/signup` after the change (grep-style test over `client/src`)
    - _Requirements: 2.1, 2.2_

- [ ] 7. Checkpoint - links and gates consistent
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Add the owner-only Create-venue FAB
  - [ ] 8.1 Render the Create_Venue_FAB on the venues page
    - In `client/src/app/venues/page.tsx`: read `user` from `useAuth`; when `isVenueOwner(user)` render a fixed-position floating "+" `<Link href="/venue-portal/venues/create">` with `aria-label="Create a new venue"`, reusing the existing FAB visual pattern (fixed bottom-right, rounded, framer-motion)
    - Rely solely on `isVenueOwner(user)` for visibility (owner shown; non-owner and signed-out hidden)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 8.2 Write component tests for the FAB
    - Renders only for owner/dual-role accounts; hidden for non-owner and signed-out; links to `/venue-portal/venues/create`; keyboard-reachable/activatable with a descriptive accessible name
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [ ] 9. Verify the DashboardSwitcher accessible name (no behavior change)
  - [ ] 9.1 Ensure the switcher trigger exposes an accessible name
    - In `client/src/components/dashboard/DashboardSwitcher.tsx`: the trigger currently relies on a visual label only for the switch action; add an `aria-label` describing the switch action if not already present. No change to visibility gating or navigation targets
    - _Requirements: 4.7_
  - [ ]* 9.2 Write component tests for the switcher
    - Renders for owner/dual-role; hidden for non-owner and signed-out; activating from user dashboard navigates to `/venue-portal/dashboard` and from workspace to `/dashboard`; keyboard-operable with an accessible name
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 10. Property test for the owner-detection helper
  - [ ]* 10.1 Write property test for `isVenueOwner`
    - **Feature: venue-owner-account-unification, Property 1: For any account, `isVenueOwner` returns true iff `roles` includes `venue_owner` or scalar `role` equals `venue_owner`; false for null/undefined and admin-only accounts.**
    - Generate arbitrary `{role, roles}` objects incl. `null`/`undefined`, admin-only, dual-role (fast-check, min 100 iterations); assert equality with the reference predicate
    - **Validates: Requirements 3.1, 3.5, 5.5**

- [ ] 11. Verify server Owner_Gate (preserve, no code change)
  - [ ]* 11.1 Write integration tests against the existing Owner_Gate for create-venue
    - `POST /venues` with owner token via `roles[]` succeeds; legacy-scalar `venue_owner` token succeeds; non-owner token returns 403 and creates nothing; no token returns 401
    - Exercise the existing `server/middleware/venueOwnerAuth.js` / `auth.js` unchanged
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 11.2 Write a smoke test for the auth-system-failure fail-closed path
    - When the Redis blocklist is unavailable, `requireAuth` returns 503 and no venue is created (single representative case)
    - _Requirements: 6.5_

- [ ] 12. Final checkpoint - full verification
  - Run the client build/lint and the client + server test suites; a passing existing suite plus the routing static-check is the regression guard for the preserve-everything requirements (6.6, 6.7). Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; core wiring tasks are never optional.
- Each task references specific requirement clauses for traceability.
- Property tests (P1–P3) use `fast-check` with a minimum of 100 iterations and the required feature/property tag.
- Requirement 6 is preserve/verify: no server code is modified; the FAB and unified routing only decide what to show and where to route, while the server `Owner_Gate` remains the real authority.
- The two retired auth `page.tsx` files are overwritten (not deleted) so the routes still resolve and redirect.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "3.1"] },
    { "id": 1, "tasks": ["5.1", "5.2", "6.1", "6.2", "6.3", "6.4", "6.5", "9.1"] },
    { "id": 2, "tasks": ["8.1"] },
    { "id": 3, "tasks": ["1.3", "2.2", "3.2", "6.6", "8.2", "9.2", "10.1", "11.1", "11.2"] }
  ]
}
```
