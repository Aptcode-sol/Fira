# Platform Interaction Fixes — Bugfix Design

## Overview

This spec fixes the remaining QA-pass interaction/behavior/UX defects on the Firaa Next.js client (`client/src/app`, `client/src/components`), with a few small server touches (delete-account endpoint, maps-link validation, chat endpoints already exist). The defects fall into two shapes:

1. **Four cross-cutting bugs** that recur across many pages (focus loss, mobile zoom-on-submit, scroll-chaining behind modals, toasts behind modals). Each is solved **once** with a reusable primitive, then applied to the listed pages.
2. **Per-page behavior fixes** — the smallest correct diff at each real file.

The approach is deliberately lazy (per `ponytail.md`): reuse what already exists before writing anything new. Investigation of the codebase revealed that **three of the four cross-cutting fixes are already partly or fully in place**, so this design mostly *verifies, extends, and lints* rather than rebuilds:

- **CC-2 (mobile zoom)** — already fixed globally in `client/src/app/globals.css` (a coarse-pointer `@media` rule forces `font-size: 16px` on all `input`/`select`/`textarea`). Design = confirm coverage + add a guard so it does not regress.
- **CC-3 (scroll-chaining)** — already fixed in `client/src/components/ui/Modal.tsx` (`document.body.style.overflow = 'hidden'` + `overscroll-contain`) and in `globals.css` (fixed-overlay `overscroll-behavior: contain`). Design = migrate the remaining hand-rolled overlays to the shared `<Modal>` or the documented overlay class contract, plus a diagnostic to find stragglers.
- **CC-4 (toast behind modal)** — confirmed real: `Toast.tsx` container is `z-50`; `Modal.tsx` overlay is `z-[70]`. Design = raise the toast layer above the modal layer (single z-index token change).
- **CC-1 (focus loss)** — real; root cause is components defined *inside* render. Design = a diagnostic grep pattern + move offending definitions to module scope.

Chat/enquiry is **built but intentionally disabled** — the full client page, `messagesApi`, server `Conversation`/`Message` models and `routes/message.js` all exist. `client/src/app/messages/page.tsx` documents the exact re-enable checklist. Design = **re-enable and bind to the inquiry flow**, not rebuild.

### Boundary With Other Specs (restated)

- **Layout/overflow PDF items owned here (not deferred).** To keep the QA PDF fully covered without depending on the older spec, three layout/overflow PDF defects are first-class in *this* spec: the venues filter-popup-vs-bottom-bar overlap on mobile (31.x/32.x/33.x), the event-create mobile content overflow (34.x/35.x/36.x), and cross-platform scroll reliability across Android/iOS/macOS in client and admin (37.x/38.x/39.x). Their design coverage lives below (see the LAYOUT / OVERFLOW subsection under Per-Page/Area Fixes, Properties 17–19, the scroll-audit diagnostic, and the Testing Strategy). ui-ux-responsive-validation is **complementary**, not the owner, for these specific items.
- **ui-ux-responsive-validation** owns pure structural/overflow layout for the *broad* structural work (generic horizontal overflow, sidebar containment / mobile drawer, generic bottom-nav & dynamic-island clearance, card-grid responsiveness, generic input max-width, decorative containment, content max-width on large screens, fixed-element jitter). This spec references it and specifies only per-element **interaction/spacing behavior** (carousel row inset 5.7, dashboard sidebar-content gap 17.5, mobile vertical scroll 5.9) plus the three specific layout/overflow PDF items called out above, which are owned here.
- **platform-feature-overhaul** owns the *features* themselves: discount-code CRUD, scanning links/access-codes, custom ticket tiers, inquiry model/feature, Contact Us cleanup, billing card. This spec references them and specifies only their **runtime interaction surface**: per-tier gate allocation UI (11.15), discount setup surfaced in event creation (11.16), chat surface bound to inquiry (23.1).
- **platform-flow-fixes** owns money/settlement/payout numbers, discount-bearer rule, booking advance sync, event visibility gating, role switcher. This spec references it for the *numbers* behind Transactions vs Earnings (17.2) and specifies only the **display/query wiring**; discount date-window *server* enforcement (11.14) also lives there — this spec does the **client** validation.
- **industry-standard-upgrade** owns security/encryption/testing/resilience and set up the client test stack (vitest + React Testing Library + fast-check). This spec **uses** that stack for its tests. Referenced only.

## Glossary

- **Bug_Condition (C)**: The input/condition that triggers a defect. For CC-1, `inputParentRemountsOnRender(component) === true`. See per-fix formal specs below.
- **Property (P)**: The desired behavior for inputs where C holds.
- **Preservation**: Behavior for inputs where C does *not* hold — must be byte-for-byte unchanged by the fix.
- **F / F'**: Original (unfixed) / fixed function or component.
- **Cross-cutting primitive**: One reusable fix (a component, hook, CSS rule, or z-index token) that resolves a defect for every page that exhibits it.
- **`Modal`** (`client/src/components/ui/Modal.tsx`): The shared modal. Already locks body scroll and contains overscroll. The canonical container all popups should use.
- **`ToastProvider` / `ToastContainer`** (`client/src/components/ui/Toast.tsx`): App-wide toast portal. Its container z-index is the CC-4 lever.
- **coarse pointer**: `@media (pointer: coarse)` — a touch device; the scope for the 16px CC-2 rule.
- **`messagesApi`** (`client/src/lib/api`): Existing client wrapper over `server/routes/message.js`. Present but unused while chat is disabled.

## Bug Details

### Bug Condition — CC-1 Input focus loss on keystroke

The bug manifests when a controlled input's *owning component or element definition is created inside a parent's render body*. Each keystroke updates state, the parent re-renders, React sees a new component identity, unmounts the old input and mounts a new one, and the caret/focus is dropped. Manifests: venue booking purpose/guests (`client/src/app/venues/[id]/page.tsx`), Ask Enquiry (`client/src/components/InquiryForm.tsx`), event create-post (`client/src/components/modals/CreatePostModal.tsx`).

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type KeystrokeEvent
  OUTPUT: boolean
  RETURN inputParentRemountsOnRender(X.inputComponent) = true
END FUNCTION
```

### Bug Condition — CC-2 Zoom-on-submit (mobile)

The mobile browser auto-zooms into any focused control whose computed `font-size` is below 16px, and (on iOS) does not zoom back out. Manifests: creator apply, multiple submit flows.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type SubmitOrFocusEvent
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND inputFontSizePx(X.field) < 16
END FUNCTION
```

### Bug Condition — CC-3 Scroll-chaining behind modals

A modal is open, the user scrolls the modal body past its top/bottom edge, and because body scroll is not locked / overscroll not contained, the background page scrolls. Manifests: every popup in `client/src/components` and inline overlays across pages.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type ScrollEvent
  OUTPUT: boolean
  RETURN modalOpen(X) AND scrollReachesBound(X.modal) AND bodyScrollLocked(X) = false
END FUNCTION
```

### Bug Condition — CC-4 Toasts behind modals

A toast fires while a modal is open, and the toast container z-index is at or below the modal overlay z-index, so the toast renders beneath the modal. Confirmed: toast `z-50`, modal `z-[70]`.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type ToastEvent
  OUTPUT: boolean
  RETURN modalOpen(X) AND zIndex(X.toast) <= zIndex(X.modal)
END FUNCTION
```

### Bug Condition — Static/Legal page container + heading (25.1 / 25.2)

