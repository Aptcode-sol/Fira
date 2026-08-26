# Requirements Document

## Introduction

Today the FIRA client has two parallel sign-in surfaces: the general one at `/signin` and `/signup`, and a separate venue-owner one at `/venue-portal/signin` and `/venue-portal/signup`. The account model has already moved past this split — `User.roles[]` is the source of truth (Flow 7 in `docs/PLATFORM_FLOWS.md`), a single account can carry both `user` and `venue_owner`, the `isVenueOwner()` helper exists in `client/src/lib/types.ts`, the server owner gate authorizes against `roles[]` (reading the user fresh from the database on every request), and a `DashboardSwitcher` component already exists and self-gates on `isVenueOwner()`. The UI has not caught up: the duplicate venue-owner URL space still exists, some client checks still read the legacy scalar `user.role` instead of `isVenueOwner()` (`client/src/components/RouteGuard.tsx`), and both `RouteGuard` and the 401 handler in `client/src/lib/api.ts` still route owners to `/venue-portal/signin`.

This feature closes exactly three gaps, and nothing more:

1. **Unify sign-in** — retire the `/venue-portal/signin` and `/venue-portal/signup` URL space so all accounts authenticate through one shared sign-in/sign-up, redirect the old routes, and update every in-app link and the 401-handling redirect in `client/src/lib/api.ts` to the unified surface.
2. **Dual dashboard with a switcher** — one session and one role check (`isVenueOwner`) drive both the normal user dashboard and the retained venue-owner workspace, with a switcher visible only to signed-in accounts holding the `venue_owner` role.
3. **Create-venue floating "+" button (FAB)** on the venues page that opens the existing create-venue stepper, visible only to signed-in accounts whose `roles` include `venue_owner`.

## Non-Goals

The following are explicitly out of scope for this feature:

- **No role-elevation / "become a host" / "List your venue" action** that adds `venue_owner` to an account. No such endpoint exists and none will be added here.
- **No duplicate-account merge migration.** `mergeDuplicateAccounts.js` already exists in the codebase and is not part of this feature's work.
- **No changes to the create-venue stepper itself** (`/venue-portal/venues/create`); the FAB and unified flow only route into the existing stepper.
- **No changes to booking, payment, or settlement flows.**
- **No new account schema or new `roles[]` model work.** `roles[]` is already the source of truth; this feature preserves and verifies that behavior, it does not introduce it.
- **No changes to the admin application** (`admin/`), and no changes to brand or creator flows.
- **No standalone accessibility requirement.** Accessibility is folded as brief criteria into the switcher and FAB requirements.

## Glossary

- **FIRA_Client**: The Next.js client application in `client/`.
- **Unified_Sign_In**: The single shared sign-in surface at `/signin` (and sign-up at `/signup`) used by all accounts regardless of role.
- **Venue_Owner_URL_Space**: The retired authentication routes `/venue-portal/signin` and `/venue-portal/signup`.
- **Owner_Workspace**: The retained venue-owner workspace routes: `/venue-portal/dashboard`, `/venue-portal/venues`, `/venue-portal/bookings`, `/venue-portal/events`, `/venue-portal/analytics`, `/venue-portal/settings`, and their sub-routes.
- **User_Dashboard**: The normal user dashboard route tree rooted at `/dashboard`.
- **Venue_Owner_Account**: An account for which `isVenueOwner()` returns true — its `roles` array includes `venue_owner`, or (backward compatibility) its legacy scalar `role` equals `venue_owner`.
- **Non_Owner_Account**: A signed-in account for which `isVenueOwner()` returns false.
- **Dashboard_Switcher**: The client component (`client/src/components/dashboard/DashboardSwitcher.tsx`) that moves an owner between the User_Dashboard and the Owner_Workspace; it self-gates on `isVenueOwner()`.
- **Create_Venue_FAB**: The floating "+" button on the venues page that opens the existing create-venue stepper.
- **Create_Venue_Stepper**: The existing venue-creation flow at `/venue-portal/venues/create`.
- **Route_Guard**: The client component (`client/src/components/RouteGuard.tsx`) that authorizes access to client routes.
- **API_Client**: The client request layer in `client/src/lib/api.ts`, including its 401-response handling.
- **Owner_Gate**: The server authorization for owner-only venue actions (`venueOwnerAuth` in `server/middleware/venueOwnerAuth.js`), which authorizes against `roles[]` with legacy `role` honored, reading the user from the database on each request.
- **isVenueOwner**: The presentation-only role-check helper in `client/src/lib/types.ts`; source of truth is `roles[]`, with legacy `role` honored.

## Requirements

### Requirement 1: Single shared sign-in and sign-up

**User Story:** As a person with a FIRA account, I want one place to sign in and sign up, so that I reach my session the same way whether I use FIRA as an attendee, a venue owner, or both.

#### Acceptance Criteria

1. THE FIRA_Client SHALL expose exactly one sign-in surface, the Unified_Sign_In at `/signin`, for all accounts.
2. THE FIRA_Client SHALL expose exactly one sign-up surface at `/signup` for all accounts.
3. WHEN a visitor of any account type navigates to `/venue-portal/signin`, THE FIRA_Client SHALL redirect the visitor to the Unified_Sign_In at `/signin`.
4. WHEN a visitor of any account type navigates to `/venue-portal/signup`, THE FIRA_Client SHALL redirect the visitor to the unified sign-up at `/signup`.
5. WHEN a Venue_Owner_Account completes authentication through the Unified_Sign_In, THE FIRA_Client SHALL establish a session that grants access to both the User_Dashboard and the Owner_Workspace.
6. WHEN a Non_Owner_Account completes authentication through the Unified_Sign_In, THE FIRA_Client SHALL establish a session that grants access to the User_Dashboard.
7. IF authentication succeeds but session establishment fails, THEN THE FIRA_Client SHALL treat the attempt as a sign-in failure and return the account to `/signin` with an error message.

