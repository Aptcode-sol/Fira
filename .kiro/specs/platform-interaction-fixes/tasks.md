# Implementation Plan

## Overview

Coding-only, incremental plan for the QA-pass interaction/behavior/UX fixes. Grounded in the real client files cited in `design.md`. Per `ponytail.md`: three of four cross-cutting bugs are already fixed — those tasks **verify/extend/lint**, they do not rebuild. Chat is **built but disabled** — that task **re-enables**, it does not rebuild. Reuse existing `Modal`, `Toast`, `Select`, `Input`, `messagesApi`.

Property-based test tasks are marked `*` (optional) and use the client's existing **vitest + React Testing Library + fast-check** stack. Interaction/example tests (focus retention, scroll-lock, toast z-order, chat-bound-to-inquiry) are non-optional because they are the primary verification for those fixes.

## Tasks

### Wave 0 — Diagnostics / Discovery (find every offender once)

- [x] 0. Enumerate cross-cutting offenders so each fix is applied once, not per page
  - **GOAL**: Produce the authoritative offender lists that Waves 2–3 consume. No behavior change in this task — discovery only.
  - **CC-1 focus-loss offenders**: `grep_search` across `client/src/app/**` and `client/src/components/**` for `const [A-Z][A-Za-z]* = \(` and `function [A-Z]` that return JSX and are nested inside another component body; cross-check with `onChange=\{.*set` in the same files. Confirm the known offenders: `client/src/app/venues/[id]/page.tsx` (booking Purpose/Expected-Guests fields ~L948–962), `client/src/components/InquiryForm.tsx`, `client/src/components/modals/CreatePostModal.tsx`. Record file + line for each hit.
  - **CC-3 scroll-lock offenders**: `grep_search` for `document.body.style.overflow` (ad-hoc body locks) and for `fixed inset-0` overlays. Flag any fixed overlay whose scroll region lacks `overscroll-contain` and does not use the shared `<Modal>`. Record the stragglers to migrate.
  - **CC-2 confirmation**: `grep_search` for inline `style={{ fontSize` and `text-xs`/`text-sm` on editable controls to confirm the global `globals.css` coarse-pointer 16px rule is the only lever; flag any inline override that bypasses it.
  - **CC-4 audit**: `grep_search` z-index tokens (`z-50`, `z-\[60\]`, `z-\[70\]`, `z-\[100\]`) to confirm the toast layer is the single change needed.
  - **8.7 `booker`**: `grep_search` for `booker` across the booking flow to locate the undefined-symbol reference.
  - **Scroll-trap offenders (38.1, feeds task 20)**: `grep_search` across `client/src/**` and `admin/src/**` for `overflow:\s*hidden` / `overflow-hidden`, `100vh`, `h-screen` / `min-h-screen`, and `document.body.style.overflow`. Flag height/overflow traps on ordinary (non-modal) scroll containers and any ad-hoc body scroll lock left applied outside the shared `<Modal>`. Record file:line for task 20.
  - Output: a short offender list (file:line) captured in the task notes, feeding Waves 2–3.
  - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.3, 1.4, 1.7, 8.7, 38.1_
  - **FINDINGS (discovery complete — NO code changed). Full report: `wave0-offenders.md`.**
    - **CC-1 (focus loss):** NO nested-component offenders found anywhere. `InquiryForm.tsx` (uses top-level `Input`, inputs L98/108/118/129), `venues/[id]/page.tsx` booking fields (inline JSX L906–966, incl. Guests L955 / Purpose L966), `CreatePostModal.tsx` (textarea L129) are all inline JSX — **not** per-render sub-components. No `Math.random`/`Date.now` keys. → Task 4: re-run exploration test first; focus loss likely does NOT reproduce as specified. If it does, root cause is elsewhere (parent `key` churn / memo), not nesting — do not hoist.
    - **CC-2 (mobile zoom):** Single lever confirmed = `globals.css` L56–62 coarse-pointer 16px rule (+ `text-size-adjust` L52–55). Viewport meta `layout.tsx` L106–111 allows pinch-zoom (no `maximum-scale`). Zero inline `fontSize` bypasses, zero `contentEditable`. → Task 6: no per-page diff; add `ponytail:` comment only.
    - **CC-3 (scroll lock):** Body lock owner = `Modal.tsx` L69/82 (only writer). Overscroll-chaining ALREADY globally contained for all `.fixed.inset-0` via `globals.css` L420–434. Hand-rolled overlays lacking body-lock (get overscroll from globals but not body-lock): `dashboard/venues/page.tsx` L589/844/1056, `dashboard/venues/[id]/page.tsx` L580, `dashboard/tickets/page.tsx` L281, `dashboard/requests/page.tsx` L491, `dashboard/page.tsx` L482, `dashboard/creator/page.tsx` L785, `dashboard/brand/page.tsx` L753, `CreatePostModal.tsx` L82, admin `Events.jsx` L485. → Task 5: migrate these to `<Modal>` for body-lock; don't touch globals.css/Modal contract.
    - **CC-4 (toast z-order):** Single change = `Toast.tsx` L64 `z-50` → `z-[100]`. Layer stack: Navbar `z-50` / drawer `z-[60]` / Modal `z-[70]` / FilterPanel `z-[80]` / Select listbox `z-[100]`. → Task 3.1 as written.
    - **8.7 (`booker`):** NOT REPRODUCIBLE. `\bbooker\b` = 0 hits in client/admin. Server `booker` (bookingService.js L86, emailService.js L275) is properly declared, out of scope. `submitBooking` (venues/[id]/page.tsx L210–300) uses `user`, guarded by `if (!venue || !user) return` L211. → Task 1 exploration test will PASS unexpectedly; flag via unexpected_pass path. Task 8.2: nothing to fix.
    - **Scroll-traps (38.1):** No live ordinary-page trap found. All `100vh`/`min-h-screen`/`overflow-hidden` hits are decorative beams, card clipping, or growing section wrappers (benign). No orphaned body-lock. Watch items: `inbox/page.tsx` L525 (confirm bounded-height chat scroll on mobile); `messages/page.tsx` L208–333 is fully commented dead code (use `dvh` if re-enabled). → Task 20.1: mostly confirmation, prefer natural scroll.
    - **32.1 (filter vs nav, ref only):** `FilterPanel.tsx` L268 mobile overlay already `z-[80]` (above nav). Likely offender is `LocationFilter.tsx` (hand-rolled dropdown, no z-[80]/nav padding) — Task 8.8 to confirm which the venues page uses.

