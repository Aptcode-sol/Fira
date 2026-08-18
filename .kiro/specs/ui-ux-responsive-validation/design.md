# Design Document: UI/UX Responsive Validation

## Overview

A surgical fix pass across Client (Next.js) and Admin (Vite/React) apps to eliminate horizontal overflow, fix mobile nav clearances, contain decorative elements, and ensure both layouts hold at all viewport widths. No new dependencies, no new abstractions — CSS-level and minimal component-level changes only.

## Architecture

No architectural change. Both apps keep their existing layout hierarchies:

```
Client: <html> → <body> → ClientLayout → Navbar + Page + Footer
  Dashboard pages: DashboardLayout (fixed sidebar + main)
  Public pages: Navbar (floating desktop / Dynamic Island mobile) + content + Footer

Admin: <html> → <body> → AdminDashboardLayout (fixed sidebar + main)
```

All fixes live within existing files. The only file deletion is `admin/src/components/Sidebar.jsx` (orphaned legacy).

---

## Requirement 1: Viewport Overflow Prevention

**Files modified:**
- `client/src/app/globals.css`
- `admin/src/index.css`

**Current state:**
Both apps already have `overflow-x: hidden` on `body`. This hides symptoms but doesn't prevent the underlying cause (elements wider than viewport).

**Changes:**

```css
/* globals.css / index.css — add to the existing `body` rule */
body {
  /* existing */
  overflow-x: hidden;
  /* add */
  max-width: 100vw;
}
```

Additionally, add a containment rule for the root layout wrapper:

```css
/* Both apps — new rule */
#__next, #root {
  max-width: 100vw;
  overflow-x: clip;
}
```

**Why `overflow-x: clip` over `hidden`:** `clip` doesn't create a new scroll context, so sticky/fixed children aren't affected. `hidden` on a non-body element can break fixed positioning in some browsers.

**Interaction with existing code:** The existing `overflow-x: hidden` on body stays as a fallback for older browsers. The `max-width: 100vw` prevents any child from pushing the body wider in the first place.

**Trade-offs:** `overflow-x: clip` is not supported in IE11 (irrelevant for this project). Safari 16+ supports it.

---

## Requirement 2: Admin Sidebar Containment

**File modified:** `admin/src/components/AdminDashboardLayout.jsx`

**Current state:**
On mobile (`< 1024px`), the sidebar still renders as a 68px-wide rail (`w-[68px]`). The main content has `ml-[68px]`, leaving only ~252px of content space on a 320px phone. The `isExpanded` toggle opens a full-width overlay but the rail is always present.

**Changes:**

1. **Hide the rail on mobile.** Change sidebar width class:
   ```
   Before: isOpen ? 'w-64' : 'w-[68px] lg:w-20'
   After:  isOpen ? 'w-64' : 'w-0 lg:w-20'
   ```

2. **Hide sidebar completely when collapsed on mobile** — add `overflow-hidden` when `w-0`:
   ```jsx
   className={`... ${isOpen ? 'w-64' : 'w-0 overflow-hidden lg:w-20 lg:overflow-visible'}`}
   ```

3. **Show a floating toggle button on mobile when sidebar is closed:**
   ```jsx
   {isMobile && !isOpen && (
     <button
       onClick={() => setIsExpanded(true)}
       className="fixed top-4 left-4 z-50 p-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-full text-gray-400 hover:text-white"
       aria-label="Open navigation"
     >
       {/* hamburger SVG — reuse existing getIcon or inline */}
       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
       </svg>
     </button>
   )}
   ```

4. **Main content margin on mobile becomes 0:**
   ```
   Before: !isMobile && isExpanded ? 'ml-64' : 'ml-[68px] lg:ml-20'
   After:  !isMobile && isExpanded ? 'ml-64' : 'ml-0 lg:ml-20'
   ```

5. **Backdrop already exists** for `isMobile && isExpanded` — no change needed there.

**Interaction:** The existing `isMobileSidebarOpen`, `isClosing`, and `isAnimating` states become unused (they were from a prior approach). They can be left or removed — removing is cleaner but not blocking.