The bug manifests when one of the five static/legal pages (`privacy`, `terms`, `refund-policy`, `help`, `community-guidelines`) renders. Two grounded defects: (a) each `<main>` uses `max-w-4xl mx-auto` while the rest of the site's content sections use `max-w-7xl mx-auto`, so these pages sit narrower and leave extra blank left/right margins; (b) each page's `<h1>` uses a *different* gradient token — privacy `from-violet-400 to-pink-400`, terms `from-blue-400 to-cyan-400`, refund `from-green-400 to-emerald-400`, help `from-cyan-400 to-blue-400`, community-guidelines `from-pink-400 to-rose-400` — so headings are inconsistent across the set.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type LegalPageRender
  OUTPUT: boolean
  RETURN X.route IN {privacy, terms, refund-policy, help, community-guidelines}
         AND (containerMaxWidth(X) != standardPageMaxWidth
              OR headingStyle(X) != standardLegalHeadingStyle)
END FUNCTION
```

### Bug Condition — Venues bottom-nav vs on-screen keyboard (7.13 / 8.13)

The bug manifests on mobile when an input inside a venues-page form/modal is focused and the on-screen keyboard opens. The fixed bottom navigation is pinned with layout/visual units that track the *layout* viewport (`bottom: 0` / `vh`), which does not shrink when the keyboard opens, so the nav is pushed up and rides on top of the keyboard instead of staying at the true visual-viewport bottom or hiding.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type FocusState
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND keyboardOpen(X)
         AND bottomNavPinnedToLayoutViewport(X) = true
END FUNCTION
```

### Bug Condition — Admin sign-in centering (28.1 / 29.1)

The bug manifests when the admin panel sign-in page (`admin/src/pages/Login.jsx`) renders and its login-card container lacks both-axis viewport centering (missing `min-h-screen` + `flex items-center justify-center`), so the card is not centered horizontally/vertically across breakpoints.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type AdminLoginRender
  OUTPUT: boolean
  RETURN NOT (fillsViewportHeight(X) AND centeredOnBothAxes(X))
END FUNCTION
```

### Bug Condition — Venues filter popup vs bottom bar on mobile (31.1 / 32.1)

The bug manifests on mobile when the venues filter overlay/popup (`LocationFilter.tsx` or the filter modal in `client/src/app/venues`) is open. The overlay sits at a z/positioning that lets the *fixed* bottom navigation bar (`Navbar.tsx`) render over its lower region, so the filter's bottom controls (Apply / Show Results) are covered and unreachable. This is a *layering/clearance* case distinct from the keyboard-interaction case (7.13/8.13) though it shares the CC-4 layering theme.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type VenuesFilterOpenEvent
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND filterOpen(X) AND bottomNavOverlapsFilter(X) = true
END FUNCTION
```

### Bug Condition — Event-create mobile content overflow (34.1 / 35.1)

The bug manifests on mobile when the event-creation UI (`client/src/app/create` and its create-form components) renders. The UI uses fixed widths / non-responsive containers that exceed the mobile viewport width, so content is cut off or extends horizontally beyond the screen border.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type CreateUiRender
  OUTPUT: boolean
  RETURN isMobileViewport(X) AND contentWidth(X.createUi) > viewportWidth(X)
END FUNCTION
```

### Bug Condition — Cross-platform scroll reliability (37.1 / 38.1)

The bug manifests when a user scrolls on Android, iOS, or macOS browsers (in the `client` or `admin` app) and a scroll container is trapped by a height/overflow lock — e.g. `overflow: hidden` on a wrapper, a `100vh`/`h-screen` height trap, or a body scroll lock left applied. Scrolling then misbehaves or fails. This is broader than the home-page mobile-scroll clause (4.9/5.9) and distinct from the modal scroll-lock (CC-3, 1.5–1.6).

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type ScrollAttempt
  OUTPUT: boolean
  // X.platform in {android, ios, macos}; app in {client, admin}
  RETURN scrollContentExceedsViewport(X) AND scrollTrappedByHeightOrOverflowLock(X) = true
END FUNCTION
```

### Examples

- CC-1: Typing "party" into the venue booking Purpose field records only "p", then focus drops; user must re-click for each of the remaining 4 chars. Expected: all 5 chars land in one focus session.
- CC-2: Tapping the creator-apply email field on an iPhone zooms the page in; after submit the page stays zoomed. Expected: no zoom, viewport scale stays 1.0.
- CC-3: With the venue booking modal open, scrolling to the bottom of the form then continuing scrolls the venues list behind it. Expected: background stays fixed.
- CC-4: Booking an event ticket shows a "Booked!" toast that renders *under* the modal overlay and is invisible. Expected: toast renders above the modal.
- 8.7: Submitting a venue booking throws `ReferenceError: booker is not defined`. Expected: no ReferenceError.
- 11.2: Clicking "+" past available slots lets quantity exceed availability. Expected: capped at available, inline "limit reached".
- 25.1/25.2: The privacy page renders in a `max-w-4xl` column (extra blank margins vs the `max-w-7xl` used elsewhere) with a violet→pink heading, while the refund page uses a green→emerald heading in the same narrow column. Expected: all five pages use the standard container width and one shared heading style.
- 8.13: On an iPhone, focusing the Ask Enquiry phone field opens the keyboard and the bottom nav lifts up to sit on top of the keyboard. Expected: nav stays at the visual-viewport bottom or is hidden while the keyboard is open.
- 28.1/29.1: The admin sign-in card is not centered on both axes on some breakpoints. Expected: card centered horizontally and vertically across all breakpoints.
- 32.1: On a phone, opening the venues filter shows a popup whose Apply / Show Results control is hidden behind the fixed bottom nav, so the user cannot submit the filter. Expected: the filter renders fully above/clear of the bottom nav (layered above with nav-height padding, or nav hidden while the filter is open) and every control is reachable.
- 35.1: On a phone, the event-creation UI extends past the right edge of the screen (fixed-width fields / non-responsive container), cutting off content. Expected: content stays within the viewport width using the standard responsive container — no horizontal overflow.
- 38.1: On an Android/iOS/macOS browser, an admin or client page with more content than the viewport won't scroll because a wrapper has `overflow: hidden` or a `100vh` height trap. Expected: the page scrolls vertically and reliably.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Typing into inputs that already retain focus continues to work; controlled values still reflect state (3.1, 3.2).
- User-initiated pinch-zoom still works; successful submits still perform their existing submit + navigation (3.3, 3.4).
- With no modal open, the page scrolls normally; closing a modal restores prior scroll position and scrollability (3.5, 3.6).
- A toast with no modal open renders at its normal bottom-right position and z-order (3.7).
- Logo click still navigates home (6.1); non-active tabs render with no indicator (6.2); logged-out users still see the join CTA (6.3); horizontal rows still scroll through all items (6.4); dashboard nav still highlights on dashboard (6.5); desktop scroll unchanged (6.6).
- "Show Results" still returns correctly filtered venues (9.1); no filters => no badge (9.2); valid bookings still submit (9.4); valid guest counts still accepted (9.5); valid phone digits still accepted (9.6); desktop venue crop unchanged (9.7).
- Below-max "+" still increments (12.1); non-"family & friends" ticks still render (12.2); typed number values still accepted (12.3); non-zero revenue still computes correctly (12.4); edited post text still saves (12.5); created events/venues still persist all fields (12.6); in-window discount dates still accepted (12.7).
- Socials block still shown/functional (15.1); desktop creator layout unchanged (15.2); creator application submit/navigation unchanged (15.3).
- Existing bookings still list (18.1); transactions/earnings still compute per platform-flow-fixes (18.2); password change still works (18.3); confirmed deletion removes account + associated data (18.4); mobile dashboard layout unchanged (18.5).
- Status dropdown still filters requests (21.1); valid maps links still persist (21.2); mobile venue-settings layout unchanged (21.3).
- Inquiry submission still creates the inquiry record (24.1); existing Conversation/Message data preserved and readable (24.2).
- Legal/static pages keep their body copy and legal text byte-for-byte; only the container width and heading styling change (27.1).
- With no on-screen keyboard open, the venues-page bottom nav stays pinned at the viewport bottom exactly as today (9.8).
- Admin login fields, client-side validation, and submit behavior are unchanged; only the card's centering layout changes (30.1).
- On desktop the venues filter renders as today with no bottom-nav overlap (33.1).
- On desktop the event-creation UI renders within its container as today (36.1).
- Any platform/page that already scrolls correctly continues to scroll as today (39.1).