---

### Wave 1 — Exploration + Preservation tests (BEFORE any fix)

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** — Cross-cutting interaction defects (focus loss, toast z-order, booker, filter calls, quantity cap)
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists. **DO NOT fix the code when they fail.**
  - **NOTE**: These tests encode the expected behavior; they validate the fix when they pass after implementation.
  - **GOAL**: Surface counterexamples that demonstrate each bug.
  - **Scoped approach** (deterministic bugs → concrete failing cases):
    - CC-1 focus (`client/src/components/InquiryForm.tsx`, `venues/[id]/page.tsx` booking fields, `CreatePostModal.tsx`): `userEvent.type(input, "party")`; assert `input.value === "party"` AND `document.activeElement === input`. Unfixed remounting drops focus after 1 char.
    - CC-4 toast z-order (`ui/Toast.tsx` vs `ui/Modal.tsx`): assert toast container z-index > modal overlay z-index. Unfixed: `z-50` ≤ `z-[70]`.
    - 8.7 booker (`venues/[id]/page.tsx` booking submit): render booking flow, submit; assert no `ReferenceError` thrown.
    - 8.1 filter (`venues/page.tsx`, mock `venuesApi.getAll`): click filter options N times without "Show Results"; assert `getAll` not called.
    - 11.2 quantity (`TicketDisplay.tsx`/events booking): click "+" past `availableSlots`; assert value exceeds available.
  - Run on UNFIXED code. **EXPECTED OUTCOME: Tests FAIL** (proves the bugs exist). Document each counterexample.
  - _Requirements: 1.1, 1.2, 1.7, 8.7, 8.1, 11.2_

- [x] 2. Write preservation tests (BEFORE implementing fixes)
  - **Property 2: Preservation** — Non-buggy inputs unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code, then lock it in.
  - Observe & assert:
    - Typing into an already-correct input records all characters (CC-1 preservation, 3.1/3.2).
    - With no modal open, `document.body` stays scrollable; a toast keeps its normal bottom-right z-order (CC-3/CC-4 preservation, 3.5/3.7).
    - Below-max "+" still increments (12.1); in-window discount dates (12.7), valid phone digits (9.6), valid URLs (21.2) still accepted — negative branch of P8/P10/P7/P11.
    - "Show Results" still returns filtered venues (9.1); desktop (fine-pointer) inputs keep existing sub-16px type (P5/P2 preservation).
  - Use fast-check where a clean invariant exists (quantity, dates, phone, filter, guests, maps link) to assert the non-buggy branch is unchanged across the domain.
  - Run on UNFIXED code. **EXPECTED OUTCOME: Tests PASS** (baseline to preserve).
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 15.1, 15.2, 15.3, 18.1, 18.2, 18.3, 18.4, 18.5, 21.1, 21.2, 21.3, 24.1, 24.2_

---

### Wave 2 — Cross-cutting primitives (fix once, apply everywhere)

- [x] 3. Cross-cutting: toast above modal (CC-4)

  - [x] 3.1 Raise the toast layer above the modal layer
    - Single change in `client/src/components/ui/Toast.tsx`: raise `ToastContainer` from `z-50` to `z-[100]` (above Navbar `z-50`/drawer `z-[60]`/Modal `z-[70]`).
    - Add a `ponytail:` comment: single global layer order is the ceiling; revisit if nested portals with higher z appear.
    - _Bug_Condition: isBugCondition(X) = modalOpen(X) AND zIndex(toast) <= zIndex(modal)_
    - _Expected_Behavior: zIndex(toast) > zIndex(modal) AND visible(toast)_
    - _Preservation: toast with no modal keeps normal bottom-right position + z-order (3.7)_
    - _Requirements: 2.7_

  - [x] 3.2 Verify CC-4 exploration test now passes
    - **Property 4: Toast above modal** — re-run the SAME toast z-order test from task 1 (do NOT write a new test).
    - **EXPECTED OUTCOME**: toast z-index strictly > modal overlay z-index; toast visible.
    - _Requirements: 2.7_

