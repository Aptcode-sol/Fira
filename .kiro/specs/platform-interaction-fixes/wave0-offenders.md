# Wave 0 — Offender Discovery (Task 0)

**Status:** Discovery only. **NO code changes were made.** This is the authoritative offender reference that Waves 2–3 consume. All line numbers are from the current working tree at discovery time; re-confirm before editing.

**Method:** `grep_search` / `file_search` / targeted reads across `client/src/**` and `admin/src/**`. Every hit was judged in context (a legitimate shared-`<Modal>` lock or a decorative absolute-positioned element is NOT an offender).

> **Headline correction to the design's assumptions.** Three presumed root causes were NOT found in the current code:
> 1. **CC-1 nested-component remount** — no component/element definitions nested inside another component's render body were found in the named files (or anywhere). The named inputs are plain inline JSX with stable structure.
> 2. **8.7 `booker` ReferenceError** — no `booker` symbol is referenced anywhere in `client/src` or `admin/src`. The venue booking submit path already uses `user`.
> 3. **CC-3 overscroll-chaining** — already globally contained in `globals.css` for *all* `.fixed.inset-0` overlays, not just the shared `<Modal>`.
>
> These change what Wave 1 exploration tests (task 1) will observe: the CC-1 and booker exploration tests will likely **pass on unfixed code** (bug not reproducible as specified). See per-section notes.

---

## CC-1 — Focus loss on keystroke (Requirements 1.1, 1.2 / 2.1, 2.2)

**Root-cause search results:**
- Nested JSX-returning `function X()` inside a component body: **none** (`^\s{4,}function [A-Z]` → 0 hits).
- Nested JSX-returning `const X = () =>` inside a component body: **none** (all indented `const X = () =>` hits are event handlers / effect callbacks / formatters, not components).
- Unstable keys (`key={Math.random()}` / `Date.now()`): **none**.

**Confirmed non-offenders (the three "known offenders" from the design):**

| File | Lines | Finding |
|------|-------|---------|
| `client/src/components/InquiryForm.tsx` | 17–120 | Uses top-level `Input` from `@/components/ui`; inputs are inline JSX; no nested component. Controlled `onChange` at L98/L108/L118/L129. **Not a CC-1 offender.** |
| `client/src/app/venues/[id]/page.tsx` | 899–968 | Booking modal fields (Start/End date L905–922, times L928–950, Expected Guests L950–962, Purpose L963–972) are all inline JSX inside the parent `return`, not a per-render sub-component. Controlled `onChange` → `setBookingData`. **Not a CC-1 offender.** |
| `client/src/components/modals/CreatePostModal.tsx` | 14–132 | `content` textarea at L128–133 is inline JSX; `handleImageChange`/`removeImage` are handlers, not components. **Not a CC-1 offender.** |

**What the later fix (task 4.1) should do:** Because the remount root cause is absent, task 4 should **first re-run the exploration test to confirm whether focus loss reproduces at all**. If it does NOT reproduce, treat CC-1 as already-satisfied (verify + add regression guard only) rather than hoisting anything. If it DOES reproduce, the cause is elsewhere (parent list `key` churn, a `React.memo`/state-reset higher up, or a controlled-value round-trip that changes identity) — locate the actual remount source before editing. Do not hoist code that isn't nested.

**Controlled-input inventory (for regression coverage, not offenders):** `InquiryForm.tsx` L98/108/118/129; `venues/[id]/page.tsx` L906/919/931/941/955/966 (booking) + L752 (review); `CreatePostModal.tsx` L129; plus `PostCard.tsx` L264, `LocationFilter.tsx` L133, `CitySelector.tsx` L84, `Select.tsx` L116, `FilterPanel.tsx` L136, `CancellationModal.tsx` L183, `dashboard/DiscountCodesSection.tsx` L280–420.

---

## CC-2 — Mobile auto-zoom / sub-16px inputs (Requirements 1.3, 1.4 / 2.3, 2.4)

**Single lever confirmed.** The global rule is the only mechanism and it is correct:

| File | Lines | Finding |
|------|-------|---------|
| `client/src/app/globals.css` | 56–62 | `@media (pointer: coarse)` forces `font-size: 16px` on `input:not([checkbox]):not([radio])`, `select`, `textarea`. L52–55 sets `text-size-adjust: 100%`. **This is the single CC-2 source.** |
| `client/src/app/layout.tsx` | 106–111 | `viewport` = `{ width: 'device-width', initialScale: 1 }` — no `maximum-scale` / `user-scalable=no`. Pinch-zoom preserved (satisfies 3.3). |

