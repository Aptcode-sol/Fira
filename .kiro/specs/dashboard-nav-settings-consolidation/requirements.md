# Requirements Document

## Introduction

The Fira client currently ships two independent dashboard shells with drifted navigation: the user dashboard (`DashboardLayout`) and the venue owner portal (`VenueDashboardLayout`). The user sidebar carries two extra grouped sections ("EVENTS MANAGEMENT" and "VENUE MANAGEMENT") that duplicate destinations already served elsewhere, and each portal owns its own Settings page — one fully wired, one entirely placeholder.

This feature consolidates navigation and settings across both shells:

- Settings becomes a single shared implementation reached from both portals, pinned beside Logout so both sidebars end in an identical footer.
- The venue-portal placeholder settings screen is deleted.
- "EVENTS MANAGEMENT" is removed as a section; "My Events" becomes a plain nav item directly after "My Tickets".
- "VENUE MANAGEMENT" is removed from the user sidebar; venue destinations exist only in the venue portal, and the orphaned `/dashboard/*` venue routes redirect to their venue-portal counterparts.
- Both sidebar headers left-align the Fira logo with a single collapse/close control on the right, and the venue portal stacks the "Venues" title directly under that logo in every sidebar state.

The change is predominantly deletion. No backend, API, or data-model work is in scope.

## Glossary

- **User_Sidebar**: The navigation aside rendered by `client/src/components/dashboard/DashboardLayout.tsx`.
- **Venue_Sidebar**: The navigation aside rendered by `client/src/components/venue-portal/VenueDashboardLayout.tsx`.
- **Sidebar_Header**: The fixed-height block at the top of a sidebar containing the Fira logo and, in the Venue_Sidebar, the "Venues" title.
- **Pinned_Footer**: The non-scrolling block at the bottom of a sidebar whose position does not change as the scrolling nav list grows.
- **Scrolling_Zone**: The vertically scrollable region of a sidebar holding the portal-specific nav items.
- **Nav_Model**: A React-free TypeScript module exporting the ordered nav item definitions and the Pinned_Footer item list for each sidebar.
- **Shared_Settings_Content**: The single settings UI implementation containing profile fields, Change Password, `BankAccountsSection`, `PushNotificationToggle`, Legal & Policies links, and the Danger Zone delete-account flow.
- **User_Settings_Route**: `/dashboard/settings`.
- **Venue_Settings_Route**: `/venue-portal/settings`.
- **Sidebar_Open_State**: The state in which a sidebar renders at full width with item labels visible (`isOpen` in the User_Sidebar; the equivalent open state in the Venue_Sidebar).
- **Sidebar_Collapsed_State**: The desktop rail state in which a sidebar renders at icon width with item labels hidden.
- **Venue_Owner**: A user for whom `isVenueOwner(user)` from `client/src/lib/types.ts` returns `true`.
- **Nav_Check**: The single runnable `*.check.mjs` file beside the Nav_Model that asserts nav composition and ordering using `node:assert`.

## Requirements

### Requirement 1: One shared Settings implementation, two routes

**User Story:** As a user who works in both the main dashboard and the venue portal, I want one Settings screen with the same controls in both places, so that I do not have to learn two different settings pages or wonder which one actually saves.

#### Acceptance Criteria

1. THE Shared_Settings_Content SHALL exist as exactly one implementation in the client source tree.
2. WHEN a signed-in user navigates to the User_Settings_Route, THE Client SHALL render the Shared_Settings_Content inside `DashboardLayout`.
3. WHEN a signed-in user navigates to the Venue_Settings_Route, THE Client SHALL render the Shared_Settings_Content inside `VenueDashboardLayout`.
4. THE Shared_Settings_Content SHALL present the profile name and phone fields, the inline Change Password control, the payout accounts section (`BankAccountsSection`), the push notification toggle, the Legal & Policies links, and the Danger Zone delete-account control.
5. WHERE the Shared_Settings_Content reports a validation problem tied to a specific input, THE Shared_Settings_Content SHALL display the message adjacent to that input rather than as a toast.
6. THE Client SHALL contain no reference to the removed `bankDetails` state or the owner-gated `usersApi.getProfile` effect previously present in the User_Settings_Route page.

### Requirement 2: Venue-portal placeholder settings removed

**User Story:** As a Venue_Owner, I want the venue portal's Settings link to open working controls, so that I stop filling in forms and toggles that never save anything.

#### Acceptance Criteria

