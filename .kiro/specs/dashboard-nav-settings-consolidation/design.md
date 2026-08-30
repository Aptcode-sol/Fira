# Design Document

## Overview

This is a deletion-led change. Nothing new is fetched, stored, or computed; two sidebars lose sections, one placeholder page dies, one settings implementation becomes shared, and the nav item lists move out of the two layout components into one React-free module so a single `node` command can prove the composition.

Net file count goes down: three page files are deleted, two are created (one shared settings component, one nav model), plus its check. Total lines removed is roughly 5× lines added.

Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind. Code examples below are TypeScript/TSX, matching the existing sources, except the Nav_Model which is `.mjs` for the reason in Decision 2.

---

## What gets deleted

Called out first, because this is the bulk of the work.

| Deleted | From | Why |
| --- | --- | --- |
| `client/src/app/venue-portal/settings/page.tsx` (whole file, ~185 lines) | — | Four tabs of non-saving placeholder: read-only profile inputs, an unwired bank form, four fake toggles, hard-coded ₹0 billing. Replaced by the shared component. (Req 2.1, 2.5) |
| `client/src/app/dashboard/venues/page.tsx` (whole file, ~330 lines) | — | Second copy of the venue list. `/venue-portal/venues` is the live one. (Req 6.1, 6.3) |
| `client/src/app/dashboard/requests/page.tsx` (whole file, ~700 lines) | — | Second copy of booking + event-request triage. `/venue-portal/bookings` and `/venue-portal/events` both have approve/reject with rejection reasons — verified, so nothing is orphaned. (Req 6.2, 6.3) |
| `eventOrganizerItems`, `venueOwnerItems`, `navItems` consts | `DashboardLayout.tsx` | Replaced by `userNavItems` from the Nav_Model. (Req 4.2, 5.2) |
| `hasEvents` const + the entire "Events Management" JSX block | `DashboardLayout.tsx` | Section header and its gate both go; the item becomes a plain nav entry. (Req 4.1, 4.6) |
| `showVenueManagement` const + the entire "Venue Management" JSX block | `DashboardLayout.tsx` | (Req 5.1, 5.4) |
| `import { isVenueOwner } from '@/lib/types'` | `DashboardLayout.tsx` | Only consumer was `showVenueManagement`; leaving it is a lint error. (Req 5.4, 10.8) |
| `'building-office'` and `'inbox'` entries in `getIcon` | `DashboardLayout.tsx` | Their only items are gone. `'sparkles'` stays (Brand Profile), `'cog'` stays (footer Settings). |
| The `absolute left-4` desktop toggle button | `DashboardLayout.tsx` header | Replaced by one right-edge control. (Req 7.2, 7.4) |
| `navItems` const | `VenueDashboardLayout.tsx` | Replaced by `venueNavItems`; the Settings entry moves to the shared footer. (Req 3.2, 3.3) |
| `bankDetails` state, the `BankDetails` type, the `owner` const, the `usersApi.getProfile` effect | `dashboard/settings/page.tsx` | Dead since payout accounts moved to `BankAccountsSection`, which loads its own data via `useBankAccounts`. (Req 1.6, 2.4) |
| Inline logout `<svg>` in both layouts | both layouts | Moves into each `getIcon` map as `'logout'` so the footer renders from the model list. Net markup unchanged. |

Nothing in `server/`, `admin/`, or `lib/api.ts` is touched.

---

## Architecture

