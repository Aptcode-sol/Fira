# Bugfix Requirements Document

## Introduction

This spec captures the remaining QA-pass interaction, behavior, and UX-behavior defects for the Firaa platform (Next.js client at `client/src/app` and `client/src/components`, React+Vite admin, Express+MongoDB server). These are the defects from the QA PDF that are **not** owned by the three existing specs. Each defect is expressed as a bug condition: the current incorrect behavior, the expected correct behavior, and the regression checks that must stay unchanged.

The bugs here are predominantly **client-side interaction and UX behavior** — focus loss on keystroke, scroll-chaining, toast/modal layering, navbar indicator behavior, validation timing, viewport zoom, and similar. They are grounded in the client where possible but are treated as behavior fixes, not deep money-path changes.

### Boundary With Other Specs (No Overlap)

To ensure the QA PDF is fully covered across the two new specs (platform-flow-fixes and platform-interaction-fixes) with no dependency on the older spec, this spec now captures the QA-PDF layout/overflow items directly rather than deferring them elsewhere:

- **Layout/overflow PDF items owned here:** the venues filter-popup-vs-bottom-bar overlap on mobile (clauses 31.x/32.x/33.x), the event-create mobile content overflow (clauses 34.x/35.x/36.x), and cross-platform scroll reliability across Android/iOS/macOS in client and admin (clauses 37.x/38.x/39.x). These specific PDF defects are first-class clauses in this spec so it is self-contained.
- **ui-ux-responsive-validation** remains a related/complementary spec for broad structural work (horizontal overflow, sidebar containment / mobile drawer, bottom-nav & dynamic-island clearance, card-grid responsiveness, generic input max-width containment, decorative element containment, content max-width on large screens, and fixed-element jitter). It is referenced for broad structural coordination, but the specific PDF items listed above are owned here, not deferred to it. This spec still specifies per-element **interaction/spacing behavior** (e.g., carousel row inset, dashboard sidebar-content gap).
- **platform-feature-overhaul** owns: Contact Us cleanup, completed events in public/admin listing, discount code CRUD, creator bank-details field, self-follow fix, scanning links/access-codes feature, custom ticket tiers feature, billing card component, inquiry model/feature. This spec references the scanning feature and inquiry feature but only specifies their **runtime interaction behavior** (gate/tier allocation UI, chat integration surface).
- **platform-flow-fixes** owns money/settlement/payout, discount-bearer rule, booking advance sync, tier purchase payment, event visibility/approval gating, combined role account + dashboard switcher, and admin panel coordination. This spec references it for the numbers behind Transactions vs Earnings but only specifies the **display/interaction** distinction.
- **industry-standard-upgrade** owns security/encryption/testing/resilience. Referenced only.

### Cross-Cutting Bugs

Four defects recur across many pages. Each is encoded once (clauses 1.x–4.x below) with the specific pages where it manifests noted. Page-scoped clauses reference the cross-cutting clause rather than repeating it:

- **CC-1 (clauses x.1–x.2)** — Inputs lose focus on every keystroke (component remount per keystroke).
- **CC-2 (clauses x.3–x.4)** — Form submission causes viewport zoom (iOS auto-zoom / programmatic zoom).
- **CC-3 (clauses x.5–x.6)** — Background scrolls behind modals (scroll-chaining, no body-scroll lock).
- **CC-4 (clause x.7)** — Toasts render behind modals (z-index layering).

### Areas Covered

- Cross-cutting (CC): clauses 1–7 (map to Current/Expected/Unchanged below via IDs 1.x/2.x/3.x)
- Home page: clauses 4.x / 5.x / 6.x
- Venues page: clauses 7.x / 8.x / 9.x
- Events page: clauses 10.x / 11.x / 12.x
- Creators page: clauses 13.x / 14.x / 15.x
- Dashboard: clauses 16.x / 17.x / 18.x
- Venue owner dashboard: clauses 19.x / 20.x / 21.x
- Chat & enquiry restore: clauses 22.x / 23.x / 24.x
- Static / Legal pages: clauses 25.x / 26.x / 27.x
- Admin auth: clauses 28.x / 29.x / 30.x
- Venues filter vs bottom bar (layout/overflow): clauses 31.x / 32.x / 33.x
- Events create mobile overflow (layout/overflow): clauses 34.x / 35.x / 36.x
- Cross-platform scroll reliability (layout/overflow): clauses 37.x / 38.x / 39.x

## Bug Analysis

### Current Behavior (Defect)

**Cross-Cutting CC-1 — Inputs lose focus on every keystroke** (manifests: venue booking purpose/guests fields, Ask Enquiry, event create-post input, all controlled inputs whose parent remounts per render)

1.1 WHEN a user types a character into an affected input THEN the system re-creates/remounts the input element and the caret loses focus, requiring a re-click before the next keystroke.
1.2 WHEN a user types a multi-character value into an affected input THEN the system captures only one character per focus, making continuous typing impossible.