- [x] 4. Cross-cutting: focus retention (CC-1)

  - [x] 4.1 Hoist per-render component/element definitions to module scope
    - Using the Wave 0 offender list, for each offender move the component/element definition out of the parent render body to module scope; keep controlled `value`/`onChange`; use stable keys.
    - `client/src/components/InquiryForm.tsx` — verify it uses the top-level `Input` with no inline redefinition.
    - `client/src/app/venues/[id]/page.tsx` — extract any per-render booking-modal sub-component (Purpose/Expected-Guests ~L948–962) to module scope.
    - `client/src/components/modals/CreatePostModal.tsx` — same check for the create-post input.
    - No new abstraction; hoist only.
    - _Bug_Condition: isBugCondition(X) = inputParentRemountsOnRender(X.inputComponent) = true_
    - _Expected_Behavior: activeElement(result) = inputElement AND value == full typed string in one focus session_
    - _Preservation: already-focus-stable inputs unchanged (3.1, 3.2)_
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Verify CC-1 exploration test now passes
    - **Property 1: Expected Behavior** — re-run the SAME focus-retention tests from task 1 (do NOT write new tests).
    - **EXPECTED OUTCOME**: `input.value === "party"` and `document.activeElement === input` after typing.
    - _Requirements: 2.1, 2.2_

- [x] 5. Cross-cutting: scroll-chaining (CC-3) — migrate stragglers to the shared contract

  - [x] 5.1 Migrate hand-rolled overlays to shared `<Modal>` or the overlay class contract
    - CC-3 is ALREADY fixed in `client/src/components/ui/Modal.tsx` (`body overflow: hidden` + `overscroll-contain`) and `globals.css`. Do NOT rebuild.
    - For each Wave 0 straggler: migrate to the shared `<Modal>` where practical; where not, ensure the overlay root uses `className="fixed inset-0 ..."` and its scroll region uses `overflow-y-auto overscroll-contain` so the existing `globals.css` contract covers it. Remove ad-hoc `document.body.style.overflow` locks in favor of `<Modal>`.
    - _Bug_Condition: isBugCondition(X) = modalOpen(X) AND scrollReachesBound(X.modal) AND bodyScrollLocked(X) = false_
    - _Expected_Behavior: body scroll locked while open; background offset unchanged; restored on close_
    - _Preservation: no-modal scrolling normal; close restores scroll position (3.5, 3.6)_
    - _Requirements: 2.5, 2.6_

- [x] 6. Cross-cutting: mobile zoom (CC-2) — verify coverage + add regression guard

  - [x] 6.1 Confirm global 16px rule covers all editable controls and guard it
    - CC-2 is ALREADY fixed in `client/src/app/globals.css` (coarse-pointer `@media` forcing `font-size: 16px` on `input`/`select`/`textarea` + `text-size-adjust`). Do NOT rebuild.
    - (a) Confirm the rule covers all editable controls (including any `contenteditable`); (b) confirm the viewport meta in `client/src/app/layout.tsx` does not set `maximum-scale`/`user-scalable=no` (must still allow pinch-zoom per 3.3); (c) add a `ponytail:` comment marking the global rule as the single CC-2 source so no per-page override reintroduces sub-16px fonts.
    - Only add a per-page diff if Wave 0 flagged a control bypassing the rule.
    - _Bug_Condition: isBugCondition(X) = isMobileViewport(X) AND inputFontSizePx(X.field) < 16_
    - _Expected_Behavior: computed font-size >= 16px on coarse pointer; viewport scale stays 1.0_
    - _Preservation: user pinch-zoom still allowed (3.3); fine-pointer inputs keep existing type_
    - _Requirements: 2.3, 2.4_

  - [ ]* 6.2 Property test: mobile font-size >= 16px (CC-2)
    - **Property 2: CC-2 No mobile auto-zoom** — for any editable control on a coarse-pointer viewport, computed `font-size` >= 16px; fine-pointer inputs unaffected (preservation).
    - _Requirements: 2.3, 2.4_

- [x] 20. Cross-cutting: cross-platform scroll reliability (38.1) — audit + remove scroll traps

  - [x] 20.1 Audit-and-remove pass over scroll containers in `client/src` and `admin/src`
    - **Diagnostic grep** (feeds the removal list): `grep_search` for `overflow:\s*hidden` / `overflow-hidden`, `100vh`, `h-screen` / `min-h-screen`, and `document.body.style.overflow` across `client/src/**` and `admin/src/**`. Record each hit as file:line.
    - Remove height/overflow traps on ordinary (non-modal) scroll containers: drop `overflow: hidden` wrappers and `100vh`/`h-screen` height traps that block natural scroll; prefer natural document scroll and use `dvh` instead of `100vh`/`vh` where a viewport-height element is genuinely needed.
    - Ensure a body scroll lock is applied **only** by the shared `<Modal>` and is always released on close — remove any ad-hoc `document.body.style.overflow` lock that persists outside `<Modal>`.
    - **Distinct from CC-3 (task 5)**, which *intentionally* locks body scroll while a modal is open; this task targets locks/traps on ordinary pages. **Broader than home 5.9** (task 7), which only removes the home-route mobile trap.
    - `ponytail:` reuse the shared `<Modal>` as the single owner of body scroll lock; no new scroll primitive.
    - _Bug_Condition: isBugCondition(X) = scrollContentExceedsViewport(X) AND scrollTrappedByHeightOrOverflowLock(X) = true_
    - _Expected_Behavior: scroll container is vertically scrollable (`canScrollVertically == true`) with no height/overflow trap (design Property 19)_
    - _Preservation: any platform/page that already scrolls correctly continues to scroll as today; the shared `<Modal>` lock/release is not regressed (39.1)_
    - _Requirements: 38.1_

  - [ ]* 20.2 Interaction test: trapped page scrolls after trap removed (P19)
    - **Property 19: Cross-platform scroll reliability** — render a page whose content exceeds the viewport; assert it can scroll vertically after the trap is removed. Confirm the shared `<Modal>` still locks body scroll while open and releases on close (preservation, 39.1).
    - _Requirements: 38.1_