```
client/src/lib/
  navModel.mjs            NEW  React-free: userNavItems, venueNavItems, pinnedFooter(shell)
  navModel.check.mjs      NEW  node:assert, the one runnable check

client/src/components/dashboard/
  SettingsContent.tsx     NEW  Shared_Settings_Content — layout-free, no shell
  DashboardLayout.tsx     EDIT imports navModel; header rebuilt; two sections deleted
  BankAccountsSection.tsx      unchanged
client/src/components/venue-portal/
  VenueDashboardLayout.tsx EDIT imports navModel; header rebuilt + stacked title; footer from model

client/src/app/dashboard/settings/page.tsx        EDIT  → <DashboardLayout><SettingsContent/></DashboardLayout>
client/src/app/venue-portal/settings/page.tsx     REWRITTEN → owner guard + <VenueDashboardLayout><SettingsContent/></VenueDashboardLayout>
client/src/app/dashboard/venues/page.tsx          DELETED  → redirect
client/src/app/dashboard/requests/page.tsx        DELETED  → redirect
client/src/app/dashboard/venues/[id]/page.tsx     KEPT     see Decision 4
client/next.config.ts                             EDIT     two redirect entries
client/src/app/venue-portal/venues/page.tsx       EDIT     one "Manage" link (Decision 4)
```

No new context, no new provider, no new dependency. The only cross-component signal in play is the existing `toggle-dashboard-sidebar` window event, which is untouched (Req 10.6).

---

## Design decisions

### Decision 1 — Where the shared settings lives

`client/src/components/dashboard/SettingsContent.tsx`: the current `/dashboard/settings` page body with `<DashboardLayout>` and the outer `<div className="p-4 md:p-8 max-w-4xl mx-auto">` lifted out into the route files. The component owns all state (profile form, password panel, delete modal) and all six sections; it knows nothing about which shell wraps it.

Both routes become thin:

```tsx
// app/dashboard/settings/page.tsx
'use client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SettingsContent from '@/components/dashboard/SettingsContent';

export default function SettingsPage() {
    return (
        <DashboardLayout>
            <div className="p-4 md:p-8 max-w-4xl mx-auto">
                <SettingsContent />
            </div>
        </DashboardLayout>
    );
}
```

```tsx
// app/venue-portal/settings/page.tsx — same body, VenueDashboardLayout shell,
// plus the owner guard every other venue-portal page already runs (Req 2.3).
```

The padding wrapper stays in the route files rather than inside the component because the two shells could diverge on padding later and because both already use the identical `max-w-4xl mx-auto` value — duplicating one className is cheaper than a `className` prop nobody asked for.

The component is not moved to a neutral `components/settings/` folder. `components/dashboard/` already holds `BankAccountsSection`, which the venue portal will now render too; a third folder for one file is churn. `ponytail:` noted in the file header — the ceiling is a slightly misleading folder name, the upgrade path is a folder move if a third shell ever appears.

### Decision 2 — The Nav_Model is `.mjs`, not `.ts`

Requirement 9.1 asks for a React-free TypeScript module; Requirement 9.2 forbids a test framework. Those two cannot both hold literally on this repo: the toolchain runs Node **v20.19.4**, which has no type stripping, so a `.check.mjs` cannot `import` a `.ts` file without a bundler or a runner — and every runner is a framework.

Resolution: the model is `client/src/lib/navModel.mjs`, plain ESM with a JSDoc typedef for editor types. `tsconfig.json` already sets `"allowJs": true`, so the `.tsx` layouts import it and get inferred types; `node` runs the check against the exact same file the app renders from — no build step, no second source of truth.

```js
// ponytail: .mjs rather than .ts because Node 20 has no type stripping, so a
// framework-free `node navModel.check.mjs` cannot import TypeScript. Ceiling:
// no compile-time enforcement of the item shape beyond JSDoc inference.
// Upgrade path: rename to .ts once the repo's Node baseline is >= 22.6.
```

**Icons stay out of the module by keying, not by importing.** Both layouts already resolve icons through `getIcon(name)` from a local `Record<string, React.ReactNode>` map — the existing item objects carry `icon: 'home'` strings, never JSX. So the model needs no change of approach: it carries the string id, each layout keeps its own icon map (they render at different sizes, `w-5 h-5` vs `w-6 h-6`), and the check imports pure data.