**Cross-Cutting CC-2 — Form submission causes viewport zoom** (manifests: creator-apply dashboard, and multiple submit flows across the site)

1.3 WHEN a user focuses an input whose font-size is below 16px on mobile THEN the mobile browser auto-zooms the viewport into the field.
1.4 WHEN a user submits an affected form THEN the resulting view renders zoomed-in and does not reset to the normal viewport scale.

**Cross-Cutting CC-3 — Background scrolls behind modals** (manifests: every popup/modal — venue booking, event ticket booking, ask enquiry, post delete confirm, all `client/src/components/modals`)

1.5 WHEN a modal is open and the user reaches the top or bottom of the modal's scroll area and keeps scrolling THEN the background page scrolls behind the modal (scroll chaining).
1.6 WHEN a modal is open THEN the body remains scrollable behind the overlay.

**Cross-Cutting CC-4 — Toasts render behind modals** (manifests: events page ticket flow, any page showing a toast while a popup is open)

1.7 WHEN a toast fires while a modal/popup is open THEN the toast renders beneath the modal overlay and is not visible to the user.

**Home page** (grounded in `client/src/app/page.tsx`, `client/src/components/HomeClient.tsx`, `client/src/components/Navbar.tsx`)

4.1 WHEN the navbar renders THEN the system shows a redundant "Home" nav item even though the Fira logo already links home.
4.2 WHEN a tab is active THEN the system renders an active-tab underline/indicator of inconsistent size.
4.3 WHEN a user navigates between pages THEN the Fira logo disappears during navigation.
4.4 WHEN a user activates the "View Parties" control/symbol THEN the system does nothing (no navigation).
4.5 WHEN a logged-in user views the home page THEN the system shows a "Join Now" button that routes to the create-account/sign-up page.
4.6 WHEN the home page renders THEN the system shows "Learn more" buttons.
4.7 WHEN a horizontally-scrollable row renders THEN the first item is flush against the screen edge with no leading inset.
4.8 WHEN a user is on the notifications page THEN the system highlights the dashboard nav item as active instead of the notifications item, and the notifications tab is nested inside the dashboard rather than a separate top-level page.
4.9 WHEN a user scrolls the page on a mobile device THEN the page does not scroll vertically.

**Venues page** (grounded in `client/src/app/venues`, `VenueCard.tsx`, `LocationFilter.tsx`, `InquiryForm.tsx`, `Navbar.tsx`)

7.1 WHEN a user clicks any option inside the filter THEN the system calls the API on every click.
7.2 WHEN filters are selected THEN the system renders selected-item chips with close icons outside the filter.
7.3 WHEN a user clicks a venue THEN the navbar active "lamp" indicator animates from the bottom of the page upward.
7.4 WHEN a user submits venue booking without required fields (event type/purpose) THEN the validation error appears in the background masked behind the modal.
7.5 WHEN a user types into booking inputs (purpose/event field, expected guests) THEN the inputs lose focus after every keystroke (instance of CC-1, clauses 1.1–1.2).
7.6 WHEN a user enters a max-number-of-guests value THEN the system performs no validation against venue capacity.
7.7 WHEN the booking flow runs THEN the system throws a "booker is not defined" ReferenceError.
7.8 WHEN a user starts venue booking THEN the calendar is presented before "Book Ticket"/proceed rather than after.
7.9 WHEN a user scrolls to the bounds of a booking popup THEN the background scrolls behind it (instance of CC-3, clauses 1.5–1.6).
7.10 WHEN a user types into the Ask Enquiry phone-number field THEN the field accepts letters.
7.11 WHEN venue availability is shown THEN the UI text says "showing two months" but availability is not limited to two months.
7.12 WHEN venue images render on mobile THEN they display as squarish rather than cropped landscape.
7.13 WHEN, on mobile, an input in a venues-page form/modal is focused and the on-screen keyboard opens THEN the fixed bottom navigation bar lifts up and sits on top of the keyboard instead of staying pinned or hidden.

**Events page** (grounded in `client/src/app/events`, `EventCard.tsx`, `PostCard.tsx`, `TicketDisplay.tsx`, event-management components)