1. THE Client SHALL contain no Profile, Bank Details, Notifications, or Billing tab implementation from the previous Venue_Settings_Route page.
2. WHEN a Venue_Owner opens the Venue_Settings_Route, THE Client SHALL present only the controls listed in Requirement 1 criterion 4.
3. IF a signed-in user who is not a Venue_Owner requests the Venue_Settings_Route, THEN THE Client SHALL redirect that user to `/dashboard`.
4. THE Shared_Settings_Content SHALL present the payout accounts section to every signed-in user without gating on Venue_Owner status.
5. THE Client SHALL contain no venue-owner-specific settings section, placeholder, or stub slot.

### Requirement 3: Identical Pinned_Footer in both sidebars

**User Story:** As a user switching between the two portals, I want Settings and Sign Out to sit in the same place in both sidebars, so that muscle memory carries over.

#### Acceptance Criteria

1. THE User_Sidebar Pinned_Footer SHALL present Settings as the last item above Logout.
2. THE Venue_Sidebar Pinned_Footer SHALL present Settings as the last item above Sign Out.
3. THE Venue_Sidebar Scrolling_Zone SHALL exclude the Settings item.
4. WHILE the Scrolling_Zone content exceeds the available sidebar height, THE Pinned_Footer SHALL remain at the bottom edge of its sidebar in both the User_Sidebar and the Venue_Sidebar.
5. THE Nav_Model SHALL express the Settings-then-Logout ordering for both sidebars in a single shared list so that the two Pinned_Footer definitions cannot diverge.

### Requirement 4: "EVENTS MANAGEMENT" section removed, "My Events" promoted

**User Story:** As any signed-in user, I want "My Events" to sit in the main nav list right after "My Tickets", so that I reach my events with one predictable click instead of hunting a separate grouped section.

#### Acceptance Criteria

1. THE User_Sidebar SHALL contain no "Events Management" section header.
2. THE Nav_Model SHALL contain no `eventOrganizerItems` list.
3. THE User_Sidebar Scrolling_Zone SHALL present "My Events" (`/dashboard/events`) immediately after "My Tickets" (`/dashboard/tickets`).
4. THE User_Sidebar SHALL present "My Events" to every signed-in user regardless of role, roles array, or verification badge.
5. THE User_Sidebar SHALL render exactly one link to `/dashboard/events`.
6. THE Client SHALL contain no `hasEvents` gating constant in `DashboardLayout`.

### Requirement 5: "VENUE MANAGEMENT" removed from the user sidebar

**User Story:** As a Venue_Owner, I want venue management to live only in the venue portal, so that the same screens are not offered from two different shells.

#### Acceptance Criteria

1. THE User_Sidebar SHALL contain no "Venue Management" section header.
2. THE Nav_Model SHALL contain no `venueOwnerItems` list.
3. THE User_Sidebar SHALL present no link to `/dashboard/venues` and no link to `/dashboard/requests`.
4. THE Client SHALL contain no `showVenueManagement` constant and no `isVenueOwner` import in `DashboardLayout`.
5. THE User_Sidebar item list SHALL be identical for a Venue_Owner, an admin, and a regular signed-in user.

### Requirement 6: Orphaned dashboard venue routes redirect to the venue portal

**User Story:** As a Venue_Owner who has an old bookmark or an in-page link to `/dashboard/venues`, I want to land on the live venue-portal screen, so that I never reach a second stale copy of the same page.

#### Acceptance Criteria

1. WHEN a signed-in user requests `/dashboard/venues`, THE Client SHALL redirect that user to `/venue-portal/venues`.
2. WHEN a signed-in user requests `/dashboard/requests`, THE Client SHALL redirect that user to `/venue-portal/events`.
3. THE Client SHALL retain exactly one rendered implementation of each venue management screen after the redirects are in place.
4. WHEN the redirect is in effect, THE Client SHALL preserve the user's authenticated session across the navigation.

### Requirement 7: Left-aligned logo with a single collapse control

**User Story:** As a user reading the sidebar, I want the Fira logo pinned to the left edge with one obvious control to close the sidebar, so that the header reads as a header instead of a centred logo fighting a hamburger.

#### Acceptance Criteria