**Bypass search:** inline `style={{ fontSize ... }}` on controls → **0 hits**. `contentEditable` controls → **0 hits** (nothing escapes the input/select/textarea selector).

**What the later fix (task 6.1) should do:** No per-page diff needed. Add the `ponytail:` comment marking the global rule as the single CC-2 source. The rule already covers every editable control; there is no bypass to patch.

---

## CC-3 — Scroll-chaining / body-scroll-lock (Requirements 1.5, 1.6 / 2.5, 2.6)

**Body-scroll-lock owner (the only correct one):**

| File | Lines | Finding |
|------|-------|---------|
| `client/src/components/ui/Modal.tsx` | 68–84 | Sole owner of `document.body.style.overflow` (`'hidden'` on open, `'unset'` on cleanup). No other file locks body scroll. |

**Overscroll-chaining: already globally handled** (design assumed only `<Modal>` had it):

| File | Lines | Finding |
|------|-------|---------|
| `client/src/app/globals.css` | 420–434 | Global rules apply `overscroll-behavior: contain` to `.fixed.inset-0` and its `.overflow-y-auto`/`.overflow-y-scroll` scroll regions — covers **all** hand-rolled overlays, current and future. L517–520 adds `overscroll-behavior-y: none` on html/body. |

**Hand-rolled `fixed inset-0` overlays that do NOT use `<Modal>` (so they get overscroll-contain from globals.css but NO body-scroll-lock):**

| File | Line | Note |
|------|------|------|
| `client/src/app/dashboard/venues/[id]/page.tsx` | 580 | Cancel-confirm overlay — migrate to `<Modal>` for body lock. |
| `client/src/app/dashboard/venues/page.tsx` | 589, 844, 1056 | Edit / availability / cancel overlays. |
| `client/src/app/dashboard/tickets/page.tsx` | 281 | Ticket-details overlay. |
| `client/src/app/dashboard/requests/page.tsx` | 491 | Rejection overlay. |
| `client/src/app/dashboard/page.tsx` | 482 | Following-brands overlay. |
| `client/src/app/dashboard/creator/page.tsx` | 785 | Post overlay. |
| `client/src/app/dashboard/brand/page.tsx` | 753 | Post overlay. |
| `client/src/components/modals/CreatePostModal.tsx` | 82 | `z-50` overlay, hand-rolled (also below Modal — see CC-4 note). |
| `admin/src/pages/Events.jsx` | 485 | Rejection overlay (admin). |

**What the later fix (task 5.1) should do:** These stragglers already contain scroll (globals.css). The remaining gap is body-scroll-lock — migrate each to the shared `<Modal>` where practical so the body lock/restore applies; otherwise they are acceptable for overscroll but the background can still scroll. Prioritize the ones most likely to overflow (dashboard edit/availability at `dashboard/venues/page.tsx` L589/L844). Do NOT touch the `<Modal>` lock or the globals.css rules — they are the contract.

---

## CC-4 — Toast behind modal (Requirements 1.7 / 2.7)

**Single change confirmed:**

| File | Line | Current | Needed |
|------|------|---------|--------|
| `client/src/components/ui/Toast.tsx` | 64 | `ToastContainer` = `fixed bottom-4 right-4 z-50` | raise to `z-[100]` |

**Layer audit (why `z-50` is the bug):** Navbar `z-50`; side drawer `z-[60]` (`Navbar.tsx` L429); shared `<Modal>` `z-[70]` (`Modal.tsx` L106); `FilterPanel` mobile overlay `z-[80]` (`FilterPanel.tsx` L268); `Select` listbox `z-[100]` (`Select.tsx` L108). Toast at `z-50` sits at/under everything, so it is hidden behind any open modal (`z-[70]`) or filter (`z-[80]`).

**What the later fix (task 3.1) should do:** Single edit — `z-50` → `z-[100]` on the toast container. Note `Select.tsx` also uses `z-[100]`; a toast and an open select dropdown would tie, but they don't co-occur meaningfully. Add the `ponytail:` comment naming the global layer order as the ceiling.

---

## 8.7 — `booker` ReferenceError (Requirement 8.7)

**NOT REPRODUCIBLE in current code.**

- `\bbooker\b` (case-sensitive) across `client/src` + `admin/src` + `server/src` → **0 hits.**
- `booker` appears **only** in `server/services/bookingService.js` (L86–155) and `server/services/emailService.js` (L275–290), where it is a **properly declared** local (`const booker = await User.findById(...)`). Not a bug, server-side, out of this spec's client scope.
- `client/src/app/venues/[id]/page.tsx` `submitBooking` (L210–300) uses `user._id` / `user.name` — no `booker` reference. The guard `if (!venue || !user) return;` (L211) prevents undefined-user throws.
- Booker labels in `client/src/app/venue-portal/bookings/page.tsx` (L254–259) use `booking.user?.name` (correct, optional-chained).

