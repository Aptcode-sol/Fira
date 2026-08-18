# Requirements Document

## Introduction

This spec defines the structural correctness fixes needed to ensure both the FIRA Client (Next.js) and Admin (Vite/React) apps render reliably across all supported viewport sizes. The focus is on preventing overflow, fixing widget containment, ensuring nothing crosses screen boundaries, and validating that both desktop and mobile layouts remain intact under real content. This is NOT a redesign — it is a validation and fix pass.

## Glossary

- **Client_App**: The Next.js 16 customer-facing marketplace application (venues, events, creators)
- **Admin_App**: The Vite + React Router 7 admin panel application
- **Viewport**: The visible area of a web page within the browser window
- **Overflow**: Content rendering beyond the visible viewport boundaries causing horizontal scroll or clipping
- **Breakpoint_SM**: Tailwind's `sm` breakpoint at 640px viewport width
- **Breakpoint_MD**: Tailwind's `md` breakpoint at 768px — the mobile/desktop nav split point
- **Breakpoint_LG**: Tailwind's `lg` breakpoint at 1024px — the sidebar collapse threshold
- **Bottom_Nav**: The fixed bottom tab bar shown on mobile viewports (below Breakpoint_MD) in Client_App
- **Dynamic_Island**: The floating top bar on mobile viewports in Client_App containing logo, hamburger, and inbox
- **Admin_Sidebar**: The collapsible sidebar navigation in Admin_App (68-80px collapsed, 240-256px expanded)
- **Light_Rays**: Decorative gradient elements using absolute positioning and large heights for visual effect
- **Safe_Area**: The device-safe viewport area excluding system UI (notch, home indicator, URL bar)
- **Content_Area**: The main scrollable region where page content renders, excluding fixed navigation elements

## Requirements

### Requirement 1: Viewport Overflow Prevention

**User Story:** As a user on any device, I want the page to never scroll horizontally, so that content feels contained and professional.

#### Acceptance Criteria

1. THE Client_App SHALL constrain all page content within the horizontal viewport boundaries without producing a horizontal scrollbar
2. THE Admin_App SHALL constrain all page content within the horizontal viewport boundaries without producing a horizontal scrollbar
3. WHEN a widget or component contains content wider than its container, THE Client_App SHALL clip or wrap that content rather than expanding the viewport
4. WHEN a widget or component contains content wider than its container, THE Admin_App SHALL clip or wrap that content rather than expanding the viewport
5. WHILE the viewport width is 320px or greater, THE Client_App SHALL render all visible elements within the screen width
6. WHILE the viewport width is 320px or greater, THE Admin_App SHALL render all visible elements within the screen width

### Requirement 2: Admin Sidebar Containment

**User Story:** As an admin user on a small mobile device, I want the sidebar not to consume excessive screen space, so that I can still interact with the content area.

#### Acceptance Criteria

1. WHILE the viewport width is below Breakpoint_LG, THE Admin_Sidebar SHALL hide the permanent rail and show only a toggle button to open a full-screen drawer
2. WHEN the Admin_Sidebar drawer is open on mobile, THE Admin_App SHALL display a backdrop overlay that dismisses the drawer on tap
3. WHEN the Admin_Sidebar drawer is closed on mobile, THE Content_Area SHALL occupy the full viewport width
4. WHILE the viewport width is at or above Breakpoint_LG, THE Admin_Sidebar SHALL display the collapsed icon rail (68-80px) with hover-to-peek expansion
5. WHEN the Admin_Sidebar is pinned expanded on desktop, THE Content_Area SHALL offset its left margin by the expanded sidebar width (240-256px)

### Requirement 3: Mobile Bottom Navigation Clearance

**User Story:** As a mobile user, I want page content to never be hidden behind the bottom navigation bar, so that I can read and interact with everything on the page.

#### Acceptance Criteria

1. WHILE the Bottom_Nav is visible, THE Client_App SHALL apply bottom padding to all page content sufficient to prevent overlap
2. WHEN a page contains a footer element, THE Client_App SHALL render the footer above the Bottom_Nav with no visual overlap
3. WHEN a modal or overlay is displayed on mobile, THE Client_App SHALL position it above the Bottom_Nav or temporarily hide the Bottom_Nav
4. WHILE the Bottom_Nav is visible, THE Client_App SHALL respect Safe_Area insets on devices with home indicators (iPhone notch area)

### Requirement 4: Dynamic Island and Top Bar Clearance