10.1 WHEN a toast fires while a popup is open on the events page THEN the toast appears behind the modal (instance of CC-4, clause 1.7).
10.2 WHEN a user clicks the quantity "+" control THEN the system allows exceeding available slots/ticket quantity.
10.3 WHEN the "family and friends" tier is selected THEN the tier tick/checkmark renders incorrectly.
10.4 WHEN a user scrolls the mouse wheel over the max-tickets number input THEN the value changes.
10.5 WHEN the manage-event page renders THEN the event image is a different size than on the events listing.
10.6 WHEN total revenue is displayed with no bookings THEN the system shows "free" instead of 0.
10.7 WHEN event info displays a price THEN the system shows the first tier's price.
10.8 WHEN the ticket-booking UI renders THEN it does not list the available ticket tiers.
10.9 WHEN a user types into the create-post input THEN it loses focus after every keystroke (instance of CC-1, clauses 1.1–1.2).
10.10 WHEN a user edits a post in event management THEN the text updates but the image actions do not work.
10.11 WHEN a user deletes a post THEN the system triggers a native browser `confirm()` alert.
10.12 WHEN a user creates an event THEN the form is a bottom-anchored form that isn't fully visible, and the same non-reusable form is used when editing.
10.13 WHEN a user creates a venue THEN the same bottom-anchored non-stepper form problem occurs.
10.14 WHEN a user sets a discount code's valid-from/valid-until THEN the system allows dates before and beyond the event date.
10.15 WHEN configuring scanning THEN the system does not allow per-tier allocation of entries to a given gate/scanner at event-creation time.
10.16 WHEN creating an event THEN discount codes/coupons cannot be configured within the event-creation flow.

**Creators page** (grounded in `client/src/app/creators`, `client/src/app/brands`, `BrandHeader.tsx`)

13.1 WHEN a creator's individual page renders THEN the system shows a duplicate "Get in Touch" block in addition to the socials.
13.2 WHEN the creator page renders on mobile THEN the layout is flushed to the right.
13.3 WHEN a user scrolls the creator page THEN content overlaps.
13.4 WHEN a user applies as a creator and the dashboard renders THEN the viewport renders zoomed-in (instance of CC-2, clauses 1.3–1.4).

**Dashboard** (grounded in `client/src/app/dashboard`, `client/src/components/dashboard`, `BillingCard.tsx`)

16.1 WHEN a user clicks "My Bookings" on mobile THEN the section shows empty and only renders after the user scrolls.
16.2 WHEN a user views the Payments area THEN the "Transactions" and "Earnings" tabs show identical content.
16.3 WHEN "Change Password" renders on desktop THEN it is flushed left and unsuitable for desktop layout.
16.4 WHEN a user activates "Delete Account" THEN no action is wired.
16.5 WHEN the dashboard renders on desktop THEN there is no gap between the sidebar and the content.

**Venue owner dashboard** (grounded in `client/src/app/venue-portal`, `client/src/components/venue-portal`)

19.1 WHEN the "All Requests/Pending/Approved/Rejected" status dropdown renders THEN it has no styling.
19.2 WHEN a venue owner saves a location/maps link THEN the system does not validate the URL.
19.3 WHEN the settings page in the venue dashboard renders on desktop THEN it is flushed left.

**Chat & enquiry restore** (grounded in `client/src/app/messages`, `client/src/app/inbox`, `InquiryForm.tsx`, server `Conversation`/`Message` models)

22.1 WHEN a user wants to converse about an event/venue inquiry THEN the chat and enquiry features are absent/not integrated, despite `Conversation` and `Message` models existing on the server.

**Static / Legal pages** (grounded in `client/src/app` static routes — privacy policy, terms & conditions, refund policy, help & support, cancellation)

25.1 WHEN the privacy policy, terms & conditions, refund policy, help & support, or cancellation page renders THEN the system leaves blank left/right margins because the content does not use the standard page container width.
25.2 WHEN these static/legal pages render THEN the system applies inconsistent heading colors/styles across the pages, each page styling its headings differently.

**Admin auth** (grounded in `admin/src/pages/Login.jsx`, React+Vite admin)

28.1 WHEN the admin panel sign-in page renders THEN the login card is not horizontally/vertically centered in the viewport.

**Venues filter vs bottom bar** (layout/overflow, grounded in `client/src/app/venues`, `LocationFilter.tsx`, `Navbar.tsx`)

31.1 WHEN, on mobile, the venues filter popup/overlay is open THEN the fixed bottom navigation bar partially covers it, so the bottom of the filter (e.g. its Apply / Show Results control) is obscured and not reachable.

**Events / create mobile overflow** (layout/overflow, grounded in `client/src/app/create`, event-creation and create-form components)

34.1 WHEN, on mobile, the event-creation UI (and similarly-structured create forms) renders THEN the content overflows the screen border — content is cut off or extends beyond the viewport width.

**Cross-platform scroll reliability** (layout/overflow, grounded in scroll containers across `client/src` and `admin/src`)

37.1 WHEN a user scrolls on mobile Android, iOS, or macOS browsers (in the client or the admin panel) THEN scrolling misbehaves — pages fail to scroll smoothly or at all in places (a general scroll-reliability defect distinct from the home-page mobile-scroll clause 4.9 and the modal scroll-lock clauses 1.5–1.6).

### Expected Behavior (Correct)

**Cross-Cutting CC-1 — Focus retention**

2.1 WHEN a user types a character into any input THEN the system SHALL keep the input mounted and retain focus so the caret stays in place.
2.2 WHEN a user types a multi-character value into any input THEN the system SHALL accept all characters in a single continuous focus session without re-clicking.