```js
/** @typedef {{ href?: string, icon: string, label: string }} NavItem */

/** @type {NavItem[]} */
export const userNavItems = [
    { href: '/dashboard',          icon: 'home',        label: 'Overview' },
    { href: '/dashboard/bookings', icon: 'building',    label: 'My Bookings' },
    { href: '/dashboard/tickets',  icon: 'ticket',      label: 'My Tickets' },
    // Promoted out of the deleted "Events Management" section (Req 4.3).
    { href: '/dashboard/events',   icon: 'calendar',    label: 'My Events' },
    { href: '/dashboard/payments', icon: 'credit-card', label: 'Payments' },
    { href: '/dashboard/policies', icon: 'document',    label: 'Policies' },
];

/** @type {NavItem[]} */
export const venueNavItems = [
    { href: '/venue-portal/dashboard', icon: 'home',     label: 'Dashboard' },
    { href: '/venue-portal/venues',    icon: 'building', label: 'My Venues' },
    { href: '/venue-portal/bookings',  icon: 'calendar', label: 'Bookings' },
    { href: '/venue-portal/events',    icon: 'ticket',   label: 'Event Requests' },
    { href: '/venue-portal/analytics', icon: 'chart',    label: 'Analytics' },
    { href: '/venue-portal/earnings',  icon: 'rupee',    label: 'Earnings' },
];

/**
 * The one place the footer order is written. Both shells derive from it, so
 * Settings-then-sign-out cannot drift apart (Req 3.5). `signout` has no href:
 * the layouts render it as a button.
 * @param {'user' | 'venue'} shell
 * @returns {NavItem[]}
 */
export const pinnedFooter = (shell) => [
    { href: shell === 'venue' ? '/venue-portal/settings' : '/dashboard/settings',
      icon: 'cog', label: 'Settings' },
    { icon: 'logout', label: shell === 'venue' ? 'Sign Out' : 'Logout' },
];
```

Settings appears in neither nav list — it is footer-only in both shells (Req 3.3). `pinnedFooter` is a function rather than two exported arrays precisely so the ordering exists once; the check quantifies over both shell values.

Brand Profile stays hand-written in `DashboardLayout` rather than entering the model: it is conditional on `verificationBadge` and carries its own gradient active state, so modelling it would mean adding gate and style fields to every item to serve one. It renders above the shared footer items, so Requirement 3.1 (Settings last above Logout) still holds (Req 10.2).

### Decision 3 — Payout accounts stay ungated; "role based" is served by routing

Requirement 2.4 and the phrase "keep the particular ones role based" pull in opposite directions. Resolution: **role-gating happens at the route and nav level, not inside the settings body.**

- The venue portal's Settings route keeps the `isVenueOwner` guard every other venue-portal page runs, so a non-owner never sees the venue shell at all (Req 2.3).
- Venue-specific *destinations* live only in `venueNavItems` (Req 5.3), which only owners can reach.
- Inside settings, every section applies to every account. `BankAccountsSection` is the only arguably role-flavoured one, and it is genuinely universal: any user can create an event via `/create/event` or list a venue, and the section's own empty state ("You need one before you can list an event or a venue") is the correct prompt for someone who has not yet. The current code already un-gated it, with a comment saying why; the `owner` const and `getProfile` effect left behind are the dead remnant this change deletes (Req 1.6).

So there is no `WHERE isVenueOwner` branch anywhere in `SettingsContent`, and no venue-specific placeholder slot (Req 2.5). If a genuinely venue-only setting ever appears, it goes behind an `isVenueOwner` check at that point — adding the slot now would be the stub the requirement forbids.

### Decision 4 — Redirects, and the `/dashboard/venues/[id]` gap

Mechanism: `next.config.ts` `redirects()`. Two entries, no page files, no client-side effect flash, and it lets both source pages be deleted outright rather than reduced to stubs.

```ts
async redirects() {
    return [
        // Venue management lives only in the venue portal now. Non-permanent (307):
        // these are app-internal moves, not SEO-visible URLs, and a 308 would be
        // cached in browsers past any future change of mind.
        { source: '/dashboard/venues', destination: '/venue-portal/venues', permanent: false },
        { source: '/dashboard/requests', destination: '/venue-portal/events', permanent: false },
    ];
}
```