**Trade-off:** The admin mobile experience now requires one tap to access nav (matches the client app's hamburger pattern). Previously the rail was always visible but nearly unusable at 68px on small screens.

---

## Requirement 3: Mobile Bottom Navigation Clearance

**File modified:** `client/src/app/globals.css`

**Current state:**
```css
@media (max-width: 767px) {
  body {
    padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
  }
}
```

This already handles the general case. The Bottom_Nav in `Navbar.tsx` is `fixed bottom-0` with `pb-[env(safe-area-inset-bottom)]` on the nav itself.

**Verification needed / no change required:**
- The body padding-bottom (5rem = 80px) exceeds the nav height (~72px including safe area). Content is cleared.
- Footers render inline in the document flow, ABOVE the body padding — they're already above the Bottom_Nav.
- The `DashboardLayout` main uses `pb-20 lg:pb-0` which provides 80px on mobile — consistent.

**Edge case — modals:** Client modals (CreatePostModal, etc.) use `fixed inset-0 z-[60]` positioning which naturally sits above the Bottom_Nav (z-50). No additional fix needed.

**Change (hardening only):**
```css
/* Add comment and explicit min-value to prevent future regressions */
@media (max-width: 767px) {
  body {
    /* Bottom nav is ~72px + safe-area. 5rem (80px) guarantees clearance. */
    padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
  }
}
```

No CSS change — verification pass only.

---

## Requirement 4: Dynamic Island and Top Bar Clearance

**Files affected:**
- Public pages already use `pt-28` (112px) which clears the Dynamic Island (fixed at `top-4`, roughly 48px tall including padding) ✓
- Dashboard pages use `pt-16` (64px) — the dashboard has its OWN top bar, not the Dynamic Island, so this is correct ✓

**Current state of Dynamic Island:**
```html
<div class="mobile-fixed-bar fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[70%] md:hidden">
```
Height: `py-2` (8px×2) + content (~24px icon) = ~40px. At `top-4` (16px), it occupies 16–56px from top.

**Public pages** use `pt-28` (112px) — more than enough clearance.

**Problem area:** The `inbox/page.tsx` uses `pt-20` (80px) which is fine. But the DashboardLayout uses `pt-16` (64px) on mobile — the dashboard doesn't show the Dynamic Island (it has its own sidebar-integrated header on desktop, and on mobile the dashboard sidebar toggle sits at the top).

**Verification result:** No change needed. The Dynamic Island is only rendered on public pages (via Navbar component which conditionally shows it). Dashboard pages have their own fixed top elements with appropriate padding.

**No CSS change required** — the existing padding values already clear the fixed top bars.

---

## Requirement 5: Card Grid Responsiveness

**Files modified:**
- `client/src/components/city/CityListingGrid.tsx`
- `client/src/components/PartiesSection.tsx`
- Any other component using `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

**Current state:**
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
```

At `sm` (640px) with 2 columns and `gap-6` (24px): each card = (640 - 24) / 2 = 308px — fine.
At `lg` (1024px) with 4 columns: each card = (1024 - 72) / 4 = 238px — below 250px minimum.

**Change:** Replace fixed column counts with CSS Grid `auto-fill` + `minmax`:

```html
<div class="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
```

This uses Tailwind's arbitrary value syntax. The grid will:
- Show 1 column below `sm` (640px)
- Auto-fill as many 250px+ columns as fit above `sm`
- At 1024px: fits 3 columns (not 4), each ~317px
- At 1280px: fits 4 columns, each ~295px

**Admin grids:** The admin uses similar patterns in Dashboard.jsx and list pages. Apply the same `auto-fill` pattern.

**Files to update in admin:**
- `admin/src/pages/Dashboard.jsx` (stat cards)
- `admin/src/pages/Venues.jsx`, `Events.jsx`, `Brands.jsx`, `Users.jsx` (if they have card grids)

**Trade-off:** Loses the hard 4-column layout at `lg`. Gains guaranteed 250px minimum card width at ALL viewports. The visual difference is negligible on most screens.

---

## Requirement 6: Form and Input Containment

**Files modified:** (CSS-level fix, no per-file changes needed)
- `client/src/app/globals.css`
- `admin/src/index.css`

**Change — add global input containment:**

```css
/* Both apps — add after the * { box-sizing } rule */
input, select, textarea, button {
  max-width: 100%;
}
```

**Modals:** Client modals already use `fixed inset-0` with inner content like `max-w-md mx-auto px-4`. The `px-4` provides 16px per side. Verify all modals have at minimum `px-4` on mobile.

**Admin modals:** Admin doesn't have a modal system currently (detail pages are full-page routes). No change needed.

**Dropdowns/selects:** Native selects inherit `max-width: 100%` from the rule above. Custom dropdowns (if any) would need `max-width: 100%; overflow-x: auto` on their container — but the codebase uses native selects.

**Trade-off:** None. This is purely defensive — prevents any future input from overflowing.

---

## Requirement 7: Decorative Element Containment

**Files modified:** None (verification only)

**Current state:**
- Light rays container in AdminDashboardLayout:
  ```html
  <div class="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
  ```
- `.party-bg` class: `position: fixed; overflow: hidden;`
- `.nav-lamp-light`: `position: relative; width: 100vw; height: 100vh; pointer-events: none;`

**Analysis:**
- `fixed` elements with `w-full h-full` don't extend document dimensions ✓
- `overflow-hidden` on the container clips any children that exceed bounds ✓
- `pointer-events: none` prevents interaction interference ✓
- The `100vw` width on `.nav-lamp-light` is inside a `fixed overflow-hidden` parent, so it can't cause scrollbars ✓

**Hardening change (defensive):** Add to both CSS files:

```css
.nav-lamp-light,
.party-bg {
  /* Defensive: ensure these never contribute to scroll dimensions */
  contain: strict;
}
```

`contain: strict` tells the browser this element's rendering is fully independent — it can never affect layout outside itself. This is the strongest guarantee that decorative elements won't cause overflow.

**Trade-off:** `contain: strict` gives the element a fixed size (0×0 unless explicitly sized). Since `.party-bg` has explicit `width: 100%; height: 100%` and is `position: fixed`, this is safe. `.nav-lamp-light` has `width: 100vw; height: 100vh`, also safe.

---

## Requirement 8: Content Max-Width on Large Screens

**Files modified:**
- `client/src/app/globals.css`
- `admin/src/index.css`

**Current state:** Individual pages use `max-w-6xl` or `max-w-7xl` (1152px / 1280px) on their content wrappers. But this is inconsistent — some pages don't apply it.

**Change — add a global content constraint via CSS rather than touching every page:**

For the **client**, add to `globals.css`:

```css
/* Ultrawide content constraint — Requirement 8 */
@media (min-width: 1440px) {
  main:not(.full-bleed) {
    max-width: 1440px;
    margin-inline: auto;
  }
}
```

For the **admin**, add to `index.css`:

```css
@media (min-width: 1440px) {
  main {
    max-width: 1440px;
    /* Don't center — admin main already has left margin from sidebar */
  }
}
```

**Full-bleed backgrounds:** The existing `party-bg` and light rays are `position: fixed` and cover the full viewport regardless of main content width. No additional work needed — backgrounds remain full-bleed behind the constrained content.

**Interaction with existing code:**
- Pages that already have `max-w-7xl mx-auto` (1280px) will be unaffected since 1280 < 1440.
- The admin's `main` has `ml-[68px] lg:ml-20` or `ml-64` — the max-width applies to the content box AFTER the margin, which is correct.

**Trade-off:** The 1440px breakpoint means content stays full-width between 1280px and 1440px. This is intentional — the existing page max-widths (6xl/7xl) already constrain text readability below 1440px.

---

## Requirement 9: Legacy Sidebar Cleanup

**File deleted:** `admin/src/components/Sidebar.jsx`

**Current state:** The file exists (316 lines) but is NOT imported anywhere in the admin app. `App.jsx` uses `AdminDashboardLayout` exclusively. The file is dead code.

**Change:** Delete `admin/src/components/Sidebar.jsx`.

**Interaction:** Zero. No imports reference it. `git grep` confirms no usage.

**Trade-off:** None. Pure deletion of orphaned code.

---

## Requirement 10: Fixed Element Stability

**Files modified:** None (verification only)

**Current state:**
```css
.mobile-fixed-bar {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}
```

Both the Bottom_Nav and Dynamic Island already have class `mobile-fixed-bar` applied. The iOS overscroll fix is also present:

```css
@media (max-width: 767px) {
  html, body {
    overscroll-behavior-y: none;
  }
}
```

**Analysis:**
- `will-change: transform` promotes to compositor layer ✓
- `transform: translateZ(0)` forces GPU compositing ✓
- `backface-visibility: hidden` prevents flicker on transform ✓
- `overscroll-behavior-y: none` prevents iOS rubber-banding ✓

**Verification:** Both fixed bars in `Navbar.tsx` use the `mobile-fixed-bar` class:
- Line 206: Bottom nav div
- Line 384: Dynamic Island div

**No change needed.** The existing implementation already addresses URL bar animation jitter with best-practice compositor promotion.

**Limitation (documented):** The URL bar show/hide animation is a browser behavior that cannot be fully eliminated with CSS. The compositor promotion reduces lag to near-zero but 1-2 frame delays are inherent to the platform. This comment is already documented in `globals.css`.

---

## Summary of Changes

| Req | File(s) | Type | Diff Size |
|-----|---------|------|-----------|
| 1 | globals.css, index.css | CSS add | ~4 lines each |
| 2 | AdminDashboardLayout.jsx | JSX/class tweak | ~15 lines changed |
| 3 | globals.css | Verify only | 0 lines |
| 4 | — | Verify only | 0 lines |
| 5 | CityListingGrid.tsx, PartiesSection.tsx, admin pages | Class change | ~1 line per file |
| 6 | globals.css, index.css | CSS add | ~3 lines each |
| 7 | globals.css, index.css | CSS add (defensive) | ~4 lines each |
| 8 | globals.css, index.css | CSS add | ~5 lines each |
| 9 | Sidebar.jsx | Delete | -316 lines |
| 10 | — | Verify only | 0 lines |

**Total estimated diff:** ~50 lines added, ~316 lines deleted. Net reduction.

## Correctness Properties

*Properties that should hold true across all valid viewport states after these changes.*

### Property 1: No horizontal overflow at any viewport width

*For any* viewport width between 320px and 3840px, the document's `scrollWidth` SHALL equal its `clientWidth` (no horizontal scrollbar present).

**Validates: Requirements 1.1, 1.2, 1.5, 1.6**

### Property 2: Admin sidebar does not reduce content area below usable width on mobile

*For any* viewport width below 1024px with the admin sidebar closed, the main content area SHALL occupy 100% of the viewport width (margin-left = 0).

**Validates: Requirements 2.1, 2.3**

### Property 3: Bottom content is never obscured by fixed bottom nav

*For any* page in Client_App on a viewport below 768px, the last visible content element's bottom edge SHALL be at least 80px above the viewport bottom (accounting for the fixed bottom nav height + safe area).

**Validates: Requirements 3.1, 3.4**

### Property 4: Card minimum width is maintained

*For any* grid of cards rendered in Client_App or Admin_App at any viewport width ≥ 640px, each card's rendered width SHALL be ≥ 250px.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: Form inputs never exceed container width

*For any* input, select, or textarea element in either app, its rendered width SHALL be ≤ its parent container's width.

**Validates: Requirements 6.1, 6.2**

### Property 6: Decorative elements never extend document dimensions

*For any* element with class `party-bg` or `nav-lamp-light`, its contribution to the document's scroll width and scroll height SHALL be zero.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 7: Content max-width on ultrawide

*For any* viewport width > 1440px, the main content area's rendered width SHALL be ≤ 1440px.

**Validates: Requirements 8.1, 8.2**
