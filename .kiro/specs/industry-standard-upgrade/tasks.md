# Implementation Plan: Industry-Standard Upgrade

## Overview

Upgrade the FIRA platform from prototype-grade to production quality across 8 domains: Architecture & Code Quality, Security, Testing, Error Handling, Resilience & Performance, Accessibility, Operations, and Design & DX. Tasks are sequenced so foundational work (monorepo, TypeScript, cleanup) lands first, enabling all subsequent domains to build on a clean, typed codebase.

## Tasks

- [x] 1. Monorepo setup and architecture cleanup
  - [x] 1.1 Initialize npm workspaces with root package.json
    - Create root `package.json` with `"private": true` and `"workspaces": ["server", "client", "admin", "packages/*"]`
    - Add root scripts for `build`, `test`, and `lint` that run across all workspaces
    - Deduplicate shared dependencies (react, typescript, tailwindcss)
    - _Requirements: 47.1, 47.2, 47.3_

  - [x] 1.2 Remove debug files and reorganize seeds
    - Delete from server root: `testServer.js`, `testServer2.js`, `testServer3.js`, `testServer4.js`, `debugEventData.js`, `tmp_check_events.js`, `checkBrandCounts.js`, `checkConnection.js`, `checkDuplicates.js`, `testPurchase.js`, `debugService.patch`, `fixSeededData.js`
    - Move seed files (`seedAll.js`, `seedBookings.js`, `seedBrands.js`, `seedEvents.js`, `seedTestUser.js`, `seedVenues.js`) to `/server/seeds/`
    - Remove empty index files: `server/routes/index.js`, `server/services/index.js`
    - Remove spurious Windows-path directory from `client/src`
    - _Requirements: 33.1, 33.2, 33.3, 33.4_

  - [x] 1.3 Create shared-types package structure
    - Create `packages/shared-types/package.json` and `tsconfig.json`
    - Create `packages/shared-types/src/api/` with type files: `events.ts`, `venues.ts`, `bookings.ts`, `auth.ts`, `payments.ts`
    - Create `packages/shared-types/src/models/` with interfaces: `event.ts`, `venue.ts`, `user.ts`
    - Export all types from package index
    - _Requirements: 36.1, 36.2, 36.3_

  - [x] 1.4 Configure TypeScript for server (gradual adoption)
    - Create `server/tsconfig.json` with `allowJs: true`, `strict: false`, `outDir: dist`
    - Install `typescript` as dev dependency in server workspace
    - Verify `tsc --noEmit` runs without errors on existing `.ts` files
    - _Requirements: 37.1, 37.4_

  - [x] 1.5 Fix environment file security
    - Add `client/.env` to root `.gitignore`
    - Create `client/.env.example` with placeholder values and documentation
    - Document the `git filter-repo` command to purge `client/.env` from history (leave execution to operator)
    - _Requirements: 38.1, 38.2, 38.3_

  - [x] 1.6 Set up API versioning prefix
    - Create route mounting under `/api/v1/` namespace in server entry
    - Alias current `/api/*` routes to `/api/v1/*` for backward compatibility
    - Add `X-API-Version: 1` response header
    - _Requirements: 35.1, 35.2_