Session survives: auth is a `fira_token` in `localStorage` read by `AuthContext` on mount, so a redirect — server or client — carries it (Req 6.4). The sources are exact paths, not `:path*`, so `/dashboard/venues/[id]` is untouched.

**The gap, stated plainly.** `/dashboard/venues/[id]` is not a duplicate. It is the only implementation of:

- the "Photos & Dates" mode: drag-reorder the live gallery, add/delete images against Cloudinary,
- the availability calendar: multi-select dates, apply/clear busy hour slots via `blockedDates`,
- per-venue booking approve/reject, event-request approve/reject,
- the Active/Inactive toggle, the Auto-Approve Bookings toggle, and Delete Venue,
- the `openEditVenue(id)` hand-off into the shared `CreateVenueModal`.

`/venue-portal/venues/[id]/` contains only `preview/`; its `edit/` directory is **empty**. `/venue-portal/venues` gives you View (preview) and Edit (the shared modal) and nothing else. So redirecting the `[id]` route would delete real functionality, and deleting the list page removes its only inbound link.

Smallest resolution that orphans nothing: **keep `/dashboard/venues/[id]` exactly as it is, and add one "Manage" link to the venue card in `/venue-portal/venues`** beside the existing View and Edit buttons. That is a one-element diff. Requirement 6.3 still holds — there remains exactly one rendered implementation of the screen.

Its three internal `router.push('/dashboard/venues')` calls are deliberately left alone: the new redirect resolves them to `/venue-portal/venues`, so changing them would be three edits to reach the same place. Cost is one extra hop.

```tsx
// ponytail: a venue-owner screen still renders inside the user shell
// (DashboardLayout), reached from the venue portal. Ceiling: shell whiplash on
// Manage, and the user sidebar shows no venue context there. Upgrade path: move
// this page to app/venue-portal/venues/[id]/manage/ and swap the layout import —
// deferred because it is a ~1000-line file and this spec is a nav change.
```

This is the one place the design adds rather than deletes, and it is doing so only to avoid stranding working features. Flagged for confirmation at review.

### Decision 5 — Sidebar_Header layout, both shells

One structure serves both: a `justify-between` row, brand on the left, one control on the right.

```tsx
{/* User_Sidebar. Logo left, single collapse/close control right (Req 7.1, 7.2, 7.4). */}
<div className={`px-4 border-b border-white/[0.08] flex items-center h-16 lg:h-20 ${
    isOpen ? 'justify-between' : 'justify-center'
}`}>
    <Link href="/" className="flex items-center">
        <img src="/logo white.png" alt="FIRA"
             className="w-8 h-8 lg:w-10 lg:h-10 object-contain flex-shrink-0" />
    </Link>
    {isOpen && (
        <button
            onClick={() => setIsExpanded(false)}
            className="text-gray-400 hover:text-white"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
        >
            {/* one icon for both breakpoints */}
        </button>
    )}
</div>
```

- **One control, two behaviours, one handler.** `setIsExpanded(false)` collapses to the desktop rail and closes the mobile drawer, because the same flag drives both (`w-0 lg:w-20`) (Req 7.3). The old pair — `absolute left-4` desktop hamburger plus `absolute right-3` mobile ✕ — both go; neither is absolutely positioned any more (Req 7.4).
- **Collapsed rail centres the logo and shows no control** via `justify-center` + the `isOpen` guard (Req 7.5).
- **Hover-to-peek nuance.** `isOpen = isExpanded || (isDesktop && isHovered)`, so during a hover peek the control is visible while `isExpanded` is already `false`, making the click a no-op until the pointer leaves. That is the literal reading of Requirement 7.3 (activating it does not open anything) and it keeps one handler. `ponytail:` comment names it; the alternative — a toggle that pins on click during peek — is a nicer feel but contradicts the stated criterion, so it is not built.
- **Logo target.** The user shell already links `/`; the venue shell currently links `/venue-portal/dashboard` and changes to `/` (Req 7.6).
- **Height** becomes `h-16 lg:h-20` in both shells. The user shell already has it; the venue shell is a flat `h-20` today and gains the mobile step (Req 7.7).

