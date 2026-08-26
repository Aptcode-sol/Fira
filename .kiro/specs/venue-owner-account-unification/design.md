# Design Document

## Overview

This feature closes three UI/routing gaps on top of infrastructure that already exists. The account model already treats `User.roles[]` as the source of truth (Flow 7 in `docs/PLATFORM_FLOWS.md`), the `isVenueOwner()` helper already lives in `client/src/lib/types.ts`, the `DashboardSwitcher` already exists and self-gates, and the server `Owner_Gate` (`requireAuth('venue_owner')`) already authorizes against `roles[]` fresh from the database on every request. What has not caught up is the client's routing and visibility surface:

1. **Unify sign-in** — retire `/venue-portal/signin` and `/venue-portal/signup`, redirect them to `/signin` and `/signup`, and point every in-app link and the 401 redirect in `client/src/lib/api.ts` at the unified surface.
2. **Dual dashboard + switcher** — fix `RouteGuard.tsx` (which currently reads the legacy scalar `user?.role` and redirects owners to `/venue-portal/signin`) to use `isVenueOwner` and the unified sign-in, and make owner-workspace pages gate on `isVenueOwner`. The `DashboardSwitcher` itself needs no change.
3. **Create-venue FAB** — an owner-only floating "+" button on the public venues page that opens the existing stepper at `/venue-portal/venues/create`.

This is a wiring and consistency change, not new backend work. Per `ponytail.md`, the guiding principle throughout is *deletion over addition*: retire the duplicate auth routes rather than maintaining two parallel login surfaces, and reuse the existing `isVenueOwner`, `DashboardSwitcher`, and FAB patterns rather than writing new ones. Requirement 6 (server enforcement) is **preserve/verify**, not new middleware — the code that satisfies it already exists and this feature must not disturb it.

### Scope of change (concrete file inventory)

Investigated and confirmed. The change touches these files:

| File | Change |
|------|--------|
| `client/src/app/venue-portal/signin/page.tsx` | **Replace** page body with a redirect to `/signin` |
| `client/src/app/venue-portal/signup/page.tsx` | **Replace** page body with a redirect to `/signup` |
| `client/src/lib/api.ts` | 401 handler: drop the `onVenuePortal` branch, always target `/signin` |
| `client/src/components/RouteGuard.tsx` | Use `isVenueOwner(user)` instead of `user?.role`; redirect unauth owner-routes to `/signin`; remove retired routes from `publicRoutes` |
| `client/src/app/venue-portal/dashboard/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/app/venue-portal/venues/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/app/venue-portal/bookings/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/app/venue-portal/events/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/app/venue-portal/analytics/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/app/venue-portal/settings/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/app/venue-portal/venues/create/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/app/venue-portal/venues/[id]/edit/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/app/venue-portal/venues/[id]/preview/page.tsx` | Gate on `isVenueOwner`; redirect to `/signin` |
| `client/src/components/venue-portal/VenueDashboardLayout.tsx` | Logout redirect → `/signin` |
| `client/src/components/venue-portal/VenuePortalLandingNavbar.tsx` | Links → `/signin` / `/signup` |
| `client/src/components/venue-portal/VenuePortalNavbar.tsx` | Links → `/signin` / `/signup` (if present) |
| `client/src/components/VenueOwnerSection.tsx` | Link → `/signin` |
| `client/src/app/venue-portal/landing/page.tsx` | Links → `/signin` / `/signup` |
| `client/src/app/venues/page.tsx` | "List Your Venue" CTA link → `/signin`; **add** owner-only Create-venue FAB |
| `client/src/app/venues/in/[city]/page.tsx` | Link → `/signup` |
| `client/src/components/FloatingActionButton.tsx` | Update hidden-paths list (retired routes) — cosmetic cleanup |
| `client/src/app/robots.ts` | Drop retired routes from disallow list — cosmetic cleanup |
| `client/src/components/dashboard/DashboardSwitcher.tsx` | **No change** (already correct) |
| `server/middleware/venueOwnerAuth.js`, `server/middleware/auth.js` | **No change** (verify only) |