---

### Wave 3 — Per-page fixes

- [x] 7. Home page fixes (`Navbar.tsx`, `HomeClient.tsx`, `page.tsx`)
  - 5.1 Remove `{ href: '/', label: 'Home' }` from desktop `navLinks` (logo is sole home link); keep mobile bottom-nav Home tab.
  - 5.2 One consistent small underscore indicator size for the active link; keep single `layoutId="navbar-indicator"`.
  - 5.3 Render the logo `<img>` unconditionally (outside any `pathname`-gated branch); only the dot under it is conditional.
  - 5.4 Wire "View Parties" → `router.push('/events')`.
  - 5.5 Gate the HomeClient "Join Now" CTA on `!isAuthenticated` (hide when authed).
  - 5.6 Delete the "Learn more" CTAs in HomeClient.
  - 5.7 Add leading inset (`pl-4`/`ps-4`) to horizontal-scroll rows so the first item is not flush.
  - 5.8 Move notifications to a top-level route `client/src/app/notifications/page.tsx` (out of `dashboard/notifications`); fix active-highlight to the notifications item; update Navbar bell link → `/notifications`.
  - 5.9 Remove the mobile fixed/overflow trap on the home route so vertical scroll is restored (coordinate with ui-ux-responsive-validation).
  - _Preservation: logo click navigates home (6.1); non-active tabs no indicator (6.2); logged-out sees join CTA (6.3); horizontal rows still scroll (6.4); dashboard nav highlights on dashboard (6.5); desktop scroll unchanged (6.6)_
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 8. Venues page fixes (`venues/page.tsx`, `venues/[id]/page.tsx`, `VenueCard.tsx`, `LocationFilter.tsx`, `InquiryForm.tsx`, `Navbar.tsx`)

  - [x] 8.1 Filter draft state + single API call (8.1) and applied-count badge (8.2)
    - Introduce local draft-filter state in `venues/page.tsx`; filter controls (incl. `LocationFilter`) update draft only; the list API call fires only in the "Show Results" submit handler.
    - Remove external selected-item chips; show the filter control with a badge counting applied filters.
    - _Bug_Condition: clicksInsideFilter(X) AND NOT clickedShowResults(X)_
    - _Expected_Behavior: apiCallCount == showResultsClicks (0 while selecting, 1 per submit)_
    - _Preservation: "Show Results" returns filtered venues (9.1); no filters => no badge (9.2)_
    - _Requirements: 8.1, 8.2_

  - [x] 8.2 Fix undefined `booker` ReferenceError (8.7)
    - Using the Wave 0 grep hit, replace the undefined `booker` reference in the booking submit path with the correct in-scope variable (e.g. `user`/`booking.user`).
    - _Bug_Condition: referencesUndefinedSymbol(X, "booker") = true_
    - _Expected_Behavior: no ReferenceError thrown in booking flow_
    - _Preservation: valid bookings still submit (9.4)_
    - _Requirements: 8.7_

  - [x] 8.3 Booking modal behavior: errors in-modal (8.4), calendar-after-proceed (8.8), guest capacity (8.6), two-month bound (8.11), mobile image crop (8.12), navbar lamp (8.3)
    - 8.4 Render validation errors inside the modal body (reuse `Input` `error` prop + existing `errors` state), never on the page layer behind the overlay.
    - 8.8 Move the availability calendar into the booking popup, shown after "proceed" (currently renders on the page ~L539 ahead of booking).
    - 8.6 Validate `guests` against `venue.capacity.min/max`; inline error + block submit when out of range.
    - 8.11 Bound calendar navigation to two months to match the "next 2 months" copy (~L543).
    - 8.12 Apply a consistent landscape aspect-ratio/`object-cover` crop on mobile venue images.
    - 8.3 Disable the navbar `layoutId="navbar-indicator"` bottom-up entry spring on navigation.
    - _Preservation: valid guest counts accepted (9.5); desktop venue crop unchanged (9.7); active-route indication unchanged (9.3)_
    - _Requirements: 8.3, 8.4, 8.6, 8.8, 8.11, 8.12_

  - [x] 8.4 Ask Enquiry phone digits-only (8.10)
    - In `InquiryForm.tsx`, sanitize the phone field `onChange` with `value.replace(/\D/g, '')`.
    - _Bug_Condition: phone field accepts non-digit characters_
    - _Expected_Behavior: stored value is digits-only; all-digit input preserved_
    - _Preservation: valid phone digits still accepted (9.6)_
    - _Requirements: 8.10_

  - [x] 8.6 Bottom-nav vs on-screen keyboard (8.13)
    - Make the fixed bottom nav (reuse existing `Navbar.tsx` — no new component) track the visual viewport so it does not ride above the on-screen keyboard on mobile. Use the VisualViewport API (`window.visualViewport` `resize`/`scroll` → offset the nav by `window.innerHeight - visualViewport.height`), OR pin with `dvh`, OR hide the nav while an input is focused / keyboard is open. `ponytail:` prefer the smallest working option; VisualViewport offset has the ceiling that a browser lacking the API falls back to today's pinned behavior.
    - _Bug_Condition: isBugCondition(X) = isMobileViewport(X) AND keyboardOpen(X) AND bottomNavPinnedToLayoutViewport(X) = true_
    - _Expected_Behavior: bottom-nav top edge <= visualViewport height OR nav hidden while keyboard open (design Property 14)_
    - _Preservation: no keyboard open => bottom nav stays pinned at the viewport bottom as today (9.8)_
    - _Requirements: 8.13_

  - [x] 8.8 Filter overlay clear of bottom nav on mobile (32.1)
    - Render the venues filter overlay (`LocationFilter.tsx` / the filter modal in `client/src/app/venues`) fully above/clear of the fixed bottom nav (`Navbar.tsx`) on mobile so the Apply / Show Results control is reachable. Raise the filter's layer above the nav **and/or** add bottom padding = nav height + `env(safe-area-inset-bottom)`, OR hide the nav while the filter is open. Reuse the shared `<Modal>` overlay pattern where practical (`<Modal>` already sits at `z-[70]`, above the nav's `z-50`/`z-[60]`). `ponytail:` prefer the smallest working option; the ceiling of the padding approach is a nav-height assumption — the layer/hide approach avoids it.
    - _Bug_Condition: isBugCondition(X) = isMobileViewport(X) AND filterOpen(X) AND bottomNavOverlapsFilter(X) = true_
    - _Expected_Behavior: filter rendered fully above/clear of the bottom nav; Apply / Show Results control reachable (design Property 17)_
    - _Preservation: desktop venues filter renders as today with no bottom-nav overlap (33.1)_
    - _Requirements: 32.1_

  - [ ]* 8.7 Interaction test: bottom-nav tracks visual viewport (P14)
    - **Property 14: Venues bottom-nav vs keyboard** — shrink `window.visualViewport.height`, fire `resize`; assert the nav's top edge <= visual-viewport height OR the nav is hidden. Restore height → assert the nav is pinned at the bottom again (preservation, 9.8).
    - _Requirements: 8.13_

  - [ ]* 8.9 Interaction test: filter apply control clear of bottom nav (P17)
    - **Property 17: Venues filter clear of bottom nav** — open the filter on a mobile viewport; assert the Apply / Show Results control is not covered by the fixed nav (nav layered below the filter, or nav hidden while open). Verify desktop filter unchanged (preservation, 33.1).
    - _Requirements: 32.1_

  - [ ]* 8.5 Property tests: filter single-call (P5), guest capacity (P6), phone digits-only (P7)
    - **Property 5: Filter single API call** — for any interaction sequence, `apiCalls == showResultsClicks`.
    - **Property 6: Guest capacity** — for any `(min, max, guests)`, accepted iff `min <= guests <= max`.
    - **Property 7: Phone digits-only** — for any string, output is digits-only and all-digit inputs are unchanged.
    - _Requirements: 8.1, 8.6, 8.10_