Venue shell adds the stacked title, with no state branch on the stacking direction (Req 8.3) — today the link flips `flex-row`/`flex-col` on `isOpen`, which is exactly what Requirement 8 removes:

```tsx
<Link href="/" className="flex flex-col items-center leading-none">
    <img src="/logo white.png" alt="FIRA"
         className="w-7 h-7 lg:w-8 lg:h-8 object-contain flex-shrink-0" />
    <span className="mt-0.5 text-[10px] leading-none text-gray-300 font-medium
                     tracking-wider uppercase whitespace-nowrap">
        Venues
    </span>
</Link>
```

Vertical budget, since Requirement 8.4 forbids clipping inside Requirement 7.7's heights. `px-4` only — the header drops `p-4`'s vertical padding, replaced by `py-2`:

| | header | padding | content box | stack (logo + 2px gap + 10px title) | fits |
| --- | --- | --- | --- | --- | --- |
| < 1024px | 64px | 16px | 48px | 28 + 2 + 10 = 40px | yes, 8px spare |
| ≥ 1024px | 80px | 16px | 64px | 32 + 2 + 10 = 44px | yes, 20px spare |

Horizontal, in the 80px collapsed rail: 48px of content box against ~42px for `VENUES` at `text-[10px] tracking-wider` — fits, and `whitespace-nowrap` keeps it on one line. The logo drops from `w-8` to `w-7` on mobile to buy the vertical room; the user shell keeps `w-8 lg:w-10` since it stacks nothing (Req 8.5).

Pinned footer in both shells now renders from `pinnedFooter(shell)`, branching on `href` presence:

```tsx
{pinnedFooter('user').map((item) =>
    item.href ? (
        <Link key={item.label} href={item.href} onClick={handleLinkClick} /* Req 10.7 */ >…</Link>
    ) : (
        <button key={item.label} onClick={signOut}>…</button>
    )
)}
```

`handleLinkClick` (close the drawer below 1024px) is wired to the footer Settings link as well as the scrolling items (Req 10.7). The venue shell keeps its avatar/name/email block above these two items (Req 10.4) and its existing `venue_sidebar_expanded` persistence (Req 10.5).

---

## Components and Interfaces

| Component | Kind | Interface | Consumers |
| --- | --- | --- | --- |
| `navModel.mjs` | React-free ESM data module | `userNavItems: NavItem[]`, `venueNavItems: NavItem[]`, `pinnedFooter(shell: 'user' \| 'venue'): NavItem[]` | both layouts, `navModel.check.mjs` |
| `NavItem` | typedef | `{ href?: string; icon: string; label: string }` — `icon` is a key into each layout's own `getIcon` map, never JSX | — |
| `SettingsContent` | client component | `()` — no props; reads `useAuth`, `useToast`, `usersApi`, `authApi` itself | both settings routes |
| `DashboardLayout` | client component | `{ children }` — unchanged signature; internals lose two sections and gain the model import | every `/dashboard/*` page |
| `VenueDashboardLayout` | client component | `{ children }` — unchanged signature; header stacks, footer renders from the model | every `/venue-portal/*` page |
| `BankAccountsSection` | client component | `()` — unchanged; loads via `useBankAccounts` | `SettingsContent` (now reached from both shells) |
| `PushNotificationToggle` | client component | `()` — unchanged | `SettingsContent` |
| `getIcon(name)` | local helper in each layout | `string → React.ReactNode`; user map at `w-5 h-5`, venue map at `w-6 h-6`; both gain `'logout'`, the user map loses `'building-office'` and `'inbox'` | own layout only |
| `next.config.ts redirects()` | framework config | two exact-path entries, `permanent: false` | Next router |

Public surfaces that do **not** change: `AuthContext`, `usersApi`/`authApi`/`venuesApi`, the `toggle-dashboard-sidebar` window event, the `dashboard_sidebar_expanded` and `venue_sidebar_expanded` storage keys, and both layouts' props.