**Cross-Cutting CC-2 — No viewport zoom**

2.3 WHEN a user focuses any input on mobile THEN the system SHALL use an input font-size of at least 16px so the browser does not auto-zoom.
2.4 WHEN a user submits any form THEN the system SHALL NOT cause the viewport to zoom and SHALL render at normal scale.

**Cross-Cutting CC-3 — No scroll chaining**

2.5 WHEN a user scrolls past a modal's scroll bounds THEN the system SHALL contain the scroll within the modal and SHALL NOT scroll the background.
2.6 WHEN any modal is open THEN the system SHALL lock body scroll until the modal closes.

**Cross-Cutting CC-4 — Toast above modal**

2.7 WHEN a toast fires while a modal/popup is open THEN the system SHALL render the toast above the modal/popup so it is visible.

**Home page**

5.1 WHEN the navbar renders THEN the system SHALL NOT show a redundant "Home" nav item; the logo SHALL be the sole home link.
5.2 WHEN a tab is active THEN the system SHALL render a constant small underscore-style indicator of consistent size.
5.3 WHEN a user navigates between pages THEN the system SHALL keep the Fira logo visible/persistent throughout navigation.
5.4 WHEN a user activates the "View Parties" control THEN the system SHALL navigate to the parties/events listing.
5.5 WHEN a logged-in user views the home page THEN the system SHALL NOT show a sign-up CTA; it SHALL either hide it or route to the appropriate authenticated destination.
5.6 WHEN the home page renders THEN the system SHALL NOT render "Learn more" buttons.
5.7 WHEN a horizontally-scrollable row renders THEN the system SHALL apply a left padding/margin so the first item is not flush to the screen edge (per-row inset; coordinate with ui-ux-responsive-validation for structural overflow).
5.8 WHEN a user is on the notifications page THEN the system SHALL highlight the notifications nav item as active, AND the notifications page SHALL be a separate top-level page removed from inside the dashboard.
5.9 WHEN a user scrolls the page on a mobile device THEN the system SHALL restore normal vertical scrolling (reference ui-ux-responsive-validation for any overlap with fixed elements).

**Venues page**

8.1 WHEN a user selects filter options THEN the system SHALL apply and call the API only when the user clicks "Show Results" (a single efficient API call).
8.2 WHEN filters are applied THEN the system SHALL NOT render selected-item chips with close icons outside; it SHALL show the filter with a count badge of applied filters.
8.3 WHEN a user clicks a venue THEN the system SHALL NOT perform the bottom-up "lamp" pop animation on navigation.
8.4 WHEN a user submits venue booking without required fields THEN the system SHALL show validation errors within the modal/visible layer, not behind it.
8.5 WHEN a user types into booking inputs THEN the system SHALL retain focus (satisfied by CC-1 fix, clauses 2.1–2.2).
8.6 WHEN a user enters a max-number-of-guests value THEN the system SHALL validate against the venue capacity / a sensible max and show an inline error when exceeded.
8.7 WHEN the booking flow runs THEN the system SHALL NOT reference an undefined variable; the "booker is not defined" ReferenceError SHALL be eliminated.
8.8 WHEN a user starts venue booking THEN the system SHALL present the calendar in the popup AFTER "Book Ticket"/proceed.
8.9 WHEN a user scrolls to the bounds of a booking popup THEN the system SHALL prevent background scroll (satisfied by CC-3 fix, clauses 2.5–2.6).
8.10 WHEN a user types into the Ask Enquiry phone-number field THEN the system SHALL accept digits/phone format only.
8.11 WHEN venue availability is shown THEN the system SHALL either limit availability to two months OR correct the text to match the actual behavior.
8.12 WHEN venue images render on mobile THEN the system SHALL show cropped landscape-type images consistent with desktop.
8.13 WHEN the on-screen keyboard is open on mobile THEN the fixed bottom nav SHALL NOT ride above the keyboard; it SHALL either stay pinned to the visual viewport bottom or be hidden while the keyboard is open (reference ui-ux-responsive-validation for fixed-element behavior — this is the keyboard-interaction case).

**Events page**

