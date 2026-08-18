# Implementation Plan: UI/UX Responsive Validation

## Overview

Surgical fix pass across Client (Next.js) and Admin (Vite/React) apps to eliminate horizontal overflow, fix mobile nav clearances, contain decorative elements, and ensure both layouts hold at all viewport widths. CSS-level and minimal component-level changes only — no new dependencies, no new abstractions.

## Tasks

- [x] 1. CSS Overflow Prevention and Legacy Cleanup (Wave 0)
  - [x] 1.1 Add viewport overflow containment to Client app
    - Add `max-width: 100vw` to the existing `body` rule in `client/src/app/globals.css`
    - Add `#__next { max-width: 100vw; overflow-x: clip; }` rule
    - Keep existing `overflow-x: hidden` on body as fallback for older browsers
    - _Requirements: 1.1, 1.3, 1.5_

  - [x] 1.2 Add viewport overflow containment to Admin app
    - Add `max-width: 100vw` to the existing `body` rule in `admin/src/index.css`
    - Add `#root { max-width: 100vw; overflow-x: clip; }` rule
    - Keep existing `overflow-x: hidden` on body as fallback for older browsers
    - _Requirements: 1.2, 1.4, 1.6_

  - [x] 1.3 Delete legacy Sidebar.jsx
    - Delete `admin/src/components/Sidebar.jsx` (orphaned, 316 lines, no imports reference it)
    - Verify no remaining imports or references exist in the admin codebase
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 2. Admin Sidebar Mobile Fix and Input Containment (Wave 1)
  - [x] 2.1 Fix Admin Sidebar rail visibility on mobile
    - In `admin/src/components/AdminDashboardLayout.jsx`, change collapsed sidebar width from `w-[68px]` to `w-0 overflow-hidden lg:w-20 lg:overflow-visible`
    - Change main content margin from `ml-[68px]` to `ml-0 lg:ml-20` when sidebar is collapsed
    - _Requirements: 2.1, 2.3_

  - [x] 2.2 Add hamburger toggle button for mobile sidebar
    - Add a floating toggle button (`fixed top-4 left-4 z-50`) visible only on mobile when sidebar is closed
    - Include accessible hamburger icon with `aria-label="Open navigation"`
    - Ensure existing backdrop dismiss behavior remains functional
    - _Requirements: 2.1, 2.2_

  - [x] 2.3 Add global form input containment to both apps
    - Add `input, select, textarea, button { max-width: 100%; }` to `client/src/app/globals.css`
    - Add `input, select, textarea, button { max-width: 100%; }` to `admin/src/index.css`
    - _Requirements: 6.1, 6.2_

  - [x] 2.4 Add decorative element containment
    - Add `.nav-lamp-light, .party-bg { contain: strict; }` to `client/src/app/globals.css`
    - Add equivalent containment rule to `admin/src/index.css` if decorative classes exist there
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 3. Card Grid and Content Max-Width (Wave 2)
  - [x] 3.1 Replace fixed card grid columns with auto-fill pattern in Client
    - In `client/src/components/city/CityListingGrid.tsx`, replace `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` with `grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]`
    - Apply same pattern to `client/src/components/PartiesSection.tsx` if it uses fixed grid columns
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 3.2 Replace fixed card grid columns with auto-fill pattern in Admin
    - Apply `grid-cols-[repeat(auto-fill,minmax(250px,1fr))]` to card grids in `admin/src/pages/Dashboard.jsx`
    - Apply to any other admin pages (Venues, Events, Brands, Users) that use fixed column grids
    - _Requirements: 5.3_

  - [x] 3.3 Add content max-width constraint for ultrawide viewports
    - Add `@media (min-width: 1440px) { main:not(.full-bleed) { max-width: 1440px; margin-inline: auto; } }` to `client/src/app/globals.css`
    - Add `@media (min-width: 1440px) { main { max-width: 1440px; } }` to `admin/src/index.css` (no centering — admin has sidebar margin)
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 4. Verification Checkpoint (Wave 3)
  - [x] 4.1 Verify bottom navigation clearance (Req 3)
    - Confirm `body { padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px)); }` exists at `max-width: 767px`
    - Confirm DashboardLayout uses `pb-20 lg:pb-0` on mobile
    - Confirm Bottom_Nav z-index does not conflict with modals
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Verify Dynamic Island and top bar clearance (Req 4)
    - Confirm public pages use `pt-28` (112px) which clears the Dynamic Island at `top-4` (~56px)
    - Confirm dashboard pages use their own top padding appropriate to their fixed header
    - Confirm no interactive elements are obscured beneath the Dynamic Island
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.3 Verify fixed element stability (Req 10)
    - Confirm `.mobile-fixed-bar` class includes `will-change: transform`, `transform: translateZ(0)`, `backface-visibility: hidden`
    - Confirm `overscroll-behavior-y: none` is set on `html, body` at mobile breakpoint
    - Confirm both Bottom_Nav and Dynamic_Island divs have `mobile-fixed-bar` class applied
    - _Requirements: 10.1, 10.2, 10.3_

## Notes

- All changes are CSS-level or minimal JSX class changes — no new dependencies
- Requirements 3, 4, and 10 are verification-only (existing implementation is correct)
- The only file deletion is `admin/src/components/Sidebar.jsx` (confirmed orphaned)
- Total estimated diff: ~50 lines added, ~316 lines deleted (net reduction)
- `overflow-x: clip` is used over `hidden` because it doesn't create a new scroll context (safe for fixed/sticky children)
- `contain: strict` on decorative elements guarantees they can never affect document scroll dimensions

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"], "description": "Independent — can run in parallel" },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"], "description": "Depends on wave 0 (overflow containment in place first)" },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"], "description": "Depends on wave 1 (inputs contained, sidebar fixed)" },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3"], "description": "Verification — confirms existing behavior after all changes" }
  ]
}
```