## Data models

None. No API, schema, or storage change. The only new data shape is the `NavItem` typedef above: `{ href?, icon, label }` — three keys, deliberately no role, gate, or badge field, which is what makes the user sidebar identical for every account (Req 4.4, 5.5).

---

## Error handling

| Situation | Behaviour | Where |
| --- | --- | --- |
| Invalid input tied to a field (password mismatch, bad IFSC/account number) | Message rendered directly under that input, red border, no toast | `SettingsContent` password panel (existing `pwMismatch`), `BankAccountForm` (marks its own field) — Req 1.5 |
| Change-password rejected by the server | Inline red panel at the top of the password form, not a toast — it is attached to the form | `SettingsContent`, existing `pwError` |
| Profile save / account delete / payout add outcome | Toast, because it is an outcome of a whole operation, not an input problem | existing `showToast` calls |
| Non-owner hits `/venue-portal/settings` | `router.push('/dashboard')` from the guard effect; render `null` meanwhile | new venue settings route — Req 2.3 |
| Signed-out user hits either settings route | `router.push('/signin')`, matching every other dashboard page | route files |
| Old bookmark to `/dashboard/venues` or `/dashboard/requests` | 307 to the venue-portal equivalent, session intact | `next.config.ts` — Req 6.1, 6.2, 6.4 |
| Nav model breaks (React import, reordered items, duplicate href) | `node navModel.check.mjs` throws, non-zero exit | Req 9.7 |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

All properties below are executed by the single `client/src/lib/navModel.check.mjs` (Req 9.2, 9.8). Each is a statement over the exported nav data, so `node` alone can decide it.

### Property 1: The model loads and exposes both lists plus the footer, free of React

For any environment able to run plain `node`, importing the Nav_Model succeeds without a bundler or transpiler, and `userNavItems`, `venueNavItems`, and `pinnedFooter(shell)` for every shell value all yield non-empty arrays of items where every item has a string `icon` and a non-empty string `label`.

**Validates: Requirements 9.1**

### Property 2: Footer order is Settings then sign-out, for every shell

For any shell the model serves (`'user'`, `'venue'`), the last two entries of `pinnedFooter(shell)` are, in order, the Settings item — with an `href` pointing at that shell's settings route — followed by the sign-out item, which has no `href`. Since both shells derive from one definition, the ordering cannot diverge.

**Validates: Requirements 3.1, 3.2, 3.5, 9.5**

### Property 3: No nav list contains Settings

For any of the two sidebar nav lists, no item has a label of `'Settings'` and no item's `href` ends in `/settings`. Settings is reachable only from the pinned footer.

**Validates: Requirements 3.3**

### Property 4: "My Events" directly follows "My Tickets"

For the user sidebar list, the index of the item labelled `'My Events'` is exactly one greater than the index of the item labelled `'My Tickets'`, and its `href` is `/dashboard/events`.

**Validates: Requirements 4.3, 9.3**

### Property 5: No removed section header survives as an item

For any item in either sidebar nav list, its label is neither `'Events Management'` nor `'Venue Management'` — case-insensitively, and after trimming — so a deleted grouping cannot return disguised as a nav entry.

**Validates: Requirements 4.1, 5.1, 9.4**

### Property 6: Hrefs are unique within each list

For any of the two sidebar nav lists, no two items share an `href`; in particular the user list holds exactly one `/dashboard/events`.

**Validates: Requirements 4.5**

### Property 7: No item is role-gated

For any item in either sidebar nav list and in either shell's pinned footer, the item's own keys are drawn only from `href`, `icon`, `label` — it carries no `role`, `roles`, `badge`, `gate`, or `when` field. With no gate to evaluate, the rendered item list is necessarily the same for a venue owner, an admin, and a regular user.

**Validates: Requirements 4.4, 5.5**

### Property 8: No venue-management destination in the user sidebar

For any item in the user sidebar list, its `href` is neither `/dashboard/venues` nor `/dashboard/requests`, and no `href` starts with either prefix.