**User Story:** As a mobile user, I want page content to not be hidden behind the floating top bar, so that I can see the top of every page.

#### Acceptance Criteria

1. WHILE the Dynamic_Island is visible on mobile, THE Client_App SHALL apply top padding to page content sufficient to prevent overlap with the floating top bar
2. WHEN a page scrolls, THE Dynamic_Island SHALL remain fixed at the top without shifting layout of surrounding content
3. WHILE the Dynamic_Island is visible, THE Client_App SHALL ensure no interactive elements are obscured beneath it

### Requirement 5: Card Grid Responsiveness

**User Story:** As a user viewing listings, I want cards to remain readable at all screen sizes, so that text and images are never compressed to an unusable state.

#### Acceptance Criteria

1. WHILE the viewport width is between Breakpoint_SM and Breakpoint_LG, THE Client_App SHALL render grid cards with a minimum width of 250px per card
2. WHEN the viewport width cannot fit the current column count at minimum card width, THE Client_App SHALL reduce the column count rather than compressing cards
3. THE Admin_App SHALL apply the same minimum card width constraint (250px) to all data grid and card layouts
4. WHEN card content exceeds the card boundary, THE Client_App SHALL truncate text with ellipsis and constrain images within card bounds

### Requirement 6: Form and Input Containment

**User Story:** As a user filling out forms, I want form inputs, dropdowns, and modals to fit within the screen, so that I can interact with them without horizontal scrolling.

#### Acceptance Criteria

1. THE Client_App SHALL render all form inputs at a maximum width of 100% of their parent container
2. THE Admin_App SHALL render all form inputs at a maximum width of 100% of their parent container
3. WHEN a dropdown or select menu opens, THE Client_App SHALL position it within the viewport boundaries
4. WHEN a modal opens on mobile, THE Client_App SHALL render it within the viewport width with appropriate horizontal padding (minimum 16px per side)
5. WHEN a modal opens on mobile, THE Admin_App SHALL render it within the viewport width with appropriate horizontal padding (minimum 16px per side)

### Requirement 7: Decorative Element Containment

**User Story:** As a user, I want decorative visual effects (light rays, gradients) to never cause scrollable overflow, so that the page feels stable.

#### Acceptance Criteria

1. THE Light_Rays elements SHALL be contained within a parent that has `overflow: hidden` and does not contribute to document scroll height
2. WHEN the parent container overflow property changes, THE Light_Rays SHALL remain visually contained without creating vertical or horizontal scroll
3. THE Client_App SHALL ensure all absolute/fixed decorative elements have `pointer-events: none` and do not extend the document dimensions

### Requirement 8: Content Max-Width on Large Screens

**User Story:** As a user on an ultrawide monitor, I want text content to be constrained to a readable width, so that lines of text remain comfortable to read.

#### Acceptance Criteria

1. WHILE the viewport width exceeds 1440px, THE Client_App SHALL constrain the main Content_Area to a maximum width of 1440px and center it horizontally
2. WHILE the viewport width exceeds 1440px, THE Admin_App SHALL constrain the main Content_Area to a maximum width of 1440px and center it horizontally
3. WHEN max-width is applied, THE Client_App SHALL maintain full-bleed backgrounds and decorative elements behind the constrained content

### Requirement 9: Legacy Sidebar Cleanup (Admin)

**User Story:** As a developer, I want only one sidebar implementation active in the admin app, so that behavior is predictable and maintainable.

#### Acceptance Criteria

1. THE Admin_App SHALL use a single sidebar component (AdminDashboardLayout) for all navigation
2. WHEN the legacy Sidebar.jsx component exists, THE Admin_App SHALL remove it or consolidate its functionality into AdminDashboardLayout
3. THE Admin_App SHALL have no orphaned or duplicate navigation components in the source tree

### Requirement 10: Fixed Element Stability

**User Story:** As a mobile user, I want fixed navigation elements (bottom bar, top bar) to not jitter or shift when the browser URL bar shows/hides, so that the interface feels solid.

#### Acceptance Criteria

1. WHILE the mobile browser URL bar animates in or out, THE Bottom_Nav SHALL maintain its fixed position at the viewport bottom without jitter
2. WHILE the mobile browser URL bar animates in or out, THE Dynamic_Island SHALL maintain its fixed position at the viewport top without jitter
3. THE Client_App SHALL use `position: fixed` with viewport-relative units (dvh/svh) or `will-change: transform` for mobile fixed elements where needed for stability