### Requirement 2: Route venue-owner sign-in links and redirects to the unified surface

**User Story:** As a venue owner following a sign-in or sign-out path, I want every entry and exit point to use the shared sign-in, so that I never land on a dead or duplicate venue-owner login page.

#### Acceptance Criteria

1. THE FIRA_Client SHALL direct every in-app link that previously targeted `/venue-portal/signin` to the Unified_Sign_In at `/signin`.
2. THE FIRA_Client SHALL direct every in-app link that previously targeted `/venue-portal/signup` to the unified sign-up at `/signup`.
3. WHEN the API_Client receives a 401 response for a request that is not an authentication attempt, THE API_Client SHALL redirect the browser to the Unified_Sign_In at `/signin` regardless of the current route.
4. WHEN an unauthenticated visitor requests an Owner_Workspace route, THE Route_Guard SHALL redirect the visitor to the Unified_Sign_In at `/signin`.
5. WHEN a Venue_Owner_Account signs out, THE FIRA_Client SHALL redirect the account to the Unified_Sign_In or a public landing route rather than to `/venue-portal/signin`.

### Requirement 3: One role check governs dashboard and workspace access

**User Story:** As a venue owner whose account carries both roles, I want one session and one role check to govern what I can reach, so that access is consistent no matter which entry point I used.

#### Acceptance Criteria

1. THE Route_Guard SHALL determine venue-owner access using `isVenueOwner` applied to the authenticated account rather than the legacy scalar `role`.
2. WHEN a Venue_Owner_Account requests an Owner_Workspace route, THE Route_Guard SHALL grant access.
3. WHEN a Venue_Owner_Account requests a User_Dashboard route, THE Route_Guard SHALL grant access.
4. IF a Non_Owner_Account requests an Owner_Workspace route, THEN THE Route_Guard SHALL redirect the account to `/dashboard`.
5. THE Owner_Workspace pages SHALL determine venue-owner access using `isVenueOwner` applied to the authenticated account.

### Requirement 4: Dashboard switcher for signed-in owners only

**User Story:** As a venue owner, I want to switch between my normal user dashboard and my venue owner dashboard, so that I can manage both sides of my account from one session.

#### Acceptance Criteria

1. WHILE a Venue_Owner_Account is signed in and viewing the User_Dashboard, THE FIRA_Client SHALL display the Dashboard_Switcher.
2. WHILE a Venue_Owner_Account is signed in and viewing the Owner_Workspace, THE FIRA_Client SHALL display the Dashboard_Switcher.
3. WHEN a Venue_Owner_Account activates the Dashboard_Switcher from the User_Dashboard, THE FIRA_Client SHALL navigate to `/venue-portal/dashboard`.
4. WHEN a Venue_Owner_Account activates the Dashboard_Switcher from the Owner_Workspace, THE FIRA_Client SHALL navigate to `/dashboard`.
5. WHILE a Non_Owner_Account is signed in, THE FIRA_Client SHALL hide the Dashboard_Switcher.
6. WHILE no account is signed in, THE FIRA_Client SHALL hide the Dashboard_Switcher.
7. THE Dashboard_Switcher SHALL be operable by keyboard and SHALL expose an accessible name describing the switch action.

### Requirement 5: Create-venue floating button on the venues page

**User Story:** As a venue owner viewing venues, I want a floating "+" button that opens the create-venue flow, so that I can start listing a new venue without hunting for the action.

#### Acceptance Criteria

1. WHILE a Venue_Owner_Account is signed in and viewing the venues page, THE FIRA_Client SHALL display the Create_Venue_FAB as a floating "+" control.
2. WHEN a Venue_Owner_Account activates the Create_Venue_FAB, THE FIRA_Client SHALL open the existing Create_Venue_Stepper at `/venue-portal/venues/create`.
3. WHILE a Non_Owner_Account is signed in and viewing the venues page, THE FIRA_Client SHALL hide the Create_Venue_FAB.
4. WHILE no account is signed in and the venues page is viewed, THE FIRA_Client SHALL hide the Create_Venue_FAB.
5. THE FIRA_Client SHALL determine Create_Venue_FAB visibility using `isVenueOwner` applied to the authenticated account.
6. THE Create_Venue_FAB SHALL be operable by keyboard and SHALL expose an accessible name describing the create-venue action.

### Requirement 6: Server-side enforcement and preservation of existing flows

**User Story:** As the platform, I want owner-only venue actions authorized on the server and every existing owner capability preserved, so that hiding a control in the UI is never the only safeguard and unifying sign-in disturbs nothing that works today.

#### Acceptance Criteria

1. WHEN a request to create a venue is received, THE Owner_Gate SHALL authorize the request against the account's `roles` before creating the venue.
2. IF a Non_Owner_Account submits a request to create a venue, THEN THE Owner_Gate SHALL reject the request with an authorization failure and SHALL NOT create the venue.
3. IF an unauthenticated request to create a venue is received, THEN THE Owner_Gate SHALL reject the request with an authentication failure and SHALL NOT create the venue.
4. WHERE an account carries the legacy scalar `role` of `venue_owner` or holds a session established before this feature, THE Owner_Gate SHALL authorize owner-only venue actions for that account.
5. IF the Owner_Gate cannot complete its authorization check due to a system error or misconfiguration, THEN THE Owner_Gate SHALL reject the request with an authorization-system-failure error and SHALL NOT create the venue.
6. THE FIRA_Client SHALL retain the Owner_Workspace routes and the Create_Venue_Stepper with their existing behavior.
7. THE FIRA_Platform SHALL preserve the booking, payment, and settlement flows together as a single unit without modification.