No new files except the two thin redirect pages replacing the retired auth pages (see Architecture decision below).

## Architecture

### Current state

```mermaid
graph TD
    subgraph "Two parallel auth surfaces (today)"
        A[/signin, /signup] 
        B[/venue-portal/signin, /venue-portal/signup]
    end
    RG[RouteGuard.tsx<br/>reads user?.role]
    API[api.ts 401 handler<br/>onVenuePortal ? /venue-portal/signin : /signin]
    Pages[venue-portal pages<br/>gate on user?.role !== venue_owner<br/>redirect to /venue-portal/signin]
    RG -->|unauth owner route| B
    API -->|401 on venue portal| B
    Pages -->|unauth| B
```

### Target state

```mermaid
graph TD
    subgraph "One unified auth surface"
        A[/signin, /signup]
    end
    subgraph "Retired, now redirects"
        B[/venue-portal/signin -> /signin<br/>/venue-portal/signup -> /signup]
    end
    B -.redirect.-> A
    RG[RouteGuard.tsx<br/>reads isVenueOwner user]
    API[api.ts 401 handler<br/>always /signin]
    Pages[venue-portal pages<br/>gate on isVenueOwner user<br/>redirect to /signin]
    RG -->|unauth owner route| A
    API -->|401| A
    Pages -->|unauth| A
    Switcher[DashboardSwitcher<br/>self-gates on isVenueOwner]
    FAB[Create_Venue_FAB<br/>gates on isVenueOwner]
    Server[Owner_Gate requireAuth venue_owner<br/>roles from DB each request - UNCHANGED]
    FAB -.opens.-> Stepper[/venue-portal/venues/create]
    Stepper -->|create| Server
```

The single decision point for "is this account a venue owner?" on the client is `isVenueOwner(user)`. After this change, every client-side owner check — RouteGuard, each owner-workspace page, the switcher, and the FAB — funnels through that one helper. The server remains the real authority: the FAB and unified routing only decide *what to show and where to send the browser*; whether a venue is actually created is decided by `Owner_Gate` reading `roles[]` from the database.

### Design decision: how retired routes redirect

**Options considered:**

- **(A) `next.config.ts` `redirects()`** — server-level 308 redirects. Cleanest for pure URL retirement, no client code runs.
- **(B) Thin client page that calls `router.replace()`** — a small `'use client'` page at the retired path.
- **(C) `redirect()` from a server component** — Next.js `redirect()` in a non-`'use client'` `page.tsx`.

**Chosen: (C) — replace each retired page body with a server-component `redirect()`.**

Rationale: the retired routes already have `page.tsx` files that must be dealt with (leaving the old sign-in forms live contradicts Requirement 1.1/1.2 "exactly one sign-in surface"). Per `ponytail.md`, *deletion over addition* — the smallest correct diff is to overwrite each existing `page.tsx` with a two-line server-side `redirect()` rather than add a parallel `next.config.ts` rule while the old form files still sit there. `redirect()` in a server component issues the navigation before any client JS or the old form renders, so there is no flash of the retired login form and no dependency on `RouteGuard`. Option A was rejected because it leaves the dead form files in the tree (a lie about what routes exist) and splits routing config across two mechanisms; Option B was rejected because a client `router.replace()` briefly renders nothing and runs after hydration.

```tsx
// client/src/app/venue-portal/signin/page.tsx  (entire file after change)
import { redirect } from 'next/navigation';
export default function Page() {
    redirect('/signin'); // Unified_Sign_In — venue-owner auth space retired
}
```

The `.tsx` files are kept (not deleted) so the routes still resolve and redirect; deleting them would 404 instead of redirect, violating Requirement 1.3/1.4.

### RouteGuard behavior after change

`RouteGuard` is the client route authority. Two defects are fixed:

1. **Legacy scalar → `isVenueOwner`.** Today it reads `const role = user?.role` and branches on `role === 'venue_owner'` / `role === 'user'`. A dual-role account whose `roles` includes `venue_owner` but whose scalar `role` is `user` is wrongly bounced out of the owner workspace. Replace with `isVenueOwner(user)`.
2. **Redirect target.** Today an unauthenticated visitor to an owner route is sent to `/venue-portal/signin`. Change to `/signin`.