11.1 WHEN a toast fires while a popup is open THEN the system SHALL render the toast above modals/popups (satisfied by CC-4 fix, clause 2.7).
11.2 WHEN a user clicks the quantity "+" control at the maximum THEN the system SHALL disable/stop at the max and show inline that the limit is reached.
11.3 WHEN the "family and friends" tier is selected THEN the system SHALL render the tier selection tick correctly.
11.4 WHEN a user scrolls the mouse wheel over a number input THEN the system SHALL NOT change the value (wheel-to-change disabled).
11.5 WHEN the manage-event page renders THEN the event image SHALL be sized consistently with the events listing.
11.6 WHEN total revenue is displayed THEN the system SHALL compute it from (tickets booked × price) and show 0 (or ₹0) when none.
11.7 WHEN event info displays a price THEN the system SHALL show the lowest tier price as "from ₹X onwards".
11.8 WHEN the ticket-booking UI renders THEN the system SHALL list the available ticket tiers.
11.9 WHEN a user types into the create-post input THEN the system SHALL retain focus (satisfied by CC-1 fix, clauses 2.1–2.2).
11.10 WHEN a user edits a post in event management THEN the system SHALL apply image edit actions along with text.
11.11 WHEN a user deletes a post THEN the system SHALL use an in-app confirmation popup consistent with the site (no native `confirm()`).
11.12 WHEN a user creates an event THEN the system SHALL present a multi-step popup/modal (stepper with Next buttons, same UI as ticket-tier steps), and the same flow SHALL be reusable when editing.
11.13 WHEN a user creates a venue THEN the system SHALL use the same multi-step popup/modal treatment.
11.14 WHEN a user sets a discount code's valid-from/valid-until THEN the system SHALL bound validity to the event's date window.
11.15 WHEN configuring scanning THEN the system SHALL support assigning, per tier, how many entries are allocated to a given gate/scanner at event-creation time (runtime behavior of the scanning-links feature — reference platform-feature-overhaul).
11.16 WHEN creating an event THEN the system SHALL surface discount code/coupon setup within the event-creation flow (references discount CRUD owned by platform-feature-overhaul).

**Creators page**

14.1 WHEN a creator's individual page renders THEN the system SHALL keep socials and remove the redundant "Get in Touch" block.
14.2 WHEN the creator page renders on mobile THEN the layout SHALL match the desktop left-aligned layout.
14.3 WHEN a user scrolls the creator page THEN the system SHALL NOT overlap content.
14.4 WHEN a user applies as a creator THEN the system SHALL NOT cause the viewport to zoom (satisfied by CC-2 fix, clauses 2.3–2.4).

**Dashboard**

17.1 WHEN a user opens "My Bookings" THEN the system SHALL render bookings immediately on load without requiring a scroll.
17.2 WHEN a user views the Payments area THEN the system SHALL show distinct, correct data — Transactions = money the user paid; Earnings = money owed/settled to the user as an owner (numbers reference platform-flow-fixes).
17.3 WHEN "Change Password" renders THEN the system SHALL provide it as a proper dropdown/section within the settings page with proper layout.
17.4 WHEN a user activates "Delete Account" THEN the system SHALL perform account deletion with confirmation.
17.5 WHEN the dashboard renders on desktop THEN the system SHALL apply appropriate spacing/gap between the sidebar and the content (coordinate with ui-ux-responsive-validation; this is the specific dashboard sidebar-content gap).

**Venue owner dashboard**

20.1 WHEN the status dropdown renders THEN the system SHALL style it consistently with the app.
20.2 WHEN a venue owner saves a location/maps link THEN the system SHALL validate it as a valid URL / maps link and reject invalid input with an inline error.
20.3 WHEN the settings page in the venue dashboard renders on desktop THEN the system SHALL use a layout suitable for desktop.

**Chat & enquiry restore**

23.1 WHEN a user submits or opens an inquiry THEN the system SHALL provide a chat/messaging capability integrated with the inquiry flow so a sender and owner can converse about an event/venue inquiry, backed by the existing `Conversation` and `Message` models (references the inquiry feature owned by platform-feature-overhaul).

**Static / Legal pages**

26.1 WHEN the privacy policy, terms & conditions, refund policy, help & support, or cancellation page renders THEN the system SHALL use the standard shared page container/margins consistent with the rest of the site.
26.2 WHEN these static/legal pages render THEN the system SHALL use a single consistent heading color/style across all of them.

**Admin auth**

29.1 WHEN the admin panel sign-in page renders THEN the system SHALL center the login card in the viewport on both axes across all breakpoints.

**Venues filter vs bottom bar**

32.1 WHEN, on mobile, the venues filter popup/overlay is open THEN the system SHALL render the filter fully above/clear of the bottom nav — either layered above it with padding for the nav height, or with the nav hidden while the filter is open — so all filter controls (including Apply / Show Results) are reachable.

**Events / create mobile overflow**

35.1 WHEN, on mobile, the event-creation UI renders THEN the system SHALL keep content within the mobile viewport width (no horizontal overflow, no content beyond the border) using the standard responsive container.

**Cross-platform scroll reliability**

38.1 WHEN a user scrolls in the client or admin on Android, iOS, or macOS browsers THEN the system SHALL provide reliable vertical scrolling with no scroll traps caused by height/overflow locks on scroll containers.

### Unchanged Behavior (Regression Prevention)

**Cross-Cutting**