**Scope:** Any input that does NOT hit a bug condition must be completely unaffected. Non-touch viewports keep their existing (sub-16px) type. Non-modal scrolling, non-buggy typing, in-range quantities, in-window dates, valid URLs, and valid phone digits all behave exactly as before the fix.

## Hypothesized Root Cause

1. **CC-1 — Component/element defined inside render.** A child component (or an inline element with an unstable `key`) is declared in the parent function body, so it gets a fresh identity every render and React remounts it. The fix is to hoist the definition to module scope (or stop recreating the parent), giving React a stable identity so it *updates* rather than *remounts*.

2. **CC-2 — Sub-16px input font on mobile.** Controls using `text-sm`/`text-xs` compute below 16px; iOS Safari auto-zooms on focus. **Already mitigated**: `globals.css` forces `font-size: 16px` under `@media (pointer: coarse)` for `input, select, textarea`, plus `text-size-adjust`. Residual risk = a control that renders its editable region as a non-standard element (e.g. `contenteditable`) or an inline style overriding the rule.

3. **CC-3 — No body-scroll lock / overscroll containment.** **Already mitigated**: the shared `Modal` sets `body overflow: hidden` + `overscroll-contain`, and `globals.css` applies `overscroll-behavior: contain` to `.fixed.inset-0` overlays and `overscroll-behavior-y: none` to html/body on coarse pointers. Residual risk = a hand-rolled overlay that does not use `.fixed.inset-0` or the shared `Modal`.

4. **CC-4 — Toast z-index below modal.** `ToastContainer` is `z-50`; `Modal` overlay is `z-[70]`; `Navbar` layers are `z-50`/`z-[60]`. The toast simply sits under the modal. Fix = raise the toast layer above the top modal layer.

5. **Static/Legal pages — non-standard container + per-page heading styling (25.1/25.2).** Confirmed by inspection: all five pages (`privacy`, `terms`, `refund-policy`, `help`, `community-guidelines`) wrap `<main>` in `max-w-4xl mx-auto`, narrower than the site-standard `max-w-7xl mx-auto` used by `HomeClient`, `BrandHeader`, and the marketing sections — the narrower column is the source of the extra blank L/R margin. Separately, each page hard-codes its own `<h1>` gradient (five different tokens), so headings are inconsistent. Fix = align these pages to the standard container width and apply one shared heading style/token across all five. The bodies are identical wrapper structures, so the lazy move is a single shared style contract, not five ad-hoc edits.

6. **Venues bottom-nav rides above keyboard (7.13/8.13).** The fixed bottom nav is pinned to the *layout* viewport (`bottom: 0` / `vh`), which does not account for the on-screen keyboard. When the keyboard opens, the layout viewport is unchanged but the visual viewport shrinks, so the nav ends up above the keyboard. Fix = track the visual viewport (VisualViewport API offset, or `dvh`/interactive-widget behavior) so the nav sits at the true visual-viewport bottom, or hide the nav while an input is focused / keyboard is open. Coordinates with ui-ux-responsive-validation (which owns fixed-element stability); this design owns only the keyboard-open interaction case.

7. **Admin sign-in centering (28.1/29.1).** Inspection shows `admin/src/pages/Login.jsx` currently wraps the card in `<main className="relative z-20 min-h-screen flex items-center justify-center ...">`, which already centers on both axes — so the residual risk is a regression or a breakpoint where the centering utilities are overridden (e.g. a parent height/overflow constraint or a conditional wrapper). Fix = ensure the login card container keeps both-axis viewport centering (`min-h-screen flex items-center justify-center`) across all breakpoints and add a guard test so it cannot regress. This mirrors the CC-2/CC-3 "already in place → verify + guard" pattern.