**Validates: Requirements 5.3, 9.6**

### Property 9: The user sidebar keeps its surviving destinations, in order

For the user sidebar list, the full sequence of hrefs is exactly `/dashboard`, `/dashboard/bookings`, `/dashboard/tickets`, `/dashboard/events`, `/dashboard/payments`, `/dashboard/policies` — so no delete-heavy edit can silently drop Overview, My Bookings, My Tickets, Payments, or Policies.

**Validates: Requirements 10.1**

### Property 10: The venue sidebar keeps its six destinations, in order

For the venue sidebar list, the full sequence of hrefs is exactly `/venue-portal/dashboard`, `/venue-portal/venues`, `/venue-portal/bookings`, `/venue-portal/events`, `/venue-portal/analytics`, `/venue-portal/earnings`.

**Validates: Requirements 10.3**

---

## Testing strategy

### The one check (Req 9.2, 9.8)

`client/src/lib/navModel.check.mjs`, beside the model, `node:assert` only, no framework, no fixtures, matching the existing convention in `server/utils/roleUtils.check.mjs`:

```js
// Runnable self-check for sidebar nav composition. No framework:
//   node client/src/lib/navModel.check.mjs
import assert from 'node:assert';
import { userNavItems, venueNavItems, pinnedFooter } from './navModel.mjs';

const lists = { user: userNavItems, venue: venueNavItems };
const shells = ['user', 'venue'];
// … Properties 1–10 as assertions, quantified over `lists` and `shells` …
console.log('navModel.check.mjs: all assertions passed');
```

Properties 2, 3, 5, 6, 7 are written as loops over `shells` / `lists` rather than repeated per-shell assertions — the universal form is both shorter and stronger. `node:assert` throws on failure, which exits non-zero for free (Req 9.7).

No property-based testing library is used and none is added. The input space here is a pair of fixed arrays, not an infinite one: generating random nav lists would test a generator, not the app. `fast-check` is already a devDependency for other work and stays unused by this feature.

### Manual verification list

Everything the prework classified as EXAMPLE, EDGE_CASE, INTEGRATION, or SMOKE — layout, redirects, and rendering that needs a browser:

1. `npx tsc --noEmit` and `npm run lint` in `client/` — zero errors, no unused imports/vars left by the deletions (Req 10.8).
2. `node client/src/lib/navModel.check.mjs` — exit 0 (Req 9.7).
3. `/dashboard/settings` and `/venue-portal/settings` — all six sections present in both shells; save profile, expand and mismatch Change Password (inline message, no toast), payout accounts visible as a plain user (Req 1.2–1.5, 2.2, 2.4).
4. Non-owner requests `/venue-portal/settings` — lands on `/dashboard` (Req 2.3).
5. Both sidebars, open: logo hard left, one control hard right, Settings directly above Logout / Sign Out; venue shell shows the avatar block above them (Req 3.1, 3.2, 7.1, 7.2, 10.4).
6. Both sidebars, collapsed rail: logo centred, no control (Req 7.5).
7. Venue shell at 375px and 1440px, open and collapsed: "Venues" sits under the logo, neither clipped (Req 8.1, 8.2, 8.4).
8. Short viewport with the nav list overflowing: footer stays pinned to the bottom edge in both shells (Req 3.4).
9. Below 1024px: tapping a scrolling item *and* the footer Settings item closes the drawer (Req 10.7).
10. Toggle pinned state, reload — persists per shell under its own key; navbar control still toggles the user sidebar (Req 10.5, 10.6).
11. Visit `/dashboard/venues` and `/dashboard/requests` — land on `/venue-portal/venues` and `/venue-portal/events`, still signed in (Req 6.1, 6.2, 6.4).
12. From `/venue-portal/venues`, the new Manage link reaches the photos/dates/availability screen; its Back to Venues returns to the portal list via the redirect (Decision 4).
13. Brand-badged account still sees Brand Profile in the user footer; a plain account does not (Req 10.2).