The revised decision table (only the owner/user branches change; public and loading behavior is untouched):

| Condition | Action |
|-----------|--------|
| Public route | render |
| Not authenticated, any protected route | redirect `/signin` |
| Authenticated, non-owner (`!isVenueOwner`), owner-workspace route | redirect `/dashboard` |
| Authenticated, owner (`isVenueOwner`), any dashboard/workspace route | render |

The `venue-portal/signin` and `venue-portal/signup` entries are removed from `publicRoutes` since those routes now redirect and no longer need to be whitelisted.

Note: `isVenueOwner` deliberately treats `admin` as **not** a venue owner (per the helper's own doc comment). A non-owner requesting an owner-workspace route is redirected to `/dashboard`, matching Requirement 3.4 — the guard does not special-case admin, consistent with the helper's contract.

## Components and Interfaces

### `isVenueOwner(user)` — unchanged, now the single client authority

```ts
// client/src/lib/types.ts (existing — no change)
export const isVenueOwner = (
    u?: Pick<User, 'role' | 'roles'> | null,
): boolean => !!u && (u.roles?.includes('venue_owner') || u.role === 'venue_owner');
```

Pure function of an account's role fields. This is the one genuinely property-worthy unit in the feature.

### `RouteGuard` — modified

Interface unchanged (`{ children }`). Internal role check switches from `user?.role` comparisons to `isVenueOwner(user)`; unauth owner-route redirect switches from `/venue-portal/signin` to `/signin`.

### Owner-workspace pages — modified (uniform pattern)

Each page currently runs:

```tsx
if (!isLoading && !isAuthenticated) { router.push('/venue-portal/signin'); return; }
if (!isLoading && isAuthenticated && user?.role !== 'venue_owner') { router.push('/dashboard'); return; }
```

changes to:

```tsx
if (!isLoading && !isAuthenticated) { router.push('/signin'); return; }
if (!isLoading && isAuthenticated && !isVenueOwner(user)) { router.push('/dashboard'); return; }
```

Any `user?.role === 'venue_owner'` data-fetch guards in the same files switch to `isVenueOwner(user)` for consistency (Requirement 3.5). This page-level gate is defense-in-depth behind `RouteGuard`; both use the same helper so they cannot disagree.

### `DashboardSwitcher` — unchanged

Already self-gates: `if (!isVenueOwner(user)) return null;`. Satisfies Requirement 4.1/4.2/4.5/4.6 as-is. It is keyboard-operable (`<button type="button">`); Requirement 4.7's accessible-name criterion is verified, and an `aria-label` describing the switch action is added if the current markup relies only on a visual label. Navigation targets (`/dashboard`, `/venue-portal/dashboard`) already match Requirement 4.3/4.4.

### `Create_Venue_FAB` — new, small, on the public venues page

A floating "+" control rendered on `client/src/app/venues/page.tsx`, reusing the existing FAB visual/interaction pattern from `FloatingActionButton.tsx` (fixed-position, rounded, framer-motion). It is **not** the shared `FloatingActionButton` component (that one is for post/event creation and hides on the venue portal); this is a purpose-specific control on the public venues page.

```tsx
// Rendered inside venues/page.tsx
import { isVenueOwner } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

// ...
const { user } = useAuth();
{isVenueOwner(user) && (
    <Link
        href="/venue-portal/venues/create"
        aria-label="Create a new venue"
        className="fixed bottom-6 right-6 z-50 ..."  // + icon
    >
        {/* plus icon */}
    </Link>
)}
```

Visibility is driven solely by `isVenueOwner(user)` (Requirement 5.5): owner → shown, non-owner → hidden, signed-out → `user` is null → `isVenueOwner` false → hidden (Requirement 5.1/5.3/5.4). Rendering as a Next.js `<Link>` (an anchor) makes it keyboard-focusable and activatable by default, with `aria-label` supplying the accessible name (Requirement 5.6). Activation navigates to the existing stepper (Requirement 5.2). The stepper and its own `isVenueOwner`-based guard back this up server-side.

### `Owner_Gate` — unchanged, verified

```js
// server/middleware/auth.js — requireAuth('venue_owner'), UNCHANGED
const held = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role];
const allowed = roles.some(r => held.includes(r) || r === user.role);
if (!allowed) return res.status(403).json({ error: 'Insufficient permissions for this action.' });
```

Reads the user fresh from the database each request (`User.findById(decoded.userId)`), honors legacy scalar `role`, returns 401 for missing/invalid/expired token, 403 for insufficient role, and 503 (fail-closed) when the Redis blocklist is unavailable. This already satisfies all of Requirement 6 (6.1–6.5). No change; the design records it as the safeguard that makes FAB visibility purely cosmetic.

## Data Models

**No schema change. None.**

`User.roles[]` already exists in both the client `User` interface (`client/src/lib/types.ts`) and the server `User` model, and is already the source of truth per Flow 7. The legacy scalar `role` remains for backward compatibility and is already honored by both `isVenueOwner` (client) and `requireAuth` (server). This feature introduces no new field, no new model, no migration, and no change to how roles are stored or read. It only changes which existing field the *client* consults (`roles[]` via `isVenueOwner` instead of the scalar `role`) and where the browser is routed. Per the Non-Goals, `roles[]` model work and the duplicate-account merge (`mergeDuplicateAccounts.js`) are explicitly out of scope.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Most of this feature is routing and conditional rendering — best covered by example/component tests, not property tests (see Testing Strategy for the honest PBT assessment). Two pieces are genuinely universal, pure decisions over an input space and are worth expressing as properties:

- **`isVenueOwner`** — a pure function over an account's `role`/`roles` fields. Its outcome must be consistent for any combination of those fields, and every client visibility/redirect decision derives from it.
- **401-redirect target selection** — after the change this must resolve to `/signin` for *any* current path, i.e. the target is now a constant function of the path (the previous path-dependent branch is exactly the bug being removed).

### Property 1: Owner detection is exactly "holds the venue_owner role"

*For any* account value (any combination of scalar `role` in `{user, venue_owner, admin}` and any `roles` array over those values, plus `null`/`undefined`), `isVenueOwner` returns true **if and only if** `roles` includes `venue_owner` or the scalar `role` equals `venue_owner`; in particular it returns false for a null/undefined account and for an account whose only role is `admin`.

**Validates: Requirements 3.1, 3.5, 5.5**

### Property 2: Owner-route access decision matches owner detection

*For any* account value and *any* owner-workspace route, the client access decision grants access exactly when `isVenueOwner(account)` is true, and for a non-owner authenticated account redirects to `/dashboard`. (Tests the guard's decision as a pure function of `isVenueOwner` and route class, with navigation mocked.)

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 3: 401 redirect target is the unified sign-in for every path

*For any* current browser path, when the API client handles a 401 for a non-auth request, the redirect target selected is `/signin`. (After the change the target no longer depends on the path; the property pins that invariant so the old `/venue-portal` branch cannot silently return.)

**Validates: Requirements 2.3, 2.4**

## Error Handling

- **Retired-route requests (1.3, 1.4):** handled by server-side `redirect()` — any visit to `/venue-portal/signin` or `/venue-portal/signup` resolves to the unified surface before rendering. No error surface; it is a normal navigation.
- **Session establishment fails after successful auth (1.7):** the unified sign-in flow already treats a failed session establishment as a sign-in failure and keeps the user on `/signin` with an error message. This behavior is on the unified surface (unchanged by this feature) and is verified, not rebuilt.
- **401 on a protected request (2.3):** `api.ts` clears `fira_token`/`fira_user` from `localStorage` and navigates to `/signin` (never to the retired route). Auth-attempt 401s (`endpoint.startsWith('/auth/')`) are deliberately *not* redirected — a wrong password must show an inline error, not bounce the page. This existing guard is preserved.
- **Non-owner reaches an owner-workspace URL (3.4):** redirected to `/dashboard` by both `RouteGuard` and the page-level gate. Even if both client gates were bypassed, the server `Owner_Gate` rejects any owner-only action with 403.
- **Unauthenticated owner-only venue create (6.3):** server returns 401; the browser, via the `api.ts` 401 handler, lands on `/signin`.
- **Authorization system failure (6.5):** when the Redis blocklist backing the auth check is unavailable, `requireAuth` fails closed with 503 and does not create the venue. Preserved, not modified.
- **FAB shown to a stale/mis-roled client (defense in depth):** if the client wrongly shows the FAB (e.g. stale `localStorage` user), clicking it opens the stepper, but the server `Owner_Gate` still rejects the create. UI visibility is never the only safeguard (Requirement 6 intent).

## Testing Strategy

### PBT applicability assessment

This feature is predominantly **routing and conditional UI rendering**, which is *not* a good fit for property-based testing — those criteria are verified with example/component tests. Only three decisions are pure functions over a meaningful input space, and they get the three properties above. The rest are example/integration/smoke:

- **PROPERTY:** `isVenueOwner` correctness (P1); guard access decision as a function of owner-status + route class (P2); 401 target selection (P3).
- **EXAMPLE / COMPONENT:** switcher visibility and navigation targets (4.1–4.6); FAB visibility for owner/non-owner/signed-out and its click target (5.1–5.4); each retired route redirecting to its unified target (1.3, 1.4); each in-app link pointing at `/signin`/`/signup` (2.1, 2.2); logout landing on the unified surface (2.5).
- **ACCESSIBILITY (component):** switcher and FAB are keyboard-operable and expose an accessible name (4.7, 5.6) — asserted via role/name queries in component tests.
- **INTEGRATION:** server `Owner_Gate` create-venue authorization for owner/non-owner/unauthenticated/legacy-role accounts (6.1–6.4) — a handful of representative cases against the existing middleware; **preserve/verify**, no new code.
- **SMOKE:** auth-system-failure fail-closed path returns 503 (6.5) — single representative case.
- **NOT TESTED (preservation by non-modification):** booking/payment/settlement flows (6.7) and stepper behavior (6.6) are asserted by *not changing* them plus the existing suite continuing to pass.

### Property-based tests

- Use the target language's standard PBT library (`fast-check` for the TypeScript client). Do not hand-roll generators.
- Minimum **100 iterations** per property.
- Tag each test: **Feature: venue-owner-account-unification, Property {n}: {property text}**.
- Implement each of the three properties with a single property test:
  - **P1** — generate arbitrary `{role, roles}` objects (including `null`/`undefined`, `admin`-only, dual-role) and assert `isVenueOwner` equals the reference predicate `roles.includes('venue_owner') || role === 'venue_owner'`.
  - **P2** — generate arbitrary accounts and owner-route paths, run the guard's decision logic with router mocked, assert grant ⇔ `isVenueOwner`, and non-owner ⇒ redirect `/dashboard`.
  - **P3** — generate arbitrary `window.location.pathname` values, invoke the 401 handler for a non-auth endpoint with `fetch`/`localStorage`/`location` mocked, assert the navigation target is `/signin`.

### Example, component, and integration tests

- **Component (React Testing Library):** switcher renders for owner and dual-role accounts, hides for non-owner and signed-out; clicking navigates to the opposite dashboard. FAB renders only for owners, links to `/venue-portal/venues/create`, and is reachable/activatable by keyboard with a descriptive accessible name.
- **Routing:** requesting `/venue-portal/signin` resolves to `/signin` and `/venue-portal/signup` to `/signup`; a static check (grep-style test or lint) asserts no in-app `href`/`push` targets `/venue-portal/signin` or `/venue-portal/signup` after the change.
- **Integration (server):** `POST /venues` with an owner token (via `roles[]`) succeeds; with a legacy-scalar `venue_owner` token succeeds; with a non-owner token returns 403 and creates nothing; with no token returns 401. These exercise the existing `Owner_Gate` unchanged.

### Verification

After changes, run the client build/lint and the client + server test suites. Because the diff is mostly link/redirect edits, a passing existing suite plus the routing static-check is the primary regression guard for the "preserve everything that works" requirements (6.6, 6.7).