1. WHILE a sidebar is in the Sidebar_Open_State, THE Sidebar_Header SHALL align the Fira logo to the left edge of the header's content box.
2. WHILE a sidebar is in the Sidebar_Open_State, THE Sidebar_Header SHALL present exactly one collapse-or-close control, positioned at the right edge of the header.
3. WHEN a user activates the collapse-or-close control, THE Client SHALL move that sidebar into the Sidebar_Collapsed_State on desktop viewports and close the drawer on viewports narrower than 1024px.
4. THE Sidebar_Header SHALL contain no control absolutely positioned at the left edge.
5. WHILE a sidebar is in the Sidebar_Collapsed_State, THE Sidebar_Header SHALL centre the Fira logo within the rail and present no collapse-or-close control.
6. WHEN a user activates the Fira logo, THE Client SHALL navigate to `/`.
7. THE Sidebar_Header SHALL keep its existing height of 4rem below 1024px and 5rem at 1024px and wider.

### Requirement 8: "Venues" title stacked under the logo in the venue portal

**User Story:** As a Venue_Owner, I want the word "Venues" directly under the Fira logo at the top of the menu, so that I can tell at a glance which portal I am in whether the sidebar is open or collapsed.

#### Acceptance Criteria

1. WHILE the Venue_Sidebar is in the Sidebar_Open_State, THE Sidebar_Header SHALL render the "Venues" title on the line directly below the Fira logo.
2. WHILE the Venue_Sidebar is in the Sidebar_Collapsed_State, THE Sidebar_Header SHALL render the "Venues" title on the line directly below the Fira logo.
3. THE Venue_Sidebar Sidebar_Header SHALL use a single vertical stacking layout for the logo and the "Venues" title in every sidebar state.
4. THE Venue_Sidebar Sidebar_Header SHALL render the logo and the "Venues" title within the header height stated in Requirement 7 criterion 7 without clipping either element.
5. THE User_Sidebar Sidebar_Header SHALL render no portal title beneath the Fira logo.

### Requirement 9: Nav composition is verifiable without a browser

**User Story:** As the next developer changing the sidebars, I want one runnable check that fails if nav ordering or footer composition regresses, so that I can confirm the consolidation still holds without clicking through both portals.

#### Acceptance Criteria

1. THE Nav_Model SHALL export the User_Sidebar item list, the Venue_Sidebar item list, and the shared Pinned_Footer item list from a module that imports no React or Next.js runtime code.
2. THE Nav_Check SHALL reside beside the Nav_Model source file and SHALL use `node:assert` with no test framework and no fixtures.
3. THE Nav_Check SHALL assert that "My Events" directly follows "My Tickets" in the User_Sidebar item list.
4. THE Nav_Check SHALL assert that no item labelled "Events Management" or "Venue Management" appears in either sidebar item list.
5. THE Nav_Check SHALL assert that the Pinned_Footer item list ends with Settings followed by the sign-out item for both sidebars.
6. THE Nav_Check SHALL assert that the User_Sidebar item list contains no `/dashboard/venues` href and no `/dashboard/requests` href.
7. WHEN the Nav_Check is executed with `node`, THE Nav_Check SHALL exit with status code 0 on success and a non-zero status code on any failed assertion.
8. THE repository SHALL contain exactly one check file for this feature's nav composition logic.

### Requirement 10: No functional or visual regressions in surviving behaviour

**User Story:** As an existing user, I want everything else about the two dashboards to keep working exactly as before, so that a navigation cleanup does not cost me features.

#### Acceptance Criteria

1. THE User_Sidebar SHALL continue to present Overview, My Bookings, My Tickets, Payments, and Policies with their existing hrefs.
2. WHERE the signed-in user's `verificationBadge` is `brand`, `band`, or `organizer`, THE User_Sidebar Pinned_Footer SHALL continue to present the Brand Profile section.
3. THE Venue_Sidebar Scrolling_Zone SHALL continue to present Dashboard, My Venues, Bookings, Event Requests, Analytics, and Earnings with their existing hrefs.
4. THE Venue_Sidebar Pinned_Footer SHALL continue to present the signed-in user's avatar, name, and email above the Settings and Sign Out items.
5. THE Client SHALL continue to persist the User_Sidebar pinned state under the `dashboard_sidebar_expanded` key and the Venue_Sidebar pinned state under the `venue_sidebar_expanded` key.
6. WHEN the `toggle-dashboard-sidebar` window event is dispatched, THE User_Sidebar SHALL toggle its pinned state.
7. WHEN a user activates a nav item on a viewport narrower than 1024px, THE Client SHALL close the sidebar drawer.
8. THE Client SHALL compile with no TypeScript errors and no unused-import or unused-variable lint errors introduced by the deletions in Requirements 1, 2, 4, and 5.