3.1 WHEN a user types into an input that already retains focus correctly THEN the system SHALL CONTINUE TO accept input normally.
3.2 WHEN a controlled input's value changes THEN the system SHALL CONTINUE TO reflect the updated value in state.
3.3 WHEN a user pinch-zooms manually THEN the system SHALL CONTINUE TO allow user-initiated zoom.
3.4 WHEN a form submits successfully THEN the system SHALL CONTINUE TO perform its existing submit behavior and navigation.
3.5 WHEN no modal is open THEN the system SHALL CONTINUE TO allow normal page scrolling.
3.6 WHEN a modal closes THEN the system SHALL CONTINUE TO restore the prior scroll position and body scrollability.
3.7 WHEN a toast fires with no modal open THEN the system SHALL CONTINUE TO display the toast at its normal position and z-order.

**Home page**

6.1 WHEN the logo is clicked THEN the system SHALL CONTINUE TO navigate to the home page.
6.2 WHEN a non-active tab renders THEN the system SHALL CONTINUE TO render without an active indicator.
6.3 WHEN a logged-out user views the home page THEN the system SHALL CONTINUE TO show the appropriate sign-up/join CTA.
6.4 WHEN a horizontal row is scrolled THEN the system SHALL CONTINUE TO scroll horizontally through all items.
6.5 WHEN a user is on the dashboard page THEN the system SHALL CONTINUE TO highlight the dashboard nav item as active.
6.6 WHEN a user scrolls on desktop THEN the system SHALL CONTINUE TO scroll normally.

**Venues page**

9.1 WHEN "Show Results" is clicked THEN the system SHALL CONTINUE TO return correctly filtered venues.
9.2 WHEN no filters are applied THEN the system SHALL CONTINUE TO show all venues with no count badge.
9.3 WHEN a user navigates normally THEN the navbar SHALL CONTINUE TO indicate the active route.
9.4 WHEN required booking fields are filled THEN the system SHALL CONTINUE TO submit the booking successfully.
9.5 WHEN a valid guest count within capacity is entered THEN the system SHALL CONTINUE TO accept it.
9.6 WHEN the phone field receives valid digits THEN the system SHALL CONTINUE TO accept them.
9.7 WHEN venue images render on desktop THEN the system SHALL CONTINUE TO display their current landscape crop.
9.8 WHEN no on-screen keyboard is open THEN the bottom nav SHALL CONTINUE TO stay pinned at the viewport bottom as it does today.

**Events page**

12.1 WHEN the quantity is below the maximum THEN the "+" control SHALL CONTINUE TO increment.
12.2 WHEN a tier other than "family and friends" is selected THEN the tick SHALL CONTINUE TO render correctly.
12.3 WHEN a user types a value into a number input THEN the system SHALL CONTINUE TO accept typed values.
12.4 WHEN tickets are booked THEN revenue SHALL CONTINUE TO compute correctly for non-zero bookings.
12.5 WHEN a post's text is edited THEN the system SHALL CONTINUE TO save the updated text.
12.6 WHEN an event/venue is created THEN the system SHALL CONTINUE TO persist it with all existing fields.
12.7 WHEN a discount code's dates fall within the event window THEN the system SHALL CONTINUE TO accept them.

**Creators page**

15.1 WHEN the creator page renders THEN the socials block SHALL CONTINUE TO be shown and functional.
15.2 WHEN the creator page renders on desktop THEN the system SHALL CONTINUE TO show the existing left-aligned layout.
15.3 WHEN the creator application submits THEN the system SHALL CONTINUE TO perform its existing submit and navigation behavior.

**Dashboard**

18.1 WHEN a user has bookings THEN the system SHALL CONTINUE TO list them correctly.
18.2 WHEN a user has transaction and earnings data THEN the system SHALL CONTINUE TO compute each correctly per platform-flow-fixes.
18.3 WHEN a user changes their password THEN the system SHALL CONTINUE TO update it successfully.
18.4 WHEN a user confirms account deletion THEN the system SHALL remove the account and its associated data appropriately.
18.5 WHEN the dashboard renders on mobile THEN the system SHALL CONTINUE TO use its mobile layout.

**Venue owner dashboard**

21.1 WHEN a status is selected from the dropdown THEN the system SHALL CONTINUE TO filter requests by that status.
21.2 WHEN a valid maps link is saved THEN the system SHALL CONTINUE TO persist it.
21.3 WHEN the venue settings page renders on mobile THEN the system SHALL CONTINUE TO use its mobile layout.

**Chat & enquiry restore**

24.1 WHEN an inquiry is submitted THEN the system SHALL CONTINUE TO create the inquiry record as it does today.
24.2 WHEN existing `Conversation`/`Message` data is present THEN the system SHALL CONTINUE TO preserve and read it correctly.

**Static / Legal pages**

27.1 WHEN the static/legal pages render THEN the system SHALL CONTINUE TO preserve the body copy/legal text content unchanged; only the layout container and heading styling change.

**Admin auth**

30.1 WHEN a user signs in via the admin panel THEN the system SHALL CONTINUE TO preserve the login form fields, validation, and submit behavior unchanged.

**Venues filter vs bottom bar**