- [x] 2. Checkpoint - Ensure monorepo builds cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Security layer implementation
  - [x] 3.1 Implement CORS middleware with origin allowlist
    - Create `server/middleware/cors.ts`
    - Read `CORS_ALLOWED_ORIGINS` env var (comma-separated), refuse startup if missing/empty
    - Return 403 (no CORS headers) for disallowed origins
    - Respond to preflight OPTIONS with correct headers
    - Support per-environment allowlists
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property test for CORS allowlist (Property 1)
    - **Property 1: CORS allowlist determines header presence**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 3.3 Implement security headers middleware with helmet
    - Create `server/middleware/securityHeaders.ts`
    - Install and configure `helmet` with CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-DNS-Prefetch-Control, X-Download-Options
    - Apply to all responses including errors and `/health`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.4 Write property test for security headers (Property 2)
    - **Property 2: Security headers present on all responses**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

  - [x] 3.5 Implement unified auth middleware with role-based access
    - Create `server/middleware/auth.ts` with `requireAuth(...roles)` function
    - Consolidate `auth.js`, `adminAuth.js`, `venueOwnerAuth.js` into single parameterized middleware
    - Validate JWT signature and expiration
    - Check token against Redis blocklist (fail closed if Redis is down → 503)
    - Role check returns 403 for unauthorized roles
    - Apply to all payment/payout/refund routes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 34.1, 34.2, 34.3_

  - [ ]* 3.6 Write property tests for auth middleware (Properties 3, 4)
    - **Property 3: Protected routes reject unauthenticated requests**
    - **Property 4: Admin routes reject non-admin users**
    - **Validates: Requirements 3.1–3.7**

  - [x] 3.7 Implement body size limits
    - Set `express.json({ limit: '1mb' })` and `express.urlencoded({ extended: true, limit: '1mb' })`
    - Configure upload routes with multer limit of 10MB
    - Return 413 on violation
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 3.8 Write property test for body size limits (Property 5)
    - **Property 5: Body size limits enforce thresholds**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 3.9 Implement token blocklist service
    - Create `server/services/tokenBlocklist.ts`
    - Store blocked token `jti` in Redis with TTL = remaining `exp` time
    - Logout endpoint adds token to blocklist
    - Auth middleware checks blocklist on every request
    - Automatic expiration via Redis TTL
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 3.10 Write property test for token blocklist (Property 6)
    - **Property 6: Token blocklist round-trip**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 3.11 Implement input sanitization middleware
    - Create `server/middleware/sanitize.ts`
    - Strip/reject any key starting with `$` (NoSQL injection prevention)
    - Install `zod` and create route-specific validation schemas
    - Return 400 with descriptive error on violation
    - Apply as global middleware before route handlers
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.12 Write property tests for sanitization (Properties 7, 8)
    - **Property 7: Input sanitization strips MongoDB operators**
    - **Property 8: Schema validation rejects non-conforming bodies**
    - **Validates: Requirements 6.1–6.5**

  - [x] 3.13 Implement field-level encryption service
    - Create `server/services/encryption.ts` with `encrypt`, `decrypt`, `mask` methods
    - AES-256-GCM via Node.js `crypto` module, unique IV per operation
    - Validate `ENCRYPTION_KEY` env var at startup (32 bytes, refuse start if missing/malformed)
    - Apply to bank details and government IDs before DB write
    - Return masked values for non-owner reads
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 3.14 Write property tests for encryption (Properties 9, 10, 11)
    - **Property 9: Encryption round-trip preserves data**
    - **Property 10: Encryption produces unique ciphertext**
    - **Property 11: Encrypted data masking for non-owners**
    - **Validates: Requirements 7.1–7.6**

  - [x] 3.15 Implement CSRF protection middleware
    - Create `server/middleware/csrf.ts`
    - Issue token via `Set-Cookie` (HttpOnly, SameSite=Strict, Secure), 32 random bytes
    - Validate on POST/PUT/DELETE/PATCH when Cookie header or matching Origin/Referer present
    - Skip for pure bearer-token API clients
    - Return 403 on CSRF failure
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 3.16 Write property test for CSRF enforcement (Property 13)
    - **Property 13: CSRF enforcement on browser state-changing requests**
    - **Validates: Requirements 10.1, 10.3, 10.4**

  - [x] 3.17 Remove admin credential hints from production
    - Remove hardcoded credentials from `admin/src/pages/Login.jsx`
    - Gate dev-mode hints behind `import.meta.env.VITE_DEV_MODE === 'true'`
    - Verify Vite tree-shakes the dev block from production builds
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 4. Checkpoint - Security layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Error handling implementation
  - [x] 5.1 Implement async error handler wrapper
    - Create `server/middleware/asyncHandler.ts`
    - Wrap all async route handlers to catch thrown/rejected values and forward to Express error middleware
    - Implement global error handler: format response with error message + 6-char reference ID, log with same ref
    - Handle non-Error throws (strings, undefined) gracefully
    - Add global `unhandledRejection` handler (log + continue, no crash)
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [ ]* 5.2 Write property test for async error handler (Property 14)
    - **Property 14: Async error handler catches all thrown values**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4**

  - [x] 5.3 Implement graceful shutdown
    - Create `server/lib/shutdown.ts`
    - On SIGTERM/SIGINT: stop accepting connections, wait up to 30s for in-flight requests
    - Close Redis (`client.quit()`) and MongoDB (`mongoose.disconnect()`)
    - Exit 0 on clean close, exit 1 if forced after timeout
    - Log warning with count of forcibly terminated requests
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 5.4 Implement client error boundaries
    - Create `src/app/error.tsx` (global fallback) with error message (no stack trace) and retry button
    - Create segment-level error boundaries: `events/error.tsx`, `venues/error.tsx`, `dashboard/bookings/error.tsx`, `create/error.tsx`
    - Log error details to error tracking service
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 5.5 Implement admin error boundaries
    - Create top-level `ErrorBoundary` wrapping Routes inside `AdminDashboardLayout`
    - Create per-page error boundaries for Dashboard, Events, Venues, Brands, Users
    - Fallback UI: error message, retry button, "Go to Dashboard" link
    - Sidebar remains functional when page boundary catches
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 6. Resilience and performance implementation
  - [x] 6.1 Set up Redis integration with ioredis
    - Install `ioredis` in server workspace
    - Create `server/config/redis.ts` with connection config and reconnection logic
    - Implement key patterns: `otp:{phone}`, `blocked:{jti}`, `cache:events:{hash}`, `cache:venues:{hash}`
    - Fallback behavior: on Redis unavailability, direct MongoDB queries + rate-limited warning log (once/60s)
    - _Requirements: 20.1, 20.2, 20.3, 20.5_

  - [x] 6.2 Implement circuit breaker module
    - Install `opossum` in server workspace
    - Create `server/lib/circuitBreaker.ts` with configurable thresholds
    - Apply to Razorpay (5 failures/60s), Cloudinary (5 failures/60s), email (3 failures/60s)
    - Return 503 when open, probe every 30s, log state transitions
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [ ]* 6.3 Write property test for circuit breaker transitions (Property 15)
    - **Property 15: Circuit breaker state transitions**
    - **Validates: Requirements 19.1–19.6**

  - [x] 6.4 Implement HTTP caching with ETag support
    - Add `Cache-Control: public, max-age=60` + ETag on public listing endpoints
    - Implement If-None-Match → 304 response
    - Set `Cache-Control: no-store` on authenticated endpoints
    - Invalidate Redis cache entries on write operations
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 20.4_

  - [ ]* 6.5 Write property tests for caching (Properties 16, 17, 18)
    - **Property 16: Cache invalidation on write**
    - **Property 17: HTTP cache headers match endpoint type**
    - **Property 18: ETag conditional response**
    - **Validates: Requirements 20.4, 21.1–21.5**

  - [x] 6.6 Configure MongoDB connection pooling
    - Update mongoose.connect options: `minPoolSize: 10`, `maxPoolSize: 50`, `maxIdleTimeMS: 30000`, `connectTimeoutMS: 10000`
    - Add pool utilization monitoring: log warning (once/60s) when active > 80% of max
    - _Requirements: 22.1, 22.2, 22.3_

  - [x] 6.7 Eliminate N+1 queries in list endpoints
    - Refactor reminder job to use single query with `.populate()` or aggregation pipeline
    - Refactor list endpoints to use `$in` or `$lookup` for related data
    - Ensure maximum 2 DB round-trips per list endpoint regardless of N
    - _Requirements: 23.1, 23.2, 23.3_

  - [x] 6.8 Implement SSE notifications endpoint
    - Create `server/routes/notifications.ts` with `GET /api/v1/notifications/stream`
    - Require authentication, set `Content-Type: text/event-stream`
    - Send heartbeat comment every 30s
    - Deliver notifications within 2s of creation
    - _Requirements: 24.1, 24.4, 24.5_

  - [x] 6.9 Implement SSE client-side connection
    - Establish SSE connection on user authentication in Client_App
    - Display received notifications without page refresh
    - Implement reconnect with exponential backoff (1s → 60s max)
    - _Requirements: 24.2, 24.3_

  - [x] 6.10 Implement admin panel code splitting
    - Wrap all page components with `React.lazy` and `Suspense`
    - Show loading indicator within 100ms of navigation
    - Ensure framer-motion not in initial entry chunk
    - Handle chunk load failure with retry
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

  - [x] 6.11 Optimize client performance
    - Implement `next/font` for Inter (300-700) and Fascinate (400) with `font-display: swap`
    - Use `next/image` for all user-facing images with explicit dimensions and `priority` on above-the-fold
    - Dynamically import framer-motion only on animated pages
    - _Requirements: 26.1, 26.2, 26.3, 46.1, 46.2, 46.3_