**What the later fix (task 8.2) should do:** There is nothing to fix. The Wave 1 exploration test for 8.7 will **pass on unfixed code** (no `ReferenceError`). Flag this to the user per the bugfix "unexpected pass" path when task 1 runs — the bug appears already resolved or was mislocated. Do not invent a `booker` reference to "fix."

---

## Scroll traps (Requirement 38.1 — feeds task 20.1)

**Method:** grep `overflow-hidden`/`overflow: hidden`, `100vh`, `h-screen`/`min-h-screen`, `document.body.style.overflow` across `client/src` + `admin/src`, judged in context.

**Benign (NOT traps — do not touch):**
- `min-h-screen` on page/section wrappers (Hero, PartiesSection, CTASection, dashboards, venue pages, etc.) — these grow with content, they don't cap height.
- `100vh`/`120vh` on decorative light-ray beams (`PartyBackground.tsx`, `DashboardLayout.tsx` L175–183, `VenueDashboardLayout.tsx` L155–161, admin `Login.jsx` L53–59, `AdminDashboardLayout.jsx` L196–202) — absolute-positioned, `pointer-events-none`, inside `overflow-hidden` decorative containers. Benign.
- `overflow-hidden` on cards/avatars/images/skeletons (VenueCard, PostCard, UpcomingEvents, Skeleton, admin tables) — intentional corner clipping.
- `.party-bg` `position: fixed; height: 100%; overflow: hidden` (`globals.css` L205–214, `admin/src/index.css`) — `z-index: -1` decorative base. Benign.
- `globals.css` L65–75: `html`/`body` `overflow-x: clip`/`hidden` + `max-width: 100vw` — horizontal-overflow guard only; vertical scroll unaffected. Keep.

**Body-scroll-lock outside `<Modal>`:** none found — `Modal.tsx` L69/L82 is the sole `document.body.style.overflow` writer. No orphaned lock to release. ✅

**Candidate traps to judge in context during task 20.1 (height + overflow on a content container):**

| File | Line | Note for fixer |
|------|------|----------------|
| `client/src/app/inbox/page.tsx` | 493 (commented), 525 | Active chat list uses `flex-1 overflow-y-auto` (L525) inside a `min-h-screen` page (L325) — verify the flex parent gives it a bounded height; a commented full-screen `fixed inset-0 z-50 ... flex flex-col` block (L493) suggests a prior full-height chat layout. Confirm the live path scrolls on mobile. |
| `client/src/app/messages/page.tsx` | 208–333 | **Entire page is commented out** (`//`), including `calc(100vh - 200px)` grid + `overflow-y-auto h-[calc(100%-60px)]`. Dead code — if messages is re-enabled (task for chat restore), rebuild with `dvh` not `100vh`. Not a live trap today. |
| `admin/src/index.css` | 54–67 | `.party-bg`/rays `height: 100vh` — decorative; switch to `dvh` only if a real trap is proven (low priority). |

**What the later fix (task 20.1) should do:** No live ordinary-page scroll trap was found in the current tree (the classic offenders — full-height `overflow-hidden` content wrappers, orphaned body locks — are absent). The audit's main deliverables: (1) confirm the inbox live chat scrolls on mobile (`inbox/page.tsx` L525 bounded-height check); (2) if/when `messages/page.tsx` is re-enabled, use `dvh` instead of `100vh`; (3) leave all decorative `100vh`/`min-h-screen`/`overflow-hidden` and the `globals.css` horizontal guard untouched. Prefer natural document scroll — it already dominates.

---

## 32.1 — Venues filter vs bottom nav (referenced; owned by task 8.8)

| File | Line | Finding |
|------|------|---------|
| `client/src/components/ui/FilterPanel.tsx` | 268 | Mobile filter overlay already at `z-[80]`, centered `fixed inset-0` — above navbar (`z-50`/`z-[60]`). If the venues page uses `FilterPanel`, 32.1 is largely handled. |
| `client/src/components/LocationFilter.tsx` | 55–136 | Hand-rolled dropdown (not `FilterPanel`), no `z-[80]`, no bottom-nav padding — **this is the likely 32.1 offender** if the venues page uses `LocationFilter`. Task 8.8 should confirm which component the venues filter renders and layer/pad it above the nav. |

---

## Confirmation

**No code changes were made in Task 0.** All actions were read-only searches and file reads. This document is a discovery artifact for Waves 1–3.