33.1 WHEN the venues filter renders on desktop THEN the system SHALL CONTINUE TO render it as today with no bottom-nav overlap.

**Events / create mobile overflow**

36.1 WHEN the event-creation UI renders on desktop THEN the system SHALL CONTINUE TO render within its container as today.

**Cross-platform scroll reliability**

39.1 WHEN a platform/page already scrolls correctly THEN the system SHALL CONTINUE TO scroll as today.

## Deriving the Bug Condition

Representative bug conditions and properties for the highest-value fixes. **F** = original (unfixed) function; **F'** = fixed function.

### CC-1 — Input focus retention

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type KeystrokeEvent
  OUTPUT: boolean
  // Bug triggers when the input's owning component/definition is created inside render,
  // causing React to remount the input on each state update.
  RETURN inputParentRemountsOnRender(X.inputComponent) = true
END FUNCTION
```
```pascal
// Property: Fix Checking - Focus Retention
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleKeystroke'(X)
  ASSERT activeElement(result) = X.inputElement AND caretPosition(result) = expected(X)
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleKeystroke(X) = handleKeystroke'(X)
END FOR
```

### CC-2 — No viewport zoom on submit

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SubmitOrFocusEvent
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND (inputFontSizePx(X.field) < 16 OR triggersProgrammaticZoom(X))
END FUNCTION
```
```pascal
// Property: Fix Checking - No Auto Zoom
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleFocusOrSubmit'(X)
  ASSERT viewportScale(result) = 1.0
END FOR
```

### CC-3 — No scroll chaining behind modals

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ScrollEvent
  OUTPUT: boolean
  RETURN modalOpen(X) AND scrollReachesBound(X.modal) AND bodyScrollLocked(X) = false
END FUNCTION
```
```pascal
// Property: Fix Checking - No Scroll Chaining
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleScroll'(X)
  ASSERT backgroundScrollOffset(result) = backgroundScrollOffset(before(X))
END FOR
```

### CC-4 — Toast above modal

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ToastEvent
  OUTPUT: boolean
  RETURN modalOpen(X) AND zIndex(X.toast) <= zIndex(X.modal)
END FUNCTION
```
```pascal
// Property: Fix Checking - Toast Above Modal
FOR ALL X WHERE isBugCondition(X) DO
  result ← renderToast'(X)
  ASSERT zIndex(result.toast) > zIndex(X.modal) AND visible(result.toast) = true
END FOR
```

### Venues — mobile scroll (5.9 / 4.9) and undefined `booker` (7.7 / 8.7)

```pascal
FUNCTION isBugCondition_mobileScroll(X)
  INPUT: X of type PageScrollEvent
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND pageContentExceedsViewport(X) AND verticalScrollBlocked(X) = true
END FUNCTION

FUNCTION isBugCondition_booker(X)
  INPUT: X of type BookingFlowExecution
  OUTPUT: boolean
  RETURN referencesUndefinedSymbol(X, "booker") = true
END FUNCTION
```
```pascal
// Property: Fix Checking - Mobile Scroll Restored
FOR ALL X WHERE isBugCondition_mobileScroll(X) DO
  ASSERT canScrollVertically(handlePageScroll'(X)) = true
END FOR

// Property: Fix Checking - No ReferenceError
FOR ALL X WHERE isBugCondition_booker(X) DO
  ASSERT NOT threwReferenceError(runBookingFlow'(X))
END FOR

// Property: Fix Checking - Filter Single API Call (8.1)
FOR ALL X WHERE clicksInsideFilter(X) AND NOT clickedShowResults(X) DO
  ASSERT apiCallCount(runFilter'(X)) = 0
END FOR
FOR ALL X WHERE clickedShowResults(X) DO
  ASSERT apiCallCount(runFilter'(X)) = 1
END FOR
```

### Venues — bottom nav vs on-screen keyboard (7.13 / 8.13)

```pascal
FUNCTION isBugCondition_navKeyboard(X)
  INPUT: X of type KeyboardOpenEvent
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND onScreenKeyboardOpen(X) AND bottomNavAboveKeyboard(X) = true
END FUNCTION
```
```pascal
// Property: Fix Checking - Bottom Nav Not Above Keyboard
FOR ALL X WHERE isBugCondition_navKeyboard(X) DO
  result ← handleKeyboardOpen'(X)
  ASSERT pinnedToVisualViewportBottom(result.bottomNav) = true OR hidden(result.bottomNav) = true
END FOR
```

### Admin auth — sign-in centering (28.1 / 29.1)

```pascal
FUNCTION isBugCondition_login(X)
  INPUT: X of type AdminSignInRender
  OUTPUT: boolean
  RETURN NOT (horizontallyCentered(X.loginCard) AND verticallyCentered(X.loginCard))
END FUNCTION
```
```pascal
// Property: Fix Checking - Centered Login Card
FOR ALL X WHERE isBugCondition_login(X) DO
  result ← renderAdminSignIn'(X)
  ASSERT horizontallyCentered(result.loginCard) = true AND verticallyCentered(result.loginCard) = true
END FOR
```