- [x] 7. Checkpoint - Resilience and performance complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Operations implementation
  - [x] 8.1 Implement structured logging with Pino
    - Install `pino` and `pino-http` in server workspace
    - Create `server/lib/logger.ts` with JSON output: timestamp, level, requestId, message, metadata
    - Generate requestId via `AsyncLocalStorage`, thread through all logs
    - Configure redaction for sensitive fields (password, token, refreshToken, secret, accountNumber, ifsc, pan, aadhaar, Authorization)
    - Replace JWT patterns with `[TOKEN_REDACTED]`
    - Suppress debug level in production, no `console.log` in production
    - Control request body logging via `LOG_REQUEST_BODY` env var (dev only, truncated to 500 chars)
    - _Requirements: 39.1, 39.2, 39.3, 39.4, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 8.2 Write property tests for logging (Properties 12, 19)
    - **Property 12: Log redaction of sensitive fields**
    - **Property 19: Structured log output format**
    - **Validates: Requirements 8.2, 8.4, 39.1, 39.2, 39.3**

  - [x] 8.3 Integrate APM and error tracking (Sentry)
    - Install and configure `@sentry/node` in server (unhandled exceptions + request context)
    - Install and configure `@sentry/nextjs` in client (errors + error boundary activations)
    - Install and configure `@sentry/react` in admin (errors)
    - Enable latency metrics: p50, p95, p99
    - _Requirements: 40.1, 40.2, 40.3, 40.4_

  - [x] 8.4 Implement health check endpoint
    - Create `GET /api/v1/health` returning MongoDB and Redis connection status
    - Return 200 with `{"status": "healthy"}` when all dependencies up
    - Return 503 with details when any dependency is degraded
    - 5-second timeout on dependency checks
    - _Requirements: 41.1, 41.2, 41.3, 41.4_

  - [x] 8.5 Configure zero-downtime deployment with PM2
    - Create `ecosystem.config.js` with cluster mode (2 instances), `wait_ready: true`, `listen_timeout: 10000`
    - Add `process.send('ready')` after server startup and health check pass
    - Document rolling restart procedure (`pm2 reload fira-api`)
    - _Requirements: 43.1, 43.2, 43.3, 43.4_

  - [x] 8.6 Set up database backup automation
    - Create cron job script for daily `mongodump`
    - Configure 30-day retention with daily granularity
    - Document restore procedure
    - _Requirements: 42.1, 42.2, 42.3, 42.4_