8. **Venues filter popup vs bottom bar on mobile (32.1).** The venues filter overlay/popup (`LocationFilter.tsx` / the filter modal in `client/src/app/venues`) sits at a z/positioning layer that lets the *fixed* bottom nav (`Navbar.tsx`) cover its lower region, so the Apply / Show Results control is obscured. This is the CC-4 layering theme applied to a full-height overlay against a fixed nav, and it is adjacent to the 8.13 keyboard case but a distinct defect (nav-vs-overlay clearance, not keyboard-vs-nav). Fix = render the filter above/clear of the bottom nav: raise its layer above the nav **and/or** add bottom padding equal to the nav height / `env(safe-area-inset-bottom)`, or hide the bottom nav while the filter is open. Reuse the shared `Modal`/overlay pattern where practical (the shared `Modal` already sits at `z-[70]`, above the nav's `z-50`/`z-[60]`). Preservation: desktop unchanged (33.1).

9. **Event-create mobile content overflow (35.1).** The event-creation UI (`client/src/app/create` and its create-form components) uses fixed pixel widths / non-responsive containers wider than the mobile viewport, so content overflows horizontally beyond the border. Fix = constrain the create UI to the standard responsive container (`w-full` + a `max-w-*`, no fixed `px` widths wider than the viewport, proper horizontal padding). This pairs with the stepper-modal work (11.12/11.13): the new stepper modal, built on the shared `<Modal>`, should be responsive by construction, so the smallest correct move is to make the create UI responsive as part of that same modal treatment rather than patching fixed widths one field at a time. Preservation: desktop unchanged (36.1).

10. **Cross-platform scroll reliability (37.1/38.1).** Scroll containers across `client/src` and `admin/src` use height/overflow locks — `overflow: hidden` on a wrapper, `100vh`/`h-screen` height traps, or a body scroll lock left applied outside the shared `Modal` — that break scrolling on Android/iOS/macOS. This is broader than the home-page mobile-scroll fix (5.9) and distinct from the modal scroll-lock (CC-3): CC-3 *wants* body scroll locked while a modal is open, whereas this defect is a lock that persists or a container trap on ordinary pages. Fix = audit scroll containers (diagnostic below), remove height/overflow traps, prefer natural document scroll (use `dvh` rather than `100vh`/`vh` where a viewport-height element is needed), and ensure a body scroll lock is only ever applied by the shared `Modal` and is always released on close. Preservation: pages that already scroll continue to (39.1).

## Correctness Properties

Property 1: Bug Condition — CC-1 Focus retention

_For any_ keystroke sequence typed into an input whose owning component previously remounted per render (isBugCondition true), the fixed component SHALL keep the input mounted so `document.activeElement` remains that input and its value equals the full typed string in a single focus session.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — CC-2 No mobile auto-zoom

_For any_ `input`/`select`/`textarea` focused on a coarse-pointer (mobile) viewport (isBugCondition true), the fixed styles SHALL yield a computed `font-size` of at least 16px so the browser does not auto-zoom, and the viewport scale stays 1.0.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition — CC-3 No scroll chaining

_For any_ open modal at its scroll bound where body scroll was previously unlocked (isBugCondition true), the fixed behavior SHALL keep `document.body` scroll locked (`overflow: hidden`) and contain overscroll so the background scroll offset does not change; closing the modal SHALL restore it.

**Validates: Requirements 2.5, 2.6**

Property 4: Bug Condition — CC-4 Toast above modal

_For any_ toast fired while a modal is open where toast z-index was previously ≤ modal z-index (isBugCondition true), the fixed layering SHALL render the toast container z-index strictly greater than the modal overlay z-index so the toast is visible.

**Validates: Requirements 2.7**

Property 5: Venues — filter single API call

_For any_ sequence of interactions inside the venue filter, the number of list API calls SHALL equal the number of "Show Results" clicks (0 while only selecting options, exactly 1 per submit).

**Validates: Requirements 8.1**

Property 6: Venues — max-guests capacity validation

_For any_ guest count entered against a venue with `[capacity.min, capacity.max]`, the fixed flow SHALL reject with an inline error when the count is outside the range and accept it when within range.

**Validates: Requirements 8.6**

Property 7: Venues — phone digits only

_For any_ string entered into the Ask Enquiry phone field, the stored value SHALL contain digits only (non-digits stripped), and any all-digit input SHALL be preserved unchanged.

**Validates: Requirements 8.10**

Property 8: Events — quantity cap

_For any_ (availableSlots, increment-click sequence), the resulting quantity SHALL never exceed availableSlots, and at the maximum the "+" control SHALL be disabled with an inline limit message shown.

**Validates: Requirements 11.2**

Property 9: Events — revenue and lowest-tier display

_For any_ set of ticket tiers with prices and booked counts, revenue SHALL equal Σ(booked × price) and render as ₹0 when none (never "free"), and the event info price SHALL display the minimum tier price as "from ₹X onwards".

**Validates: Requirements 11.6, 11.7**

Property 10: Events — discount date bounds (client)

_For any_ discount `validFrom`/`validUntil` against an event window `[eventStart, eventEnd]`, the client SHALL reject when `validFrom < eventStart` OR `validUntil > eventEnd` and accept when both fall within the window (server enforcement lives in platform-flow-fixes).

**Validates: Requirements 11.14**

Property 11: Venue owner — maps link validation

_For any_ string saved as a location/maps link, the fixed flow SHALL accept it iff it is a valid URL and otherwise reject with an inline error.

**Validates: Requirements 20.2**

Property 12: Chat bound to inquiry

_For any_ inquiry context where chat was previously unavailable (isBugCondition true), the re-enabled flow SHALL let the sender and owner converse in a conversation bound to that inquiry's reference, backed by the existing `Conversation`/`Message` models.

**Validates: Requirements 23.1**

Property 13: Static/Legal pages — standard container and consistent heading (example)

_For any_ of the five static/legal pages (`privacy`, `terms`, `refund-policy`, `help`, `community-guidelines`) rendered after the fix, the page SHALL use the site-standard content container width and one shared heading style/token, so no page uses a divergent max-width or a per-page heading gradient. Verified by example/interaction tests (a layout/styling fix, not a fast-check property).

**Validates: Requirements 26.1, 26.2**

Property 14: Venues bottom-nav vs keyboard (interaction)

_For any_ mobile focus state where the on-screen keyboard is open over a venues-page form (isBugCondition true), the fixed behavior SHALL keep the bottom nav at the visual-viewport bottom (its top edge SHALL NOT exceed the visual viewport height) OR hide the nav while the keyboard is open. Verified by an interaction test asserting against the visual-viewport offset.

**Validates: Requirements 8.13**

Property 15: Admin sign-in centering (example)

_For any_ breakpoint at which the admin sign-in page renders, the fixed login-card container SHALL fill the viewport height and center its card on both axes (`min-h-screen` + `flex items-center justify-center`). Verified by an example test on the rendered container classes/layout.

**Validates: Requirements 29.1**

Property 17: Venues — filter clear of bottom nav (interaction)

_For any_ mobile state where the venues filter popup/overlay is open and the bottom nav previously overlapped it (isBugCondition true), the fixed behavior SHALL render the filter fully above/clear of the bottom nav — layered above it with padding for the nav height, or with the nav hidden while the filter is open — so the Apply / Show Results control is reachable. Verified by an interaction test asserting the filter's apply control is not covered by the fixed nav.

**Validates: Requirements 32.1**

Property 18: Events — create UI no horizontal overflow (example)

_For any_ mobile viewport where the event-creation UI renders and previously overflowed (isBugCondition true), the fixed UI SHALL keep its content width within the viewport width (`contentWidth <= viewportWidth`) using the standard responsive container. Verified by an example/interaction test asserting the rendered create UI's content width does not exceed the viewport width.

**Validates: Requirements 35.1**

Property 19: Cross-platform scroll reliability (example)

_For any_ scroll container in the client or admin that previously trapped scrolling via a height/overflow lock (isBugCondition true), the fixed container SHALL be vertically scrollable (`canScrollVertically == true`) with no height/overflow trap. Verified by an example/interaction test asserting a page whose content exceeds the viewport can scroll.

**Validates: Requirements 38.1**

Property 16: Preservation — non-buggy inputs unchanged

_For any_ input where the bug condition does NOT hold, the fixed code SHALL produce the same result as the original: already-focused typing still works, non-modal scrolling still works, no-modal toasts keep normal z-order, below-max quantities still increment, in-window dates and valid URLs/phone digits are still accepted, legal-page body copy is unchanged, the bottom nav stays pinned when no keyboard is open, admin login fields/validation/submit are unchanged, the venues filter renders as today with no bottom-nav overlap on desktop, the event-creation UI renders within its container as today on desktop, and any platform/page that already scrolls continues to scroll as today.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 15.1, 15.2, 15.3, 18.1, 18.2, 18.3, 18.4, 18.5, 21.1, 21.2, 21.3, 24.1, 24.2, 27.1, 30.1, 33.1, 36.1, 39.1**

## Fix Implementation

### Cross-Cutting Primitives (fix once, apply to listed pages)

**CC-1 — Focus retention.** No new abstraction. For each offender, move the component/element definition out of the parent's render body to module scope, keep controlled `value`/`onChange`, and use stable keys.
- `client/src/components/InquiryForm.tsx` — already uses top-level `Input`; verify no inline redefinition (Ask Enquiry).
- `client/src/app/venues/[id]/page.tsx` — booking modal Purpose/Expected-Guests fields (~L948–962) are inline JSX in the page render; ensure the modal content is not a nested component defined per-render. Extract any per-render sub-component to module scope.
- `client/src/components/modals/CreatePostModal.tsx` — event create-post input; same check.
- Diagnostic (see below) finds any remaining offenders.

**CC-2 — No mobile zoom.** Already implemented in `client/src/app/globals.css` (coarse-pointer 16px rule). Actions: (a) confirm the rule covers all editable controls; (b) confirm the viewport meta in `client/src/app/layout.tsx` does not set `maximum-scale`/`user-scalable=no` in a way that traps zoom (it must still allow user pinch-zoom per 3.3); (c) leave a `ponytail:` comment marking the global rule as the single CC-2 source so no per-page overrides reintroduce sub-16px fonts. No per-page diffs unless a control bypasses the rule.

**CC-3 — No scroll chaining.** Already implemented in `Modal.tsx` + `globals.css`. Actions: migrate any hand-rolled overlay to the shared `<Modal>` where practical; where not, ensure the overlay root uses `className="fixed inset-0 ..."` and its scroll region uses `overflow-y-auto overscroll-contain` so the existing `globals.css` contract covers it. The diagnostic lists overlays that use `document.body.style.overflow` ad-hoc or fixed overlays missing the class contract.

**CC-4 — Toast above modal.** Single change in `client/src/components/ui/Toast.tsx`: raise `ToastContainer` from `z-50` to a layer above the modal (`z-[100]`). Rationale: current layering is Navbar `z-50`/drawer `z-[60]`, Modal `z-[70]`. `z-[100]` sits above all. Keep it as the one toast layer token; add a `ponytail:` comment noting the ceiling (a single global layer order; if nested portals with higher z appear, revisit).

### Per-Page / Area Fixes (Root Cause → Fix, real paths)

**HOME** — `client/src/components/Navbar.tsx`, `client/src/components/HomeClient.tsx`, `client/src/app/page.tsx`
- 5.1 Redundant Home nav item: remove `{ href: '/', label: 'Home' }` from `navLinks` (logo already links home). Keep mobile bottom-nav Home tab (that is the mobile home affordance, not redundant with a desktop text item). Root cause: duplicate home affordance in desktop `navLinks`.
- 5.2 Inconsistent active indicator: the indicator uses two different sizes (`w-1.5 h-0.5` under logo vs `w-3/5 h-0.5` under links) sharing one `layoutId="navbar-indicator"`. Fix: one consistent small underscore size for the active link; keep a single `layoutId` so it animates between links.
- 5.3 Logo disappears during navigation: root cause is the logo indicator/`motion` conditional or a remount on route change. Fix: keep the logo `<img>` unconditionally rendered (outside any `pathname`-gated branch); only the small dot under it is conditional.
- 5.4 "View Parties" does nothing: wire the control to `router.push('/events')` (parties == events).
- 5.5 "Join Now" when authenticated: gate the sign-up CTA on `!isAuthenticated` (Navbar already does this for its buttons; apply the same guard to the HomeClient "Join Now" CTA). When authed, hide it.
- 5.6 Remove "Learn more" buttons: delete the `Learn more` CTAs in the relevant HomeClient sections.
- 5.7 Horizontal-row left inset: add leading padding (`pl-4`/`ps-4`) to horizontal-scroll rows so the first item is not flush to the edge (coordinate with ui-ux-responsive-validation for structural overflow).
- 5.8 Notifications nav: (a) make notifications a top-level route `client/src/app/notifications/page.tsx` moved out of `client/src/app/dashboard/notifications`; (b) fix active-highlight so the notifications item highlights (not dashboard). Update the Navbar bell link to `/notifications`.
- 5.9 Mobile vertical scroll restored: root cause is a fixed/overflow trap (a full-height fixed element or `overflow: hidden` on a scroll container). Identify the trapping element on the home route and remove the height/overflow lock; reference ui-ux-responsive-validation for overlap with fixed elements.

**VENUES** — `client/src/app/venues/page.tsx`, `client/src/app/venues/[id]/page.tsx`, `VenueCard.tsx`, `LocationFilter.tsx`, `InquiryForm.tsx`, `Navbar.tsx`
- 8.1 Filter single API call: introduce a **local draft-filter state** in the venues page; filter controls (incl. `LocationFilter`) update draft only; the API call fires only in the "Show Results" submit handler. Root cause: each filter `onChange` currently drives the fetch.
- 8.2 Applied-count badge instead of outside chips: remove the external selected-item chips; show the filter control with a badge of the count of applied filters.
- 8.3 Navbar lamp pop on navigation: the `layoutId="navbar-indicator"` spring animates from an off-screen position on route change. Fix: disable the entry animation on navigation (render the indicator without the bottom-up spring, or gate `layout` animation so it does not originate from page bottom).
- 8.4 Booking validation errors behind modal: render validation errors *inside* the modal body (the modal already caps to viewport). Root cause: error surfaced on the page layer, not the modal layer.
- 8.6 Max-guests validation: validate `guests` against `venue.capacity.min/max`; show inline error and block submit when out of range. The input already has `min`/`max` attrs but no JS validation.
- 8.7 "booker is not defined": grep every booking handler for an undefined `booker` reference (the QA build referenced one in the booking submit path); replace with the correct in-scope variable (e.g. `user`/`booking.user`). Root cause: a scoping/typo bug in the booking flow.
- 8.8 Calendar after proceed: move the availability calendar *into* the booking popup, shown after the user proceeds — not before/outside. Currently the calendar renders on the page (`[id]/page.tsx` ~L539) ahead of booking.
- 8.10 Phone digits-only: sanitize the Ask Enquiry phone field `onChange` to strip non-digits (`value.replace(/\D/g, '')`) in `InquiryForm.tsx`.
- 8.11 "Two months" text vs reality: the copy says "next 2 months" (`[id]/page.tsx` ~L543) but the calendar navigates arbitrarily far. Fix: bound calendar navigation to two months OR correct the copy. Choose bounding navigation (matches the stated promise, smaller behavioral surprise).
- 8.12 Mobile venue images cropped landscape: apply a consistent landscape aspect-ratio/`object-cover` crop on mobile venue images to match desktop.
- 8.13 Bottom-nav vs on-screen keyboard (mobile): the fixed bottom nav (in `Navbar.tsx`) is pinned to the layout viewport, so it rides above the keyboard when an input in a venues-page form/modal is focused. Fix: track the visual viewport so the nav stays at the true visual-viewport bottom, or hide it while the keyboard is open — either subscribe to `window.visualViewport` `resize`/`scroll` and offset the nav by `innerHeight - visualViewport.height`, or use `dvh`/interactive-widget behavior, or drop the nav to `display:none` while an input is focused (`focusin`/`focusout`). Root cause: `bottom:0`/`vh` pinning ignores the keyboard. Preservation: with no keyboard open the nav stays pinned exactly as today (9.8). Coordinate with ui-ux-responsive-validation (fixed-element stability); this owns the keyboard-open case only. `ponytail:` prefer the native VisualViewport API over any re-implementation; ceiling — browsers without `visualViewport` fall back to the current pinned behavior (acceptable, matches today).
- 32.1 Filter popup vs bottom bar (mobile): the venues filter overlay/popup (`LocationFilter.tsx` / the filter modal in `client/src/app/venues`) is covered at its lower edge by the fixed bottom nav, hiding the Apply / Show Results control. Fix: render the filter above/clear of the nav — raise its layer above the nav and/or add bottom padding equal to the nav height + `env(safe-area-inset-bottom)`, or hide the bottom nav while the filter is open. Reuse the shared `<Modal>` overlay pattern where practical (it already sits at `z-[70]`, above the nav's `z-50`/`z-[60]`). Adjacent to CC-4 layering and the 8.13 keyboard fix but its own case (nav-vs-overlay clearance). Root cause: filter overlay z/positioning below the fixed nav. Preservation: desktop unchanged (33.1). See also the LAYOUT / OVERFLOW subsection below.

**EVENTS** — `client/src/app/events/**`, `EventCard.tsx`, `PostCard.tsx`, `TicketDisplay.tsx`, event-management components, `client/src/components/modals/CreatePostModal.tsx`
- 11.2 Quantity cap: clamp the "+" handler at `availableSlots`; disable "+" at max and show an inline "limit reached" message.
- 11.3 Family/friends tier tick: fix the tick/checkmark render for that tier (likely a mismatched key/index comparison in the tier list).
- 11.4 Wheel-to-change disabled: add `onWheel={(e) => e.currentTarget.blur()}` (or `preventDefault`) to number inputs (max-tickets etc.) so scrolling does not mutate the value.
- 11.5 Manage-event image sizing: apply the same image dimensions/aspect as the events listing card.
- 11.6 Revenue computed: compute `Σ(ticketsBooked × price)`; render `₹0` when none instead of "free".
- 11.7 Lowest-tier "from": display `from ₹{min(tier.price)} onwards` in event info.
- 11.8 List tiers in booking UI: render the available tiers in the ticket-booking UI.
- 11.10 Post-edit image actions: wire the image add/remove/replace actions in the post edit flow (currently only text updates).
- 11.11 In-app delete confirm: replace native `confirm()` for delete-post with the shared `<Modal>` confirmation (reuse `CancellationModal.tsx` pattern or a small confirm modal). Root cause: native `confirm()`.
- 11.12/11.13 Stepper modal for event + venue create/edit: build one reusable multi-step (stepper) modal on top of the shared `<Modal>`; use it for event creation, event edit, and venue creation. Root cause: bottom-anchored non-reusable form. Build it **responsive by construction** (see 35.1 below) so the mobile-overflow fix falls out of this same work rather than being patched separately.
- 35.1 Event-create mobile overflow: the event-creation UI (`client/src/app/create` and its create-form components) uses fixed pixel widths / non-responsive containers wider than the mobile viewport, so content overflows the border. Fix: constrain the create UI to the standard responsive container (`w-full` + `max-w-*`, no fixed `px` widths wider than the viewport, proper horizontal padding). Pairs with the stepper modal (11.12/11.13) — the new stepper is responsive by construction. Root cause: fixed-width / non-responsive create containers. Preservation: desktop unchanged (36.1). See also the LAYOUT / OVERFLOW subsection below.
- 11.14 Discount date bounds (client): validate `validFrom >= eventStart && validUntil <= eventEnd`; reject out-of-window with inline error. Note: server enforcement lives in platform-flow-fixes.
- 11.15 Per-tier gate allocation UI: surface, at event-creation time, per-tier allocation of entries to a gate/scanner (runtime UI over the scanning feature — feature owned by platform-feature-overhaul).
- 11.16 Discount setup in event creation: surface discount-code setup within the event-creation stepper (CRUD owned by platform-feature-overhaul; this wires the UI entry point).

**CREATORS** — `client/src/app/creators/**`, `client/src/app/brands/**`, `BrandHeader.tsx`
- 13.1/14.1 Duplicate "Get in Touch": remove the redundant "Get in Touch" block; keep the socials block.
- 13.2/14.2 Mobile flush-right layout: fix the mobile layout to match the desktop left-aligned layout (a mobile-only alignment/margin bug).
- 13.3/14.3 Scroll overlap: fix the overlapping content on scroll (a positioning/z-index or fixed-element overlap; coordinate with ui-ux-responsive-validation for structural overlap).
- 13.4/14.4 Zoom after apply: satisfied by CC-2 (global 16px rule).

**DASHBOARD** — `client/src/app/dashboard/**`, `client/src/components/dashboard/**`, `BillingCard.tsx`
- 16.1/17.1 My Bookings renders immediately: root cause is a lazy/reveal-on-scroll wrapper (IntersectionObserver or hydration gating) around the bookings list. Fix: render bookings on mount without requiring scroll (remove the observer gate or set initial visible state true).
- 16.2/17.2 Distinct Transactions vs Earnings: wire the two tabs to distinct queries — Transactions = money the user paid; Earnings = money owed/settled to them as owner. Numbers owned by platform-flow-fixes; this is the display/query wiring so the two tabs no longer show identical content.
- 16.3/17.3 Change Password as settings section: move Change Password into a proper settings dropdown/section with a desktop-suitable layout.
- 16.4/17.4 Wire Delete Account: client action calls a `DELETE /api/users/me` endpoint (see Data/Endpoint Changes) behind an in-app confirmation modal.
- 16.5/17.5 Sidebar-content gap on desktop: add the appropriate spacing/gap between sidebar and content on desktop (coordinate with ui-ux-responsive-validation).

**VENUE OWNER DASHBOARD** — `client/src/app/venue-portal/**`, `client/src/components/venue-portal/**`
- 19.1/20.1 Style the status dropdown: apply app-consistent styling to the All/Pending/Approved/Rejected dropdown (reuse `client/src/components/ui/Select.tsx`).
- 19.2/20.2 Validate maps link URL: on save, validate the location/maps link as a valid URL; reject invalid input with an inline error. Client validation + server validation (see endpoint changes).
- 19.3/20.3 Settings desktop layout: fix the venue settings desktop layout (flushed-left → desktop-suitable).

**CHAT & ENQUIRY** — `client/src/app/messages/page.tsx`, `client/src/app/inbox/page.tsx`, `InquiryForm.tsx`, server `Conversation`/`Message` models + `routes/message.js`
- 22.1/23.1 Re-enable chat bound to inquiry. Chat is **built and disabled**, not missing. `client/src/app/messages/page.tsx` documents the re-enable checklist. Design:
  - **Client surface**: restore the messages thread UI (commented-out implementation at the bottom of `messages/page.tsx`), re-enable the entry points flagged "CHAT DISABLED" (Navbar messages link, `RouteGuard.tsx`, inbox Messages tab, brand/creator Message buttons, `HowItWorks.tsx`). Add an entry point from the inquiry flow (`InquiryForm.tsx` / inquiry detail) that opens a conversation bound to the inquiry's reference (event/venue + participants).
  - **Server**: `routes/message.js` already supports conversations/messages/unread and a `start-brand-enquiry`. Re-mount `app.use('/api/messages', messageRoutes)` in `server/index.js`. Add a minimal `start-inquiry-conversation` endpoint (or extend `send`/`start-brand-enquiry`) that finds-or-creates a conversation between the inquiry sender and the reference owner, tied to the inquiry reference. Reuse the existing find-or-create pattern already in `routes/message.js`.
  - Ponytail note: no new models, no new client API layer — reuse `Conversation`, `Message`, `messagesApi`, and the existing route handlers.

**STATIC / LEGAL PAGES** — `client/src/app/privacy/page.tsx`, `client/src/app/terms/page.tsx`, `client/src/app/refund-policy/page.tsx`, `client/src/app/help/page.tsx`, `client/src/app/community-guidelines/page.tsx`
- 26.1 Standard container width: all five pages wrap `<main>` in `max-w-4xl mx-auto` while the rest of the site uses `max-w-7xl mx-auto` (see `HomeClient.tsx`, `BrandHeader.tsx`). Fix: align these pages to the site-standard content container width so their L/R margins match the rest of the site. Root cause: a narrower, non-standard container.
- 26.2 Consistent heading style: each page hard-codes a different `<h1>` gradient — `from-violet-400 to-pink-400` (privacy), `from-blue-400 to-cyan-400` (terms), `from-green-400 to-emerald-400` (refund), `from-cyan-400 to-blue-400` (help), `from-pink-400 to-rose-400` (community-guidelines). Fix: apply one shared heading style/token across all five `<h1>`s (same gradient/size/weight). Root cause: per-page heading styling with no shared token.
- Ponytail note: the five pages share an identical `<main>` + card + `<h1>` wrapper. The lazy, edge-correct move is one shared class string (or a tiny `LegalPageShell` wrapper if these keep diverging) applied to all five — a single style contract, not five one-off edits. These are layout/styling fixes verified by example tests, so no new fast-check property is introduced (see Property 13).
- 27.1 Preservation: the legal body copy / `<section>` text stays byte-for-byte unchanged; only the container width and heading class change.

**ADMIN AUTH** — `admin/src/pages/Login.jsx`
- 29.1 Center the sign-in card on both axes: the card container must fill the viewport height and center horizontally + vertically across all breakpoints (`min-h-screen flex items-center justify-center`). Inspection shows `Login.jsx` already applies these on its `<main>`, so the fix is to verify the centering holds (no parent height/overflow or conditional wrapper defeats it) and add a guard test to prevent regression. Root cause (if regressed): a missing/overridden centering layout on the card container. Mirrors the CC-2/CC-3 "already in place → verify + guard" approach.
- 30.1 Preservation: the login fields, client-side validation, and submit/`navigate('/')` behavior are unchanged; only the centering layout is touched.

### LAYOUT / OVERFLOW (QA-PDF items owned here)

These three layout/overflow PDF defects are owned by this spec (no longer deferred to ui-ux-responsive-validation, which is complementary for broad structural work). The first two are also cross-referenced from VENUES (32.1) and EVENTS (35.1) above; the third is cross-cutting across both apps.

- **32.1 Venues filter vs bottom bar (mobile)** — `client/src/app/venues`, `LocationFilter.tsx`, `Navbar.tsx`. Root cause → Fix as detailed under VENUES (32.1): render the filter above/clear of the fixed bottom nav (raise layer + nav-height / safe-area padding, or hide the nav while the filter is open), reusing the shared `<Modal>` overlay pattern where practical. Preservation: desktop unchanged (33.1).
- **35.1 Event-create mobile overflow** — `client/src/app/create` and create-form components. Root cause → Fix as detailed under EVENTS (35.1): constrain the create UI to the standard responsive container (`w-full`/`max-w-*`, no fixed px widths wider than the viewport, proper padding), delivered together with the responsive stepper modal (11.12/11.13). Preservation: desktop unchanged (36.1).
- **38.1 Cross-platform scroll reliability (cross-cutting)** — scroll containers across `client/src` and `admin/src`. Root cause: height/overflow locks (wrapper `overflow: hidden`, `100vh`/`h-screen` height traps, a body scroll lock left applied outside the shared `Modal`) that break scrolling on Android/iOS/macOS. Fix: audit scroll containers (see the scroll-audit diagnostic below), remove the height/overflow traps, prefer natural document scroll and use `dvh` instead of `100vh`/`vh` where a viewport-height element is genuinely needed, and ensure a body scroll lock is applied **only** by the shared `<Modal>` and always released on close. This is broader than the home-page 5.9 fix and distinct from the CC-3 modal scroll-lock (which *intentionally* locks body scroll only while a modal is open). Preservation: pages that already scroll continue to (39.1). `ponytail:` this is an audit-and-remove pass, not a new scroll abstraction; ceiling — the grep below finds the candidates, each hit is judged in context (a legitimate CC-3 modal lock stays).

### Data / Endpoint Changes (only three)

1. **Delete account (17.4)** — add `DELETE /api/users/me` in `server/routes/user.js` (+ `userService`) that deletes the authenticated user and their associated data appropriately (bookings/tickets/inquiries handling per existing cascade conventions). Client wires the settings action + confirmation modal to it.
2. **Maps-link validation (20.2)** — in the venue update path (`server/routes/venue.js` / `venueService`), validate the location/maps link with URL validation (reuse `server/middleware/validate.js`) and reject invalid links with a 400 + message. Client mirrors with inline validation.
3. **Chat endpoints (23.1)** — no new models. Re-mount `/api/messages` in `server/index.js` and add/extend one handler to find-or-create a conversation tied to an inquiry reference. Everything else already exists.

### Diagnostic Approach (finding all offenders)

Rather than patch only the pages the QA report names, find every instance of each cross-cutting bug once:

- **CC-1 focus-loss offenders** — grep for component/function definitions declared *inside* another component's body (a `function X` or `const X = (...) =>` that returns JSX and is nested under another component, or inline elements with unstable keys):
  - `grep_search` for `const [A-Z][A-Za-z]* = \(` and `function [A-Z]` occurring after a component's opening brace within the same file; review each hit in `client/src/app/**` and `client/src/components/**`.
  - Cross-check controlled inputs: search `onChange=\{.*set` inside files that also define a nested component.
- **CC-3 scroll-lock offenders** — find hand-rolled overlays not using the shared `<Modal>`:
  - `grep_search` for `document.body.style.overflow` (ad-hoc body locks) and for `fixed inset-0` overlays; any fixed overlay whose scroll region lacks `overscroll-contain` and does not use `<Modal>` is migrated or given the class contract.
- **CC-2** — `grep_search` for inline `style={{ fontSize` or `text-xs`/`text-sm` on editable controls to confirm the global rule is the only lever; flag any inline override.
- **CC-4** — single audit of z-index tokens (`z-50`, `z-[60]`, `z-[70]`, `z-[100]`) to confirm toast sits on top.
- **Scroll-reliability offenders (38.1)** — find every scroll trap once, the same way CC-3 finds hand-rolled overlays:
  - `grep_search` for `overflow:\s*hidden` / `overflow-hidden` on wrappers, for `100vh` and `h-screen`/`min-h-screen` height traps, and for `document.body.style.overflow` (body scroll locks) across `client/src/**` and `admin/src/**`.
  - Each hit is judged in context: a legitimate CC-3 `<Modal>` body lock stays; a wrapper `overflow: hidden` or `100vh` height trap on an ordinary scroll container is removed or switched to natural document scroll / `dvh`; any body scroll lock applied outside the shared `<Modal>` (or never released) is fixed so only the shared `<Modal>` locks and it always restores on close.
  - Cross-check that the shared `Modal`'s lock/restore pair is the sole owner of `document.body.style.overflow`.
- **Filter-vs-nav offender (32.1)** — inspect `LocationFilter.tsx` / the venues filter overlay for its z-index vs `Navbar.tsx` (`z-50`/`z-[60]`) and for missing bottom padding for the fixed nav; confirm the fix layers it above the nav or hides the nav while open.
- **Create-overflow offenders (35.1)** — `grep_search` under `client/src/app/create/**` for fixed pixel widths (`w-\[\d+px\]`, inline `style={{ width` / `minWidth`) and non-responsive containers wider than the viewport; confirm each is replaced with `w-full`/`max-w-*` + padding.

## Error Handling

- **Validation errors render on the visible layer.** Booking (8.4), guest-capacity (8.6), discount dates (11.14), maps link (20.2), and inquiry validation surface inline within the modal/form, never behind an overlay. Reuse `Input`'s `error` prop and the existing `errors` state pattern in `InquiryForm.tsx`.
- **Input sanitization at the trust boundary.** Phone (8.10) strips non-digits on input; server still validates on submit. Maps link validated both client and server (never trust the client).
- **Destructive actions gated.** Delete Account (17.4) and delete-post (11.11) require in-app confirmation; the server delete endpoint requires auth and only deletes the authenticated user's own account.
- **Chat re-enable is reversible.** Re-mounting `/api/messages` and restoring the client page are additive; the documented disable checklist is the rollback path.
- **No throw on booking.** The `booker` ReferenceError (8.7) is eliminated; the booking handler must not reference undefined symbols.

## Testing Strategy

Uses the client's existing stack: **vitest + React Testing Library + fast-check** (`client/package.json`; set up by industry-standard-upgrade). Server tests use the existing vitest setup under `server/__tests__`.

### Validation Approach

Two phases: first surface counterexamples on the *unfixed* code (confirm root cause), then verify the fix and preservation. Property-based tests are used where a clean invariant exists (quantity cap, discount date bounds, phone digits-only, filter single-API-call, guest capacity, maps-link URL); interaction/example tests are used for focus, scroll-lock, z-order, navigation, presence/absence, and the layout/styling fixes (legal-page container + heading, admin centering, bottom-nav vs keyboard). The three newly-added areas (legal pages 25.x/26.x/27.x, venues keyboard 7.13/8.13, admin auth 28.x/29.x/30.x) are behavior/layout fixes — no new fast-check properties; the keyboard case asserts against the visual viewport. The three layout/overflow PDF items owned here (venues filter vs bottom bar 31.x/32.x/33.x, event-create mobile overflow 34.x/35.x/36.x, cross-platform scroll reliability 37.x/38.x/39.x) are likewise example/interaction fixes — no fast-check needed: the overflow case asserts `contentWidth <= viewportWidth`, the scroll case asserts `canScrollVertically`, and the filter case asserts the Apply/Show-Results control is not covered by the fixed nav.

### Exploratory Bug Condition Checking

**Goal**: Demonstrate each bug on unfixed code before fixing; confirm or refute the root cause.

**Test Cases**:
1. **CC-1 focus** (venue booking / InquiryForm / CreatePostModal): `userEvent.type(input, "party")` and assert `input.value === "party"` and `document.activeElement === input` (fails on unfixed remounting component).
2. **CC-4 toast z-order**: assert the toast container computed z-index > modal overlay z-index (fails on unfixed `z-50` vs `z-[70]`).
3. **8.7 booker**: render the booking flow and submit; assert no `ReferenceError` thrown (fails on unfixed code).
4. **8.1 filter calls**: mock `venuesApi.getAll`; click filter options N times without "Show Results"; assert `getAll` not called (fails on unfixed per-click fetch).
5. **11.2 quantity**: click "+" past `availableSlots`; assert value exceeds available (fails on unfixed).
6. **26.1/26.2 legal pages**: render all five pages; assert the `<main>` container width matches the site standard and every `<h1>` uses the same heading class (fails on unfixed — `max-w-4xl` and five different gradients).
7. **8.13 keyboard**: simulate keyboard-open (shrink `visualViewport.height`) with a venues-page input focused; assert the bottom-nav top edge ≤ visual viewport height, or nav hidden (fails on unfixed pinned nav).
8. **29.1 admin centering**: render `Login.jsx`; assert the card container carries both-axis centering across breakpoints (guard against regression).
9. **32.1 filter vs bottom bar**: render the venues filter open on a mobile viewport; assert the Apply / Show Results control is not covered by the fixed bottom nav (its bottom edge sits above the nav, or the nav is hidden while the filter is open) — fails on unfixed overlapping layout.
10. **35.1 create overflow**: render the event-creation UI on a mobile viewport; assert the create UI's content width ≤ viewport width — fails on unfixed fixed-width containers.
11. **38.1 scroll reliability**: render a client/admin page whose content exceeds the viewport with a trapping wrapper (`overflow: hidden` / `100vh`); assert the container cannot scroll on the unfixed code, then that it can after removing the trap.

**Expected Counterexamples**: input value truncated to one char with focus lost (CC-1); toast z-index ≤ modal (CC-4); thrown ReferenceError (8.7); API called on every filter click (8.1); quantity > available (11.2); divergent container width / mismatched heading gradients across legal pages (26.x); bottom-nav above the visual-viewport bottom while keyboard is open (8.13); the filter's Apply/Show-Results control covered by the fixed bottom nav (32.1); event-create content width exceeding the viewport (35.1); a page that cannot scroll because a wrapper has an `overflow: hidden` / `100vh` trap (38.1).

### Fix Checking

**Goal**: For all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```
Concretely: focus retained (P1); computed font ≥16px on coarse pointer (P2); body locked while modal open (P3); toast z > modal z (P4); filter calls == show-results clicks (P5); out-of-range guests rejected (P6); phone stripped to digits (P7); quantity ≤ available + disabled at max (P8); revenue == Σ(booked×price), ₹0 when none, "from ₹min onwards" (P9); out-of-window discount dates rejected (P10); invalid maps link rejected (P11); conversation bound to inquiry (P12); all five legal pages share the standard container width + one heading style (P13); bottom nav stays at/below the visual-viewport bottom or hidden while the keyboard is open (P14); admin card centered on both axes across breakpoints (P15); the venues filter's Apply/Show-Results control clear of the fixed bottom nav (P17); event-create content width ≤ viewport width (P18); trapped scroll containers become vertically scrollable (P19).

### Preservation Checking

**Goal**: For all inputs where the bug condition does NOT hold, the fixed function equals the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```
**Testing Approach**: Property-based testing for the invariant fixes (quantity, dates, phone, filter, guests, maps link) — generate many inputs across the domain and assert the non-buggy branch is unchanged. Observe non-buggy behavior on unfixed code first, then lock it in.

**Test Cases**:
1. Typing into an already-correct input still records all characters (CC-1 preservation).
2. With no modal open, `document.body` stays scrollable and a toast keeps its normal bottom-right z-order (CC-3/CC-4 preservation).
3. Below-max "+" still increments; in-window discount dates and valid phone digits and valid URLs are still accepted (P8/P10/P7/P11 negative branch).
4. "Show Results" still returns filtered venues; desktop (fine-pointer) inputs keep their existing sub-16px type (P5/P2 preservation).
5. Legal-page body text/`<section>` content is byte-for-byte unchanged after the container/heading edit (27.1); with no keyboard open the bottom nav stays pinned at the viewport bottom (9.8); admin login fields, validation, and submit/navigate behavior are unchanged (30.1).

### Unit Tests
- z-index ordering audit (toast > modal); phone sanitizer digits-only; guest-capacity range check; revenue/lowest-tier computation; discount date-window check; maps-link URL validator (client + server).
- Legal pages (25.x/26.x): render each of the five pages; assert the `<main>` container width matches the site standard and all `<h1>`s use the same heading class; assert body text is unchanged (27.1).
- Admin auth (29.1): render `Login.jsx`; assert the card container has both-axis centering (`min-h-screen`/`items-center`/`justify-center`) and that fields/validation are present unchanged (30.1). Uses the admin project's vitest + RTL.
- Layout/overflow (32.1/35.1/38.1): render the venues filter open on mobile and assert its Apply/Show-Results control is not covered by the fixed nav (P17); render the event-creation UI on mobile and assert content width ≤ viewport width (P18); render a page with a trapping wrapper and assert it becomes vertically scrollable once the trap is removed (P19). Desktop preservation asserted alongside (33.1/36.1/39.1).

### Property-Based Tests (fast-check)
- P5 filter: for any interaction sequence, `apiCalls == showResultsClicks`.
- P6 guests: for any `(min, max, guests)`, accepted iff `min ≤ guests ≤ max`.
- P7 phone: for any string, output is digits-only and all-digit inputs are unchanged.
- P8 quantity: for any `(available, clicks)`, resulting qty ≤ available.
- P9 revenue: for any tiers, revenue == Σ(booked×price) and display is "from ₹min onwards".
- P10 dates: for any `(eventStart, eventEnd, validFrom, validUntil)`, rejected iff out of window.
- P11 maps link: for any string, accepted iff valid URL.

### Integration Tests
- Full venue booking: fill required fields → proceed → calendar in popup → submit → success toast above modal, no ReferenceError, background not scrolled.
- Full event ticket booking: select tier, cap quantity at available, see toast above modal.
- Chat bound to inquiry: submit/open an inquiry → open conversation → send/list messages → conversation bound to the inquiry reference; existing Conversation/Message data preserved.
- Delete account: settings action → confirm modal → `DELETE /api/users/me` → account removed.
- Venues keyboard (8.13): focus a venues-page form input → simulate keyboard open by shrinking `window.visualViewport.height` and firing its `resize` event → assert the bottom nav's top edge ≤ visual-viewport height (or nav hidden); restore height → assert nav pinned as before (9.8). Interaction test via vitest + RTL asserting on the visual-viewport offset.
- Venues filter vs bottom bar (32.1): open the filter on a mobile viewport → assert the Apply/Show-Results control is reachable and not covered by the fixed nav (layered above, or nav hidden while open) → on a desktop viewport assert the filter renders as today with no overlap (33.1).
- Event-create overflow (35.1): render the event-creation UI (and the responsive stepper modal from 11.12/11.13) on a mobile viewport → assert content width ≤ viewport width with no horizontal overflow → on desktop assert it renders within its container as today (36.1).
- Cross-platform scroll (38.1): render a representative client and admin page whose content exceeds the viewport → assert vertical scrolling works with no height/overflow trap → assert a page that already scrolled continues to (39.1), and that the shared `<Modal>` still locks/releases body scroll correctly (CC-3 not regressed).