- [x] 9. Events page fixes (`events/**`, `EventCard.tsx`, `PostCard.tsx`, `TicketDisplay.tsx`, event-management components, `CreatePostModal.tsx`)

  - [x] 9.1 Quantity cap (11.2), wheel-disable (11.4), tier tick (11.3), tier list (11.8), image sizing (11.5)
    - 11.2 Clamp the "+" handler at `availableSlots`; disable "+" at max; show inline "limit reached".
    - 11.4 Add `onWheel={(e) => e.currentTarget.blur()}` to number inputs (max-tickets etc.) so scroll does not mutate the value.
    - 11.3 Fix the family/friends tier tick (mismatched key/index comparison in the tier list).
    - 11.8 Render the available ticket tiers in the booking UI.
    - 11.5 Size the manage-event image to match the events-listing card.
    - _Bug_Condition (11.2): X.currentQty >= X.availableSlots_
    - _Expected_Behavior: qty == availableSlots AND limitReachedShown_
    - _Preservation: below-max "+" still increments (12.1); non-F&F ticks render (12.2); typed number values accepted (12.3)_
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.8_

  - [x] 9.2 Revenue + lowest-tier display (11.6, 11.7)
    - 11.6 Compute revenue = `Σ(ticketsBooked × price)`; render `₹0` when none (never "free").
    - 11.7 Display `from ₹{min(tier.price)} onwards` in event info.
    - _Preservation: non-zero revenue still computes correctly (12.4)_
    - _Requirements: 11.6, 11.7_

  - [x] 9.3 Post edit image actions (11.10) + in-app delete confirm (11.11)
    - 11.10 Wire the image add/remove/replace actions in the post edit flow (currently text-only).
    - 11.11 Replace native `confirm()` for delete-post with the shared `<Modal>` confirmation (reuse `CancellationModal.tsx` pattern).
    - _Preservation: edited post text still saves (12.5)_
    - _Requirements: 11.10, 11.11_

  - [x] 9.4 Reusable stepper modal for event/venue create + edit (11.12, 11.13)
    - Build one reusable multi-step (stepper) modal on top of the shared `<Modal>`; use it for event creation, event edit, and venue creation (replaces bottom-anchored non-reusable form).
    - _Preservation: created events/venues still persist all fields (12.6)_
    - _Requirements: 11.12, 11.13_

  - [x] 9.7 Event-create UI no mobile horizontal overflow (35.1)
    - Constrain the event-creation UI (`client/src/app/create` and its create-form components) to the standard responsive container: `w-full` + a `max-w-*`, no fixed `px` widths wider than the viewport, proper horizontal padding. Deliver together with the stepper modal from 9.4 — the new stepper modal (built on the shared `<Modal>`) should be responsive by construction, so making the create UI responsive is part of that same modal treatment rather than patching fixed widths field by field. `ponytail:` reuse the shared `<Modal>` responsive container; no per-field width patches.
    - _Bug_Condition: isBugCondition(X) = isMobileViewport(X) AND contentWidth(X.createUi) > viewportWidth(X)_
    - _Expected_Behavior: create UI content width stays within the viewport width (`contentWidth <= viewportWidth`) using the standard responsive container (design Property 18)_
    - _Preservation: desktop event-creation UI renders within its container as today (36.1)_
    - _Requirements: 35.1_

  - [ ]* 9.8 Example test: create UI content width <= viewport (P18)
    - **Property 18: Events create UI no horizontal overflow** — render the event-creation UI on a mobile viewport; assert `contentWidth <= viewportWidth` (no horizontal overflow). Verify desktop create UI unchanged (preservation, 36.1).
    - _Requirements: 35.1_

  - [x] 9.5 Discount date bounds (client) (11.14) + event-creation entry points (11.15, 11.16)
    - 11.14 Validate `validFrom >= eventStart && validUntil <= eventEnd`; reject out-of-window with inline error (server enforcement lives in platform-flow-fixes).
    - 11.15 Surface per-tier gate/scanner allocation UI at event-creation time (feature owned by platform-feature-overhaul; this wires the runtime UI).
    - 11.16 Surface discount-code setup within the event-creation stepper (CRUD owned by platform-feature-overhaul; this wires the entry point).
    - _Bug_Condition (11.14): X.validFrom < eventStart OR X.validUntil > eventEnd_
    - _Expected_Behavior: rejected(saveDiscount') = true with inline error_
    - _Preservation: in-window discount dates still accepted (12.7)_
    - _Requirements: 11.14, 11.15, 11.16_

  - [ ]* 9.6 Property tests: quantity cap (P8), revenue/lowest-tier (P9), discount date-bounds (P10)
    - **Property 8: Quantity cap** — for any `(available, clicks)`, resulting qty <= available; "+" disabled at max.
    - **Property 9: Revenue / lowest-tier** — for any tiers, revenue == Σ(booked×price), ₹0 when none, display "from ₹min onwards".
    - **Property 10: Discount date bounds** — for any `(eventStart, eventEnd, validFrom, validUntil)`, rejected iff out of window.
    - _Requirements: 11.2, 11.6, 11.7, 11.14_

- [x] 10. Creators page fixes (`creators/**`, `brands/**`, `BrandHeader.tsx`)
  - 13.1/14.1 Remove the redundant "Get in Touch" block; keep the socials block.
  - 13.2/14.2 Fix mobile flush-right layout to match desktop left-aligned layout.
  - 13.3/14.3 Fix content overlap on scroll (positioning/z-index/fixed-element overlap; coordinate with ui-ux-responsive-validation).
  - 13.4/14.4 Zoom-after-apply is already satisfied by CC-2 (Wave 2 task 6) — no per-page diff.
  - _Preservation: socials block still shown/functional (15.1); desktop layout unchanged (15.2); creator apply submit/navigation unchanged (15.3)_
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 11. Dashboard fixes (`dashboard/**`, `components/dashboard/**`, `BillingCard.tsx`)
  - 16.1/17.1 Render "My Bookings" on mount (remove reveal-on-scroll observer gate or set initial visible state true).
  - 16.2/17.2 Wire Transactions vs Earnings to distinct queries — Transactions = money paid by user; Earnings = money owed/settled to them as owner (numbers owned by platform-flow-fixes; this is the display/query wiring).
  - 16.3/17.3 Move Change Password into a proper settings dropdown/section with desktop-suitable layout.
  - 16.4/17.4 Wire Delete Account: in-app confirmation modal → `DELETE /api/users/me` (endpoint in task 13).
  - 16.5/17.5 Add desktop sidebar-content spacing/gap (coordinate with ui-ux-responsive-validation).
  - _Preservation: existing bookings still list (18.1); transactions/earnings compute per platform-flow-fixes (18.2); password change works (18.3); confirmed deletion removes account + data (18.4); mobile dashboard layout unchanged (18.5)_
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 12. Venue owner dashboard fixes (`venue-portal/**`, `components/venue-portal/**`)
  - 19.1/20.1 Style the All/Pending/Approved/Rejected status dropdown by reusing `client/src/components/ui/Select.tsx`.
  - 19.2/20.2 Validate the location/maps link as a valid URL on save; reject invalid input with an inline error (client side; server side in task 13).
  - 19.3/20.3 Fix the venue settings desktop layout (flushed-left → desktop-suitable).
  - _Bug_Condition (20.2): NOT isValidUrl(X.link)_
  - _Expected_Behavior: rejected AND inline error shown_
  - _Preservation: status dropdown still filters (21.1); valid maps links still persist (21.2); mobile settings layout unchanged (21.3)_
  - _Requirements: 20.1, 20.2, 20.3_

  - [ ]* 12.1 Property test: maps-link URL validation (P11)
    - **Property 11: Maps link validation** — for any string, accepted iff valid URL (client validator matches server).
    - _Requirements: 20.2_

- [x] 18. Static / Legal pages: standard container width + shared heading (26.1, 26.2)

  - [x] 18.1 Align the five pages to the standard container and one heading style
    - Five pages: `client/src/app/privacy/page.tsx`, `client/src/app/terms/page.tsx`, `client/src/app/refund-policy/page.tsx`, `client/src/app/help/page.tsx`, `client/src/app/community-guidelines/page.tsx`.
    - Replace each page's narrower `max-w-4xl mx-auto` container with the site-standard `max-w-7xl mx-auto` (matches `HomeClient`/`BrandHeader`/marketing sections — removes the extra blank L/R margins).
    - Apply one shared heading style/token across all five `<h1>`s, replacing the five divergent per-page gradients (privacy `from-violet-400 to-pink-400`, terms `from-blue-400 to-cyan-400`, refund `from-green-400 to-emerald-400`, help `from-cyan-400 to-blue-400`, community-guidelines `from-pink-400 to-rose-400`).
    - `ponytail:` prefer the smallest working move — a single shared class string reused across the five `<h1>`s (or a tiny shared `LegalPageShell` wrapping container + heading). Do NOT add abstractions beyond one shared style contract.
    - _Bug_Condition: isBugCondition(X) = X.route IN {privacy, terms, refund-policy, help, community-guidelines} AND (containerMaxWidth(X) != standardPageMaxWidth OR headingStyle(X) != standardLegalHeadingStyle)_
    - _Expected_Behavior: all five pages use the standard container width AND one shared heading style/token (design Property 13)_
    - _Preservation: legal body copy / legal text byte-for-byte unchanged; only container width + heading styling change (27.1)_
    - _Requirements: 26.1, 26.2_

  - [ ]* 18.2 Example test: standard container + shared heading + unchanged body (P13)
    - **Property 13: Static/Legal pages — standard container and consistent heading** — render each of the five pages; assert the content container uses the site-standard width, the `<h1>` uses the identical shared heading class across all five, and the body copy is unchanged. May be folded into the task 17 checkpoint to stay minimal.
    - _Requirements: 26.1, 26.2, 27.1_

- [x] 19. Admin sign-in centering (29.1) — verify + guard (already has the classes)

  - [x] 19.1 Ensure/verify the login card container centers on both axes
    - In `admin/src/pages/Login.jsx`: design finding notes the `<main>` already wraps the card in `min-h-screen flex items-center justify-center`, so this is verify-and-guard, not a rebuild. Confirm those utilities are present and not overridden by a parent height/overflow constraint or a conditional wrapper across breakpoints; keep both-axis viewport centering.
    - _Bug_Condition: isBugCondition(X) = NOT (fillsViewportHeight(X) AND centeredOnBothAxes(X))_
    - _Expected_Behavior: container fills viewport height AND centers the card on both axes (`min-h-screen` + `flex items-center justify-center`) across all breakpoints (design Property 15)_
    - _Preservation: admin login fields, client-side validation, and submit behavior unchanged (30.1)_
    - _Requirements: 29.1_

  - [ ]* 19.2 Example test: login container centering classes (P15)
    - **Property 15: Admin sign-in centering** — render `Login.jsx`; assert the card's container carries `min-h-screen`, `flex`, `items-center`, and `justify-center` (guards against regression).
    - _Requirements: 29.1_

---

### Wave 4 — Chat & enquiry re-enable (built but disabled — do NOT rebuild)

- [x] 13. Re-enable chat bound to inquiry (`messages/page.tsx`, `inbox/page.tsx`, `InquiryForm.tsx`, server `routes/message.js`, `server/index.js`)

  - [x] 13.1 Client: restore the messages surface and re-enable entry points
    - Restore the commented-out messages thread UI at the bottom of `client/src/app/messages/page.tsx` (follow its documented re-enable checklist).
    - Re-enable the "CHAT DISABLED" entry points: Navbar messages link, `RouteGuard.tsx`, inbox Messages tab, brand/creator Message buttons, `HowItWorks.tsx`.
    - Add an entry point from the inquiry flow (`InquiryForm.tsx` / inquiry detail) that opens a conversation bound to the inquiry's reference. Reuse existing `messagesApi` — no new client API layer.
    - _Bug_Condition: inquiryExists(X) AND chatIntegrationAvailable(X) = false_
    - _Expected_Behavior: canConverse(sender, owner) AND boundTo(conversation, inquiry)_
    - _Preservation: inquiry submission still creates the record (24.1); existing Conversation/Message data preserved/readable (24.2)_
    - _Requirements: 23.1_

  - [x] 13.2 Server: re-mount messages route + one find-or-create inquiry-conversation handler
    - Re-mount `app.use('/api/messages', messageRoutes)` in `server/index.js`.
    - Add/extend ONE handler in `routes/message.js` (`start-inquiry-conversation`, or extend `send`/`start-brand-enquiry`) that finds-or-creates a conversation between the inquiry sender and the reference owner, tied to the inquiry reference. Reuse the existing find-or-create pattern. No new models.
    - _Requirements: 23.1_

- [x] 14. Server endpoint changes: delete-account + maps-link validation

  - [x] 14.1 Delete account endpoint (17.4)
    - Add `DELETE /api/users/me` in `server/routes/user.js` (+ `userService`): requires auth, deletes only the authenticated user and associated data per existing cascade conventions.
    - _Preservation: confirmed deletion removes account + associated data (18.4)_
    - _Requirements: 17.4_

  - [x] 14.2 Maps-link server validation (20.2)
    - In the venue update path (`server/routes/venue.js` / `venueService`), validate the location/maps link with URL validation (reuse `server/middleware/validate.js`); reject invalid links with 400 + message.
    - _Preservation: valid maps links still persist (21.2)_
    - _Requirements: 20.2_

---

### Wave 5 — Verification checkpoints

- [x] 15. Verify exploration tests now pass (bugs fixed)
  - **Property 1: Expected Behavior** — re-run the SAME tests from task 1 (do NOT write new tests).
  - CC-1 focus retained; CC-4 toast above modal; 8.7 no ReferenceError; 8.1 filter single call; 11.2 quantity capped.
  - **EXPECTED OUTCOME**: all pass (confirms bugs resolved).
  - _Requirements: 2.1, 2.2, 2.7, 8.7, 8.1, 11.2_

- [x] 16. Verify preservation tests still pass (no regressions)
  - **Property 2: Preservation** — re-run the SAME tests from task 2 (do NOT write new tests).
  - **EXPECTED OUTCOME**: all pass (no regressions across non-buggy inputs).
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 12.1, 12.7, 9.1, 9.4, 9.5, 9.6, 21.2, 24.1, 24.2_

- [x] 17. Checkpoint — run the full client + server test suites and typecheck
  - Run the client vitest suite (`--run`, single execution) and server vitest suite; run the client build/typecheck.
  - Ensure all tests pass and there are no type errors. Ask the user if questions arise.
  - _Requirements: all_

---

## Notes

- **Already-done work (do not rebuild):** CC-2 (mobile zoom) is fixed in `client/src/app/globals.css`; CC-3 (scroll-chaining) is fixed in `ui/Modal.tsx` + `globals.css`. Chat/enquiry is fully built but disabled. These tasks verify/extend/migrate/re-enable only.
- **Single-line cross-cutting fix:** CC-4 is a single z-index change in `ui/Toast.tsx` (`z-50` → `z-[100]`).
- **Diagnostic-first:** Wave 0 enumerates all CC-1 focus offenders and CC-3 stray overlays so fixes are applied once, not per page.
- **`*` tasks are optional** property-based tests (vitest + RTL + fast-check). Interaction/example tests are non-optional where they are the primary verification.
- **Boundary:** numbers behind Transactions/Earnings (17.2), discount server enforcement (11.14), scanning/discount/inquiry *features* (11.15/11.16/23.1) are owned by other specs; this spec wires only the client interaction surface and the three server touches (delete-account, maps-link validation, re-mount messages + inquiry-conversation handler).

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 0,
      "name": "Diagnostics / Discovery",
      "tasks": ["0"],
      "dependsOn": []
    },
    {
      "wave": 1,
      "name": "Exploration + Preservation tests",
      "tasks": ["1", "2"],
      "dependsOn": ["0"]
    },
    {
      "wave": 2,
      "name": "Cross-cutting primitives",
      "tasks": ["3", "4", "5", "6", "20"],
      "dependsOn": ["1", "2"]
    },
    {
      "wave": 3,
      "name": "Per-page fixes",
      "tasks": ["7", "8", "9", "10", "11", "12", "18", "19"],
      "dependsOn": ["3", "4", "5", "6", "20"]
    },
    {
      "wave": 4,
      "name": "Chat re-enable + server endpoints",
      "tasks": ["13", "14"],
      "dependsOn": ["1", "2"]
    },
    {
      "wave": 5,
      "name": "Verification checkpoints",
      "tasks": ["15", "16", "17"],
      "dependsOn": ["7", "8", "9", "10", "11", "12", "13", "14", "20"]
    }
  ],
  "notes": {
    "10": "Task 10 (Creators 13.4/14.4) has an implicit dependency on task 6 (CC-2) but needs no per-page diff.",
    "11": "Task 11 (Delete Account 17.4) depends on task 14.1 endpoint; wire client action after endpoint exists.",
    "12": "Task 12 (maps link 20.2) client validation pairs with task 14.2 server validation.",
    "18": "Task 18 (legal pages 26.1/26.2, design Property 13) is a pure container-width + heading-style fix; independent of the Wave 2 cross-cutting primitives, kept in Wave 3 for scheduling.",
    "19": "Task 19 (admin sign-in centering 29.1, design Property 15) is a standalone verify-and-guard on admin/src/pages/Login.jsx; independent of the client cross-cutting primitives, kept in Wave 3 for scheduling.",
    "8.6": "Task 8.6/8.7 (venues bottom-nav vs keyboard 8.13, design Property 14) is a sub-task of task 8 and rides its Wave 3 placement.",
    "8.8": "Task 8.8/8.9 (venues filter vs bottom bar 32.1, design Property 17) is a sub-task of task 8 and rides its Wave 3 placement; preservation 33.1.",
    "9.7": "Task 9.7/9.8 (event-create mobile overflow 35.1, design Property 18) is a sub-task of task 9 tied to the stepper modal 9.4; preservation 36.1.",
    "20": "Task 20 (cross-platform scroll reliability 38.1, design Property 19) is a Wave 2 cross-cutting audit-and-remove pass over client/src and admin/src; distinct from CC-3 (task 5, which intentionally locks during modals) and broader than home 5.9 (task 7). Its offender list is seeded by the Wave 0 diagnostic. Preservation 39.1.",
    "4-and-4": "Waves 2 and 4 are independent of each other and can run in parallel once Wave 1 completes."
  }
}
```