- [x] 9. Accessibility implementation
  - [x] 9.1 Implement skip navigation link
    - Create `client/src/components/SkipLink.tsx` as first focusable element in DOM
    - Position off-screen with `sr-only`, visible on focus with 4.5:1 contrast minimum
    - Set `href="#main-content"` targeting `<main id="main-content" tabIndex={-1}>`
    - _Requirements: 27.1, 27.2, 27.3, 27.4_

  - [x] 9.2 Add ARIA labels, roles, and live regions
    - Add `aria-label` to all icon-only buttons in Client_App and Admin_Panel
    - Add landmark roles: `banner`, `navigation`, `main`, `contentinfo`
    - Add `aria-live="polite"` for toasts, `aria-live="assertive"` for errors
    - _Requirements: 28.1, 28.2, 28.3, 28.4_

  - [ ]* 9.3 Write property test for icon-only buttons (Property 20)
    - **Property 20: Icon-only buttons have aria-label**
    - **Validates: Requirements 28.1, 28.3**

  - [x] 9.4 Fix color contrast to WCAG 2.1 AA
    - Audit and fix all text colors to meet 4.5:1 (normal) and 3:1 (large) ratios
    - Ensure dark theme gray text on #0a0a0a is no darker than gray-300 (#d1d5db)
    - Apply to both Client_App and Admin_Panel
    - _Requirements: 29.1, 29.2, 29.3_

  - [x] 9.5 Implement focus management
    - Move focus to `<main>` or first `<h1>` within 100ms of route change
    - Implement focus trap for modals (Tab/Shift+Tab cycle within)
    - Return focus to trigger element on modal close
    - Add visible 2px focus indicator with 3:1 contrast
    - _Requirements: 30.1, 30.2, 30.3, 30.4_

  - [x] 9.6 Implement reduced motion support
    - Add `@media (prefers-reduced-motion: reduce)` CSS to disable animations
    - Use `useReducedMotion()` hook from framer-motion to skip animations
    - Keep essential progress indicators linear, max 200ms, no bounce
    - Apply to both Client_App and Admin_Panel
    - _Requirements: 31.1, 31.2, 31.3, 31.4_

  - [x] 9.7 Implement form accessibility
    - Ensure every input has a visible `<label>` (no placeholder-only labels)
    - Link errors via `aria-describedby`
    - Announce errors with `role="alert"` or `aria-live="assertive"`
    - On submit with errors: focus moves to first invalid field
    - _Requirements: 32.1, 32.2, 32.3, 32.4_

  - [ ]* 9.8 Write property test for form error accessibility (Property 21)
    - **Property 21: Form errors linked via aria-describedby**
    - **Validates: Requirements 32.1, 32.2**