### Events — quantity cap (10.2 / 11.2) and discount date bounds (10.14 / 11.14)

```pascal
FUNCTION isBugCondition_qty(X)
  INPUT: X of type QuantityIncrementEvent
  OUTPUT: boolean
  RETURN X.currentQty >= X.availableSlots
END FUNCTION
```
```pascal
// Property: Fix Checking - Quantity Cap
FOR ALL X WHERE isBugCondition_qty(X) DO
  result ← incrementQuantity'(X)
  ASSERT result.qty = X.availableSlots AND limitReachedShown(result) = true
END FOR

// Property: Fix Checking - Discount Date Bounds
FOR ALL X WHERE X.validFrom < X.eventStart OR X.validUntil > X.eventEnd DO
  ASSERT rejected(saveDiscount'(X)) = true
END FOR
```

### Dashboard — bookings render (16.1 / 17.1) and distinct payments tabs (16.2 / 17.2)

```pascal
FUNCTION isBugCondition_bookings(X)
  INPUT: X of type MyBookingsOpenEvent
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND rendersOnlyAfterScroll(X.bookingsList) = true
END FUNCTION
```
```pascal
// Property: Fix Checking - Immediate Render
FOR ALL X WHERE isBugCondition_bookings(X) DO
  result ← openMyBookings'(X)
  ASSERT bookingsVisible(result) = true AND requiredScroll(result) = false
END FOR

// Property: Fix Checking - Distinct Payments Tabs
FOR ALL X WHERE hasPaymentsData(X) DO
  ASSERT transactionsView'(X) = paidByUser(X)
  ASSERT earningsView'(X) = owedToUser(X)
END FOR
```

### Venue owner — maps link validation (19.2 / 20.2)

```pascal
FUNCTION isBugCondition_link(X)
  INPUT: X of type SaveLocationLinkEvent
  OUTPUT: boolean
  RETURN NOT isValidUrl(X.link)
END FUNCTION
```
```pascal
// Property: Fix Checking - Link Validation
FOR ALL X WHERE isBugCondition_link(X) DO
  result ← saveLocationLink'(X)
  ASSERT rejected(result) = true AND inlineErrorShown(result) = true
END FOR
```

### Chat & enquiry integration (22.1 / 23.1)

```pascal
FUNCTION isBugCondition_chat(X)
  INPUT: X of type InquiryContext
  OUTPUT: boolean
  RETURN inquiryExists(X) AND chatIntegrationAvailable(X) = false
END FUNCTION
```
```pascal
// Property: Fix Checking - Chat Integrated With Inquiry
FOR ALL X WHERE isBugCondition_chat(X) DO
  result ← openInquiry'(X)
  ASSERT canConverse(result.sender, result.owner) = true
  ASSERT boundTo(result.conversation, X.inquiry) = true
END FOR
```

### Venues filter vs bottom bar (31.1 / 32.1)

```pascal
FUNCTION isBugCondition_filterNav(X)
  INPUT: X of type VenuesFilterOpenEvent
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND filterOpen(X) AND bottomNavOverlapsFilter(X) = true
END FUNCTION
```
```pascal
// Property: Fix Checking - Filter Clear Of Bottom Nav
FOR ALL X WHERE isBugCondition_filterNav(X) DO
  result ← openVenuesFilter'(X)
  ASSERT (aboveBottomNav(result.filter) OR bottomNavHidden(result)) = true
  ASSERT reachable(result.filter.applyControl) = true
END FOR
```

### Events create mobile overflow (34.1 / 35.1)

```pascal
FUNCTION isBugCondition_createOverflow(X)
  INPUT: X of type CreateUiRender
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND contentWidth(X.createUi) > viewportWidth(X)
END FUNCTION
```
```pascal
// Property: Fix Checking - No Horizontal Overflow
FOR ALL X WHERE isBugCondition_createOverflow(X) DO
  result ← renderCreateUi'(X)
  ASSERT contentWidth(result.createUi) <= viewportWidth(X)
END FOR
```

### Cross-platform scroll reliability (37.1 / 38.1)

```pascal
FUNCTION isBugCondition_scroll(X)
  INPUT: X of type ScrollAttempt
  OUTPUT: boolean
  // X.platform in {android, ios, macos}; app in {client, admin}
  RETURN scrollContentExceedsViewport(X) AND scrollTrappedByHeightOrOverflowLock(X) = true
END FUNCTION
```
```pascal
// Property: Fix Checking - Reliable Scrolling
FOR ALL X WHERE isBugCondition_scroll(X) DO
  ASSERT canScrollVertically(handleScroll'(X)) = true
END FOR
```

### Preservation Goal (all fixes)

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

For every non-buggy input, the fixed code SHALL behave identically to the original.