- [x] 10. Design and DX implementation
  - [x] 10.1 Create design tokens package
    - Create `packages/design-tokens/tokens.js` with colors, spacing, fontSize, borderRadius, shadows
    - Export tokens for consumption by both Tailwind configs
    - Update `client/tailwind.config.ts` and `admin/tailwind.config.js` to extend with tokens
    - _Requirements: 44.1, 44.2, 44.3, 44.4_

  - [x] 10.2 Migrate raw CSS to Tailwind utilities
    - Migrate `admin/src/components/Sidebar.css` → Tailwind classes
    - Migrate `admin/src/pages/Dashboard.css` → Tailwind classes
    - Migrate `admin/src/pages/Login.css` → Tailwind classes
    - Extract shared gradient patterns in client to Tailwind utilities
    - Delete CSS files (keep only `index.css` with Tailwind directives)
    - _Requirements: 45.1, 45.2, 45.3_

  - [x] 10.3 Optimize font loading
    - Client: implement `next/font/google` for Inter (300-700) and Fascinate (400) with `font-display: swap`
    - Admin: self-host font files via Vite build pipeline with CSS `@font-face`
    - Remove external font link tags
    - _Requirements: 46.1, 46.2, 46.3, 46.4_

- [ ] 11. Testing infrastructure setup
  - [x] 11.1 Configure Vitest for server with coverage gates
    - Install `vitest`, `supertest`, `mongodb-memory-server`, `fast-check` in server workspace
    - Create `server/vitest.config.ts` with coverage threshold of 60% line coverage
    - Configure test database using mongodb-memory-server
    - Set up `npm test` script in server `package.json`
    - _Requirements: 11.1, 11.4, 11.5_

  - [x] 11.2 Configure Vitest for client with coverage gates
    - Install `vitest`, `@testing-library/react`, `happy-dom`, `fast-check` in client workspace
    - Create `client/vitest.config.ts` with coverage threshold of 50% line coverage
    - Set up `npm test` script in client `package.json`
    - _Requirements: 12.1, 12.4_

  - [x] 11.3 Write server integration tests (one per route file)
    - Create integration tests verifying one 2xx and one 4xx response per route file
    - Test auth routes, event routes, venue routes, booking routes, payment routes
    - _Requirements: 11.2_

  - [x] 11.4 Write server unit tests for service-layer functions
    - Test success + failure paths for each exported service function
    - Cover authService, bookingService, paymentService, eventService, venueService
    - _Requirements: 11.3_

  - [x] 11.5 Write client component and hook tests
    - Create component tests for all shared UI components (Button, Input, etc.)
    - Write tests for custom hooks and utility functions (success + edge-case)
    - _Requirements: 12.2, 12.3_

  - [x] 11.6 Set up Playwright E2E test suite
    - Install `@playwright/test` at root level
    - Create three core journey tests: user registration, event booking, venue creation
    - Configure deterministic fixture data with reset before each suite
    - Set 5-minute timeout, capture screenshots + traces on failure
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 11.7 Configure CI pipeline (GitHub Actions)
    - Update `.github/workflows/deploy.yml` with test, lint, typecheck, and E2E stages
    - Fail build on test failure, lint error, or coverage below threshold
    - Fail build if debug files detected in server root
    - No `continue-on-error: true` or error suppression on lint commands
    - Use workspace-aware caching
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 47.4_

- [x] 12. TypeScript migration (server middleware and routes)
  - [x] 12.1 Convert middleware files to TypeScript
    - Rename and convert: cors, securityHeaders, auth, sanitize, csrf, asyncHandler middleware files
    - Add proper type annotations and interfaces
    - Ensure `tsc --noEmit` passes
    - _Requirements: 37.2_

  - [x] 12.2 Convert route files to TypeScript
    - Rename and convert all route files under `server/routes/` to `.ts`
    - Import shared types from `@fira/shared-types` package
    - Add request/response type annotations
    - _Requirements: 37.3_

- [x] 13. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (21 properties total)
- Unit tests validate specific examples and edge cases
- Security middleware files (3.1–3.17) are written in TypeScript from the start; task 12.1 handles any remaining JS middleware
- The design specifies TypeScript throughout — all new server files use `.ts` extension
- Font loading optimization (task 10.3) overlaps with client performance (task 6.11); implement once, both requirements are satisfied

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.5"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.6"] },
    { "id": 2, "tasks": ["3.1", "3.3", "3.7", "3.17"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.5", "3.8", "3.11"] },
    { "id": 4, "tasks": ["3.6", "3.9", "3.12", "3.13", "3.15"] },
    { "id": 5, "tasks": ["3.10", "3.14", "3.16", "5.1", "5.3"] },
    { "id": 6, "tasks": ["5.2", "5.4", "5.5", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.4", "6.6", "6.7"] },
    { "id": 8, "tasks": ["6.3", "6.5", "6.8", "6.10", "6.11"] },
    { "id": 9, "tasks": ["6.9", "8.1", "8.3"] },
    { "id": 10, "tasks": ["8.2", "8.4", "8.5", "8.6"] },
    { "id": 11, "tasks": ["9.1", "9.2", "9.4", "9.5", "9.6", "9.7"] },
    { "id": 12, "tasks": ["9.3", "9.8", "10.1"] },
    { "id": 13, "tasks": ["10.2", "10.3"] },
    { "id": 14, "tasks": ["11.1", "11.2"] },
    { "id": 15, "tasks": ["11.3", "11.4", "11.5", "11.6"] },
    { "id": 16, "tasks": ["11.7", "12.1"] },
    { "id": 17, "tasks": ["12.2"] }
  ]
}
```
