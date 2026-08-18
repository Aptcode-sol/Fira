# Requirements Document

## Introduction

This document defines the requirements for upgrading the FIRA platform (event/venue discovery and booking) from its current prototype-grade state to industry-standard production quality. The platform consists of three applications — an Express.js v5 API server, a Next.js 16 client, and a React 19 admin panel — deployed on EC2 via PM2. An audit revealed critical gaps in security, testing, error handling, performance, accessibility, architecture hygiene, DevOps maturity, and design consistency. These requirements address every identified deficiency with concrete, testable acceptance criteria.

## Glossary

- **API_Server**: The Express.js v5 backend application serving all REST endpoints for FIRA
- **Client_App**: The Next.js 16 (App Router, TypeScript) public-facing web application
- **Admin_Panel**: The React 19 + Vite internal administration dashboard
- **Auth_Middleware**: The JWT-based authentication middleware that validates bearer tokens on protected routes
- **Payment_Routes**: All API endpoints under `/api/payments` including payouts and refunds
- **Security_Headers**: HTTP response headers that mitigate common web vulnerabilities (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- **Circuit_Breaker**: A resilience pattern that stops calling a failing external service after repeated failures, allowing recovery time
- **Error_Boundary**: A React component that catches JavaScript errors in its child tree and renders a fallback UI
- **Design_Token**: A named, semantic variable (color, spacing, typography) that encodes design decisions and is shared across applications
- **Structured_Log**: A log entry emitted as JSON with standardized fields (timestamp, level, requestId, message) suitable for machine parsing
- **Health_Check**: An API endpoint that reports the operational status of the server and its dependencies (database, Redis, external services)
- **WCAG_2.1_AA**: Web Content Accessibility Guidelines version 2.1 at conformance level AA
- **Rate_Limiter**: Middleware that restricts the number of requests a client can make within a time window
- **Token_Blocklist**: A server-side store of revoked JWT tokens that are checked on each authenticated request
- **Connection_Pool**: A managed set of reusable database connections that avoids per-request connection overhead
- **APM**: Application Performance Monitoring — a system that traces requests end-to-end and surfaces latency bottlenecks

---

## Requirements

### Requirement 1: CORS Origin Restriction

**User Story:** As a platform operator, I want the API to reject requests from unauthorized origins, so that cross-origin attacks cannot exploit the API.

#### Acceptance Criteria

1. THE API_Server SHALL restrict CORS to an explicit allowlist of origins defined in the CORS_ALLOWED_ORIGINS environment variable as a comma-separated list of fully-qualified URLs (e.g., "https://app.fira.com,https://admin.fira.com")
2. WHEN a request arrives from an origin not in the allowlist, THE API_Server SHALL respond with HTTP 403 and omit Access-Control-Allow-Origin, Access-Control-Allow-Methods, and Access-Control-Allow-Headers headers from the response
3. WHEN a preflight OPTIONS request arrives from an allowed origin, THE API_Server SHALL respond with Access-Control-Allow-Origin set to the requesting origin, Access-Control-Allow-Methods listing the permitted HTTP methods, and Access-Control-Allow-Headers listing the permitted request headers, within 200ms
4. THE API_Server SHALL support distinct allowlists per environment by reading CORS_ALLOWED_ORIGINS from each environment's configuration, with production permitting only production domains, staging permitting only staging domains, and development permitting localhost origins
5. IF the CORS_ALLOWED_ORIGINS environment variable is missing or empty at startup, THEN THE API_Server SHALL refuse to start and log an error indicating the missing configuration

---

### Requirement 2: Security Headers

**User Story:** As a platform operator, I want all API responses to include standard security headers, so that common browser-based attacks are mitigated by default.

#### Acceptance Criteria

1. THE API_Server SHALL include security headers on every HTTP response, including error responses and health-check endpoints
2. THE API_Server SHALL set a Content-Security-Policy header with default-src 'self' and script-src restricted to 'self' plus any CDN origins explicitly listed in the CSP_TRUSTED_CDNS environment variable
3. THE API_Server SHALL set Strict-Transport-Security with max-age of at least 31536000 seconds, includeSubDomains directive, and preload directive
4. THE API_Server SHALL set X-Frame-Options to DENY
5. THE API_Server SHALL set X-Content-Type-Options to nosniff
6. THE API_Server SHALL set Referrer-Policy to strict-origin-when-cross-origin
7. THE API_Server SHALL set X-DNS-Prefetch-Control to off and X-Download-Options to noopen

---

### Requirement 3: Authentication on Sensitive Routes

**User Story:** As a platform operator, I want all payment, payout, and refund routes to require authentication, so that unauthorized users cannot view or manipulate financial data.

#### Acceptance Criteria

1. THE API_Server SHALL require Auth_Middleware on GET /api/payments (list all payments)
2. THE API_Server SHALL require Auth_Middleware on GET /api/payments/payouts/all
3. THE API_Server SHALL require Auth_Middleware on POST /api/payments/payouts
4. THE API_Server SHALL require Auth_Middleware on POST /api/payments/verify
5. THE API_Server SHALL require Auth_Middleware on all routes matching the path prefix /api/payments/refunds, including GET /api/payments/refunds, GET /api/payments/refunds/user/:userId, GET /api/payments/refunds/:id, and POST /api/payments/refunds/:id/process
6. WHEN a request to any protected route lacks a valid JWT token or provides an expired/malformed token, THE API_Server SHALL respond with HTTP 401 and a JSON body containing an "error" field with a message indicating the authentication failure reason
7. THE API_Server SHALL require admin-role authorization (via adminAuth middleware) on POST /api/payments/payouts (payout processing) and POST /api/payments/refunds/:id/process (refund approval), responding with HTTP 403 and a JSON body containing an "error" field if the authenticated user does not have the admin role

---

### Requirement 4: Request Body Size Limits

**User Story:** As a platform operator, I want request body sizes limited to reasonable values per route type, so that the server is not vulnerable to denial-of-service via large payloads.

#### Acceptance Criteria

1. THE API_Server SHALL enforce a default JSON body size limit of 1MB (1,048,576 bytes) for all API routes unless a route-specific override is configured
2. WHERE file upload routes are configured (routes using multer or accepting multipart/form-data such as /api/upload), THE API_Server SHALL enforce a body size limit of 10MB (10,485,760 bytes) on those specific routes
3. WHEN a request body exceeds the configured size limit for that route, THE API_Server SHALL reject the request with HTTP 413 (Payload Too Large) and a JSON body containing an "error" field indicating the size limit was exceeded, without processing the request body
4. THE API_Server SHALL NOT apply a global 50MB limit to all routes; the express.json() and express.urlencoded() middleware limits SHALL be set to 1MB by default

---

### Requirement 5: JWT Token Revocation

**User Story:** As a user, I want my session to be truly invalidated on logout, so that a stolen token cannot be used after I log out.

#### Acceptance Criteria

1. WHEN a user sends a logout request (POST /api/auth/logout) with a valid JWT token, THE API_Server SHALL add the token's jti (JWT ID) or the full token string to the Token_Blocklist and respond with HTTP 200 confirming logout
2. WHEN a request includes a token present in the Token_Blocklist, THE Auth_Middleware SHALL reject the request with HTTP 401 and a JSON body containing an "error" field indicating the session has been invalidated
3. THE Token_Blocklist SHALL automatically remove entries whose corresponding JWT has expired, based on the token's exp claim, to prevent unbounded growth of the blocklist
4. THE API_Server SHALL store the Token_Blocklist in Redis and perform blocklist lookups within 5ms at the 95th percentile under normal load (fewer than 100,000 active blocklist entries)
5. IF the Redis instance used for the Token_Blocklist is unavailable, THEN THE Auth_Middleware SHALL reject all requests with HTTP 503 and a JSON body containing an "error" field indicating temporary service unavailability, rather than allowing unverified tokens through

---

### Requirement 6: Input Sanitization

**User Story:** As a platform operator, I want all user-supplied input validated and sanitized, so that NoSQL injection and XSS attacks are prevented.

#### Acceptance Criteria

1. THE API_Server SHALL sanitize all request query parameters, body fields, and URL parameters by stripping or rejecting any keys that begin with the "$" character (including but not limited to $gt, $lt, $ne, $regex, $where, $expr, $in, $nin, $or, $and)
2. THE API_Server SHALL validate request body fields against defined schemas (using a validation library) before the request reaches route handlers, rejecting requests that do not conform to the schema
3. WHEN a request contains a MongoDB operator key in any user-supplied field, THE API_Server SHALL respond with HTTP 400 and a JSON body containing an "error" field indicating that the input contains prohibited characters or patterns
4. WHEN a request body fails schema validation, THE API_Server SHALL respond with HTTP 400 and a JSON body containing an "error" field describing which field(s) failed validation and why
5. THE API_Server SHALL apply sanitization as middleware (mounted before route handlers) so that no route handler receives unsanitized input regardless of whether schema validation is defined for that route

---

### Requirement 7: Sensitive Data Encryption

**User Story:** As a venue owner, I want my bank details and government ID stored encrypted, so that a database breach does not expose my financial and identity information in plaintext.

#### Acceptance Criteria

1. THE API_Server SHALL encrypt bank account details (account number, routing number/IFSC) at the field level before writing to the database using AES-256-GCM, producing a ciphertext that includes the initialization vector and authentication tag
2. THE API_Server SHALL encrypt government ID numbers (PAN, Aadhaar, or equivalent) at the field level before writing to the database using AES-256-GCM, producing a ciphertext that includes the initialization vector and authentication tag
3. THE API_Server SHALL decrypt sensitive fields only when the request is made by the owning venue user or an authenticated admin, and SHALL return masked values (showing only the last 4 characters) for all other authorized read operations
4. THE API_Server SHALL store encryption keys in environment variables (ENCRYPTION_KEY), separate from the database, and SHALL NOT commit encryption keys to version control
5. IF the ENCRYPTION_KEY environment variable is missing or is not exactly 32 bytes (256 bits) when decoded, THEN THE API_Server SHALL refuse to start and log a critical error indicating the encryption key is missing or malformed
6. THE API_Server SHALL generate a unique initialization vector (IV) for each encryption operation so that identical plaintext values produce different ciphertext values

---

### Requirement 8: Production Logging Safety

**User Story:** As a platform operator, I want production logs to never contain sensitive data, so that password and token leaks through log aggregation are prevented.

#### Acceptance Criteria

1. WHILE the NODE_ENV environment variable is set to "production", THE API_Server SHALL NOT log request body contents, query parameters containing tokens, or any field values from user input
2. THE API_Server SHALL redact the following fields from all log output in all environments: Authorization headers (replacing the value with "[REDACTED]"), any field named "password", "token", "refreshToken", "secret", "accountNumber", "ifsc", "pan", or "aadhaar"
3. WHILE the NODE_ENV environment variable is set to "development", THE API_Server SHALL allow request body logging when the LOG_REQUEST_BODY environment variable is set to "true", truncating logged bodies to a maximum of 500 characters
4. IF a log entry would contain a JWT token value (matching the pattern "eyJ..."), THEN THE API_Server SHALL replace the token with "[TOKEN_REDACTED]" before writing the log entry

---

### Requirement 9: Admin Credential Security

**User Story:** As a platform operator, I want demo credentials removed from the admin login page, so that attackers cannot discover valid admin accounts.

#### Acceptance Criteria

1. THE Admin_Panel SHALL NOT render any text containing usernames, passwords, email-password pairs, or login hints (including placeholder attribute values that suggest real credentials such as "admin@gmail.com") on the login page when the build target is production
2. WHERE a development environment flag is set (NODE_ENV=development or VITE_DEV_MODE=true), THE Admin_Panel SHALL allow displaying test credentials in a clearly labeled development-only banner
3. WHEN the production build output is generated, THE Admin_Panel SHALL NOT include any string literal matching a known demo credential (e.g., "admin123", "admin@gmail.com / admin123") in the compiled JavaScript bundle

---

### Requirement 10: CSRF Protection

**User Story:** As a user, I want state-changing API requests protected against cross-site request forgery, so that malicious sites cannot perform actions on my behalf.

#### Acceptance Criteria

1. THE API_Server SHALL validate a CSRF token on all state-changing requests (POST, PUT, DELETE, PATCH) originating from browser clients identified by the presence of a Cookie header or Origin/Referer matching the application domain
2. THE API_Server SHALL issue CSRF tokens via a secure, HttpOnly cookie with SameSite=Strict attribute, and the token SHALL have a minimum length of 32 cryptographically random bytes
3. WHEN a state-changing request lacks a valid CSRF token or presents an expired or malformed token, THE API_Server SHALL reject the request with HTTP 403 and a response body containing an error message indicating the CSRF validation failure
4. IF the request originates from a non-browser client (identified by absence of Cookie header and no matching Origin/Referer), THEN THE API_Server SHALL skip CSRF validation and rely on bearer token authentication alone

---

### Requirement 11: Testing Infrastructure — Server

**User Story:** As a developer, I want a working test framework for the server, so that I can write and run automated tests for API logic.

#### Acceptance Criteria

1. THE API_Server SHALL include a configured test runner (Vitest or Jest) with a working `npm test` script that exits with code 0 on all tests passing and code 1 on any failure
2. THE API_Server SHALL include at least one integration test per route file that verifies one successful response (2xx) and one error response (4xx) per route file
3. THE API_Server SHALL include unit tests for all service-layer business logic functions, testing at minimum one success path and one failure path per exported function
4. THE API_Server SHALL achieve a minimum of 60% line coverage on service and middleware modules as reported by the test runner's coverage tool, and the `npm test` script SHALL fail if coverage drops below this threshold
5. THE API_Server SHALL include a test database configuration using either an in-memory MongoDB instance (mongodb-memory-server) or a dedicated test database connection string, ensuring test execution does not read from or write to the development database

---

### Requirement 12: Testing Infrastructure — Client

**User Story:** As a developer, I want a working test framework for the client, so that I can verify component behavior and user interactions.

#### Acceptance Criteria

1. THE Client_App SHALL include a configured test runner (Vitest) with a working `npm test` script that exits with code 0 on all tests passing and code 1 on any failure
2. THE Client_App SHALL include component tests for all shared UI components using React Testing Library, verifying that each component renders without errors and responds to user interaction events
3. THE Client_App SHALL include tests for all custom hooks and utility functions, verifying at minimum one success path and one edge-case path per exported function
4. THE Client_App SHALL achieve a minimum of 50% line coverage on component and utility modules as reported by the test runner's coverage tool, and the `npm test` script SHALL fail if coverage drops below this threshold

---

### Requirement 13: Testing Infrastructure — End-to-End

**User Story:** As a developer, I want end-to-end tests covering critical user journeys, so that cross-system integration is verified before deployment.

#### Acceptance Criteria

1. THE platform SHALL include an E2E test suite using Playwright covering the following complete journeys: user registration (signup through email verification), event booking with payment (event selection through payment confirmation and ticket receipt), and venue creation (form submission through venue appearing in listings)
2. THE E2E test suite SHALL run against a test environment seeded with deterministic fixture data that is reset before each test suite run, ensuring test isolation and repeatability
3. THE E2E test suite SHALL complete all core journey tests within 5 minutes of wall-clock time when executed on a single CI runner with standard resource allocation (2 CPU cores, 4 GB RAM)
4. WHEN any E2E test fails, THE E2E test suite SHALL capture a screenshot and a trace file of the failure state and store them as artifacts accessible after the test run

---

### Requirement 14: CI Test Gate

**User Story:** As a team lead, I want CI to fail on test failures and lint errors, so that broken code cannot reach production.

#### Acceptance Criteria

1. THE CI pipeline SHALL execute all server unit and integration tests via `npm test` in the server directory and SHALL fail the build (exit with non-zero status) on any test failure
2. THE CI pipeline SHALL execute all client tests via `npm test` in the client directory and SHALL fail the build (exit with non-zero status) on any test failure
3. THE CI pipeline SHALL execute linting for both admin and client packages without suppressing errors — specifically, the pipeline SHALL NOT use `continue-on-error: true`, `|| true`, or `2>/dev/null` on lint commands, and a non-zero lint exit code SHALL fail the build
4. THE CI pipeline SHALL fail the build if code coverage reported by the server or client test runner drops below the configured minimum threshold (60% for server, 50% for client)
5. THE CI pipeline SHALL NOT contain any of the following debug/test scripts in the server root directory at build time: testServer.js, testServer2.js, testServer3.js, testServer4.js, debugEventData.js, tmp_check_events.js — and SHALL fail the build if any of these files are detected

---

### Requirement 15: React Error Boundaries — Client

**User Story:** As a user, I want errors in one section of the page to not crash the entire application, so that I can continue using unaffected features.

#### Acceptance Criteria

1. THE Client_App SHALL include a global error.tsx file at the app root (src/app/error.tsx) that renders a fallback page containing a human-readable error description (without stack traces) and a retry button that re-attempts rendering the failed segment
2. THE Client_App SHALL include error.tsx files for each of the following major route segments: events, venues, bookings (dashboard/bookings), and create
3. WHEN an uncaught error occurs within a route segment, THE Client_App SHALL render the nearest ancestor error.tsx boundary fallback UI without unmounting or crashing components in sibling route segments
4. WHEN an error boundary catches an error, THE Client_App SHALL log the error details (error message, component stack, and current URL) to the configured error tracking service within 5 seconds of the error occurring

---

### Requirement 16: React Error Boundaries — Admin

**User Story:** As an admin, I want the admin panel to gracefully handle component errors, so that a bug in one page does not prevent access to other pages.

#### Acceptance Criteria

1. THE Admin_Panel SHALL include a top-level ErrorBoundary component wrapping the router outlet (the Routes component inside AdminDashboardLayout) that catches any unhandled rendering error from child routes
2. THE Admin_Panel SHALL include per-page error boundaries wrapping the content of each of the following pages: Dashboard, Events, Venues, Brands, and Users
3. WHEN an error is caught by any error boundary, THE Admin_Panel SHALL display a fallback UI containing a human-readable error description (without stack traces), a "Retry" button that re-attempts rendering the failed component, and a "Go to Dashboard" link that navigates to the root path
4. WHEN a per-page error boundary catches an error, THE Admin_Panel SHALL keep the sidebar navigation and top-level layout functional, allowing the admin to navigate to other pages without a full page reload

---

### Requirement 17: Async Error Handling — Server

**User Story:** As a developer, I want unhandled async errors in route handlers caught automatically, so that the server returns proper error responses instead of hanging or crashing.

#### Acceptance Criteria

1. THE API_Server SHALL wrap all async route handlers with an error-catching mechanism that forwards thrown errors and rejected promises to the Express error-handling middleware
2. WHEN an unhandled promise rejection occurs in a route handler, THE API_Server SHALL respond with HTTP 500, a JSON body containing an error message and a unique alphanumeric reference ID of at least 6 characters, and log the error with the same reference ID to the server console
3. THE API_Server SHALL NOT allow unhandled promise rejections to crash the Node.js process; the process SHALL remain responsive to subsequent requests after such an error
4. IF the async route handler throws a non-Error object (e.g., a string or undefined), THEN THE API_Server SHALL still forward a 500 response with a reference ID rather than leaving the request unanswered

---

### Requirement 18: Graceful Shutdown

**User Story:** As a platform operator, I want the server to shut down gracefully, so that in-flight requests complete and database connections close cleanly during deployments.

#### Acceptance Criteria

1. WHEN a SIGTERM or SIGINT signal is received, THE API_Server SHALL stop accepting new TCP connections within 1 second and respond to any new connection attempts with a connection-refused error
2. WHEN a shutdown signal is received, THE API_Server SHALL wait up to 30 seconds for in-flight HTTP requests to complete their response cycle before closing the HTTP server
3. WHEN a shutdown signal is received and all in-flight requests have completed (or the 30-second timeout has elapsed), THE API_Server SHALL close the MongoDB connection pool by calling the Mongoose disconnect method
4. WHEN a shutdown signal is received and all in-flight requests have completed (or the 30-second timeout has elapsed), THE API_Server SHALL close the Redis connection by calling the Redis client quit method
5. IF in-flight requests do not complete within 30 seconds, THEN THE API_Server SHALL log a warning indicating the number of requests that were forcibly terminated and force-terminate the process with exit code 1
6. WHEN all connections are closed successfully within the 30-second window, THE API_Server SHALL terminate the process with exit code 0

---

### Requirement 19: Circuit Breaker for External Services

**User Story:** As a platform operator, I want calls to external services (Razorpay, Cloudinary, email) to use circuit breakers, so that a failing dependency does not cascade into full platform unavailability.

#### Acceptance Criteria

1. THE API_Server SHALL implement a Circuit_Breaker for Razorpay API calls that transitions to the open state after 5 consecutive failures occurring within a rolling 60-second window
2. THE API_Server SHALL implement a Circuit_Breaker for Cloudinary API calls that transitions to the open state after 5 consecutive failures occurring within a rolling 60-second window
3. THE API_Server SHALL implement a Circuit_Breaker for email service calls that transitions to the open state after 3 consecutive failures occurring within a rolling 60-second window
4. WHILE a Circuit_Breaker is in the open state, THE API_Server SHALL immediately return an HTTP 503 response with a JSON body indicating which service is unavailable, without making any network call to the external service
5. WHILE a Circuit_Breaker is in the open state, THE API_Server SHALL attempt a single probe request to the external service every 30 seconds; IF the probe succeeds, THEN THE API_Server SHALL transition the Circuit_Breaker to the closed state and resume normal requests
6. IF a probe request fails while the Circuit_Breaker is open, THEN THE API_Server SHALL keep the Circuit_Breaker in the open state and schedule the next probe in 30 seconds
7. WHEN a Circuit_Breaker transitions between states (closed→open, open→closed), THE API_Server SHALL log the transition including the service name and the timestamp
2. THE API_Server SHALL implement a Circuit_Breaker for Cloudinary API calls that opens after 5 consecutive failures within 60 seconds
3. THE API_Server SHALL implement a Circuit_Breaker for email service calls that opens after 3 consecutive failures within 60 seconds
4. WHILE a Circuit_Breaker is open, THE API_Server SHALL return a service-unavailable response (HTTP 503) without calling the external service
5. THE API_Server SHALL attempt a single probe request every 30 seconds while a Circuit_Breaker is open to detect recovery

---

### Requirement 20: Redis Activation for Caching and Session

**User Story:** As a platform operator, I want the existing Redis service used for OTP storage, token blocklisting, and response caching, so that MongoDB is not used for ephemeral data.

#### Acceptance Criteria

1. THE API_Server SHALL store OTP codes in Redis with a TTL equal to the OTP validity period (600 seconds) so that expired OTPs are automatically removed without a separate cleanup process
2. THE API_Server SHALL store the Token_Blocklist in Redis with a TTL equal to the remaining lifetime of the blocked token, so that entries expire automatically when the token would have expired
3. THE API_Server SHALL cache GET responses for event listings and venue listings in Redis with a configurable TTL that defaults to 300 seconds
4. WHEN a write operation (create, update, or delete) modifies an event or venue document, THE API_Server SHALL invalidate all cache entries for the corresponding listing endpoint within the same request cycle
5. IF Redis is unavailable at request time, THEN THE API_Server SHALL fall back to direct MongoDB queries, log a warning once per 60 seconds indicating Redis is unreachable, and continue serving requests without returning an error to the client

---

### Requirement 21: HTTP Response Caching

**User Story:** As a user, I want public content responses cached appropriately, so that pages load faster and server load is reduced.

#### Acceptance Criteria

1. THE API_Server SHALL set the Cache-Control header to "public, max-age=60" on successful GET responses (HTTP 200) for public event listing and venue listing endpoints
2. THE API_Server SHALL set an ETag header on successful GET responses for public event and venue listing endpoints, where the ETag value is derived from the response content such that identical content produces the same ETag
3. WHEN a client sends a GET request with an If-None-Match header whose value matches the current ETag for the requested resource, THE API_Server SHALL respond with HTTP 304 (Not Modified) and an empty body, without re-serializing the full response payload
4. THE API_Server SHALL set the Cache-Control header to "no-store" on all responses from authenticated endpoints that return user-specific data (e.g., user profile, bookings, tickets, notifications)
5. THE API_Server SHALL NOT set public caching headers on any response that includes user-specific or authentication-dependent content

---

### Requirement 22: Database Connection Pooling

**User Story:** As a platform operator, I want MongoDB connections pooled and configured, so that the server handles concurrent requests efficiently without connection exhaustion.

#### Acceptance Criteria

1. THE API_Server SHALL configure the Mongoose connection with a minimum connection pool size of 10 connections and a maximum connection pool size of 50 connections
2. THE API_Server SHALL set the connection pool maximum idle time to 30 seconds and the socket connection timeout to 10 seconds in the Mongoose connection options
3. WHEN connection pool utilization exceeds 80% of the configured maximum pool size, THE API_Server SHALL log a warning including the current active connection count and the maximum pool size, at most once per 60 seconds to avoid log flooding

---

### Requirement 23: N+1 Query Elimination

**User Story:** As a platform operator, I want batch queries used where the system currently issues individual queries in loops, so that database load scales with pages not records.

#### Acceptance Criteria

1. THE API_Server SHALL resolve the reminder job's ticket-to-user data using a single query with populate or an aggregation pipeline per event, instead of issuing a separate query for each ticket
2. THE API_Server SHALL use batch queries (using $in operator or aggregation pipelines) wherever multiple documents of the same collection are fetched, rather than issuing individual findById calls in a loop
3. WHEN a list endpoint returns N items with related data (e.g., events with venue details, bookings with user details), THE API_Server SHALL resolve all related data in at most 2 database round-trips regardless of the value of N

---

### Requirement 24: Real-Time Notifications via SSE

**User Story:** As a user, I want to receive notifications in real time without polling, so that I see updates immediately without unnecessary network requests.

#### Acceptance Criteria

1. THE API_Server SHALL provide a Server-Sent Events (SSE) endpoint at a dedicated path that requires a valid authentication token and streams notification events to the connected user using the text/event-stream content type
2. THE Client_App SHALL establish an SSE connection to the notification endpoint upon user authentication and display received notification events in the UI without requiring page refresh or periodic polling
3. IF the SSE connection drops unexpectedly, THEN THE Client_App SHALL automatically reconnect using exponential backoff starting at 1 second, doubling on each attempt, up to a maximum interval of 60 seconds
4. WHILE an SSE connection is active, THE API_Server SHALL send a heartbeat comment event (SSE comment line) every 30 seconds to prevent proxy or load-balancer idle-timeout disconnections
5. WHEN a new notification is created for a user who has an active SSE connection, THE API_Server SHALL deliver the notification event to that user's SSE stream within 2 seconds of creation

---

### Requirement 25: Code Splitting — Admin Panel

**User Story:** As an admin, I want the admin panel to load only the code needed for the current page, so that initial load time is minimized.

#### Acceptance Criteria

1. THE Admin_Panel SHALL lazy-load all page-level route components using React.lazy and Suspense, such that no page component is included in the main entry bundle
2. WHEN a lazy-loaded page component is being fetched, THE Admin_Panel SHALL display a visible loading indicator within 100 milliseconds of navigation start, and the indicator SHALL remain visible until the chunk finishes loading
3. THE Admin_Panel SHALL NOT include framer-motion in the initial entry-point chunk — framer-motion SHALL be imported only within lazy-loaded page components that use animations
4. WHEN a production build is generated, THE Admin_Panel build SHALL produce at least one separate chunk per route, verifiable by inspecting the Vite build output where each route's chunk filename is distinct from the main entry chunk
5. IF a lazy-loaded chunk fails to load due to a network error, THEN THE Admin_Panel SHALL display an error message indicating the page failed to load and SHALL provide a retry mechanism to re-attempt the chunk fetch

---

### Requirement 26: Client Performance Optimization

**User Story:** As a user, I want the client application to load quickly and feel responsive, so that I can discover and book events without waiting.

#### Acceptance Criteria

1. THE Client_App SHALL load Google Fonts via next/font instead of external link tags, such that no render-blocking font requests appear in the network waterfall during initial page load
2. THE Client_App SHALL import framer-motion only within page components that use animations — framer-motion SHALL NOT appear in the shared layout bundle or in chunks loaded by pages without animations
3. THE Client_App SHALL use next/image for all user-facing images, each with explicit width, height attributes and the priority attribute set on above-the-fold images on the home page
4. THE Client_App home page SHALL achieve a Largest Contentful Paint (LCP) under 2.5 seconds when measured using Lighthouse in mobile mode with a simulated throttled 4G connection (1.6 Mbps download, 150ms RTT)
5. THE Client_App home page SHALL achieve a Total Blocking Time (TBT) under 200 milliseconds when measured using Lighthouse in mobile mode with a simulated throttled 4G connection

1. THE Client_App SHALL load Google Fonts via next/font instead of external link tags to eliminate render-blocking requests
2. THE Client_App SHALL lazy-load framer-motion only on pages with animations, not globally
3. THE Client_App SHALL use next/image for all user-facing images with appropriate width, height, and priority attributes
4. THE Client_App SHALL achieve a Largest Contentful Paint (LCP) under 2.5 seconds on a simulated 4G connection for the home page

---

### Requirement 27: Skip Navigation Link

**User Story:** As a keyboard or screen reader user, I want a skip-to-content link, so that I can bypass repetitive navigation on every page.

#### Acceptance Criteria

1. THE Client_App SHALL render a skip-to-content link as the first focusable element in the DOM on every page, positioned off-screen using CSS so it is not visible to sighted users by default
2. WHEN the skip-to-content link receives keyboard focus via Tab, THE Client_App SHALL make the link visible on screen within the viewport, with sufficient contrast (minimum 4.5:1) against its background
3. WHEN the skip-to-content link is activated via Enter key or click, THE Client_App SHALL move keyboard focus to the element with the main landmark role (the main element), and subsequent Tab presses SHALL continue from within the main content
4. THE Client_App SHALL set the skip link's href to reference the id of the main content landmark, ensuring the target element has tabindex="-1" or is natively focusable so that focus transfer succeeds across all supported browsers

---

### Requirement 28: ARIA Labels and Roles

**User Story:** As a screen reader user, I want all interactive elements properly labeled, so that I can understand and operate the interface.

#### Acceptance Criteria

1. THE Client_App SHALL provide an aria-label or aria-labelledby attribute on every button that contains only an icon (no visible text), with a label that describes the button's action (e.g., "Close menu", "Search")
2. THE Client_App SHALL use ARIA landmark roles — banner on the site header, navigation on nav elements, main on the primary content area, and contentinfo on the site footer — such that a screen reader's landmark navigation lists exactly these regions
3. THE Admin_Panel SHALL provide an aria-label attribute on every button that contains only an icon (no visible text), with a label that describes the button's action
4. WHEN dynamic content updates occur in the Client_App (such as toast notifications, live search results, or form submission confirmations), THE Client_App SHALL announce the update via an aria-live region using politeness level "polite" for non-urgent updates and "assertive" for error or confirmation messages that require immediate attention

---

### Requirement 29: Color Contrast Compliance

**User Story:** As a user with low vision, I want text to have sufficient contrast against its background, so that I can read all content.

#### Acceptance Criteria

1. THE Client_App SHALL maintain a minimum contrast ratio of 4.5:1 for normal text (below 18pt regular or 14pt bold) and 3:1 for large text (18pt regular or 14pt bold and above) as defined by WCAG 2.1 AA Success Criterion 1.4.3, verifiable using an automated contrast checking tool
2. THE Admin_Panel SHALL maintain a minimum contrast ratio of 4.5:1 for normal text (below 18pt regular or 14pt bold) and 3:1 for large text (18pt regular or 14pt bold and above) as defined by WCAG 2.1 AA Success Criterion 1.4.3
3. THE Client_App SHALL NOT use any text color with a contrast ratio below 4.5:1 against its background on dark-themed surfaces — any gray text on the dark background (#0a0a0a) SHALL have a luminance no darker than gray-300 (#d1d5db), yielding a minimum contrast ratio of 4.5:1 for normal text

---

### Requirement 30: Focus Management

**User Story:** As a keyboard user, I want focus managed correctly during navigation and modal interactions, so that I always know where I am on the page.

#### Acceptance Criteria

1. WHEN a client-side route change occurs in the Client_App, THE Client_App SHALL move keyboard focus to either the main content landmark or the first h1 heading on the new page within 100 milliseconds of the route transition completing
2. WHEN a modal or mobile menu opens in the Client_App, THE Client_App SHALL trap keyboard focus within the modal or menu such that Tab and Shift+Tab cycle only through focusable elements inside it, and focus SHALL NOT move to elements behind the modal
3. WHEN a modal or mobile menu is dismissed (via close button, Escape key, or overlay click), THE Client_App SHALL return keyboard focus to the element that triggered the modal's opening
4. THE Client_App SHALL display a visible focus indicator with a minimum 2px outline on all interactive elements (links, buttons, inputs, selects) when navigated to via keyboard, and the focus indicator SHALL have a contrast ratio of at least 3:1 against adjacent colors

---

### Requirement 31: Reduced Motion Support

**User Story:** As a user with vestibular disorders, I want animations reduced when I have configured my OS to prefer reduced motion, so that the interface does not cause discomfort.

#### Acceptance Criteria

1. WHEN the user's operating system reports prefers-reduced-motion: reduce, THE Client_App SHALL disable or replace all non-essential animations (entrance transitions, parallax, auto-playing motion) with instant state changes or opacity-only fades with a duration no longer than 100 milliseconds
2. WHEN prefers-reduced-motion: reduce is active, THE Client_App SHALL skip all framer-motion entrance and exit animations such that components render in their final state immediately without any motion interpolation
3. WHILE prefers-reduced-motion: reduce is active, THE Admin_Panel SHALL suppress all animated transitions (page transitions, sidebar animations, loading spinners with motion) and render elements in their final visual state immediately
4. WHEN prefers-reduced-motion: reduce is active, essential functional animations (such as progress bars indicating loading state) SHALL remain operational but SHALL use linear, non-bouncing motion with a maximum duration of 200 milliseconds

---

### Requirement 32: Form Accessibility

**User Story:** As a screen reader user, I want form errors announced to me, so that I know what to correct without relying on visual cues alone.

#### Acceptance Criteria

1. WHEN a form validation error occurs in the Client_App, THE Client_App SHALL programmatically associate the error message with its corresponding input field using aria-describedby, where the error element's id matches the aria-describedby value on the input
2. WHEN one or more form validation errors appear after form submission or field blur, THE Client_App SHALL announce the errors to screen readers by rendering error messages within an element with role="alert" or within an aria-live="assertive" region, ensuring the announcement occurs within 100 milliseconds of the validation result
3. THE Client_App SHALL provide a visible text label (using a label element with a for attribute matching the input's id, or wrapping the input) for every form input — placeholder text alone SHALL NOT serve as the sole label
4. WHEN multiple form validation errors exist after submission, THE Client_App SHALL move focus to the first invalid input field so the user can begin correcting errors sequentially

---

### Requirement 33: Remove Debug and Test Files

**User Story:** As a developer, I want the repository free of debug scripts and test artifacts, so that production code is clearly separated from throwaway experiments.

#### Acceptance Criteria

1. THE repository SHALL NOT contain the files: testServer.js, testServer2.js, testServer3.js, debugEventData.js, tmp_check_events.js, or any other ad-hoc debug scripts in the server root
2. THE repository SHALL move seed files into a dedicated `/server/seeds/` directory, clearly separated from production source
3. THE repository SHALL remove empty placeholder files (server/routes/index.js, server/services/index.js) that serve no purpose
4. THE repository SHALL remove the spurious Windows-path directory from client/src

---

### Requirement 34: Deduplicate Auth Middleware

**User Story:** As a developer, I want a single source of truth for authentication logic, so that auth changes are applied consistently across all routes.

#### Acceptance Criteria

1. THE API_Server SHALL consolidate auth.js and venueOwnerAuth.js into a single parameterized auth middleware that accepts role requirements
2. THE API_Server SHALL support role-based authorization (user, venueOwner, admin) through the unified middleware
3. THE API_Server SHALL NOT maintain duplicate authentication logic in separate files

---

### Requirement 35: API Versioning

**User Story:** As a platform operator, I want the API versioned, so that breaking changes can be introduced without disrupting existing clients.

#### Acceptance Criteria

1. THE API_Server SHALL prefix all routes with /api/v1/
2. THE API_Server SHALL maintain backward compatibility within a major version
3. WHEN a new API version is introduced, THE API_Server SHALL continue serving the previous version for a documented deprecation period

---

### Requirement 36: Shared Type Contracts

**User Story:** As a developer, I want API request/response types shared between server and client, so that type mismatches are caught at compile time rather than runtime.

#### Acceptance Criteria

1. THE platform SHALL maintain a shared types package (or directory) defining all API request and response interfaces
2. THE Client_App SHALL import API types from the shared package for all API calls
3. THE API_Server SHALL validate request bodies against the shared type definitions
4. WHEN a shared type is modified, THE CI pipeline SHALL verify that both client and server compile successfully

---

### Requirement 37: TypeScript Migration Path — Server

**User Story:** As a developer, I want the server progressively migrated to TypeScript, so that type safety catches bugs before runtime.

#### Acceptance Criteria

1. THE API_Server SHALL include a tsconfig.json configured for gradual adoption (allowJs: true, strict: false initially)
2. THE API_Server SHALL convert all middleware files to TypeScript as the first migration step
3. THE API_Server SHALL convert all route files to TypeScript as the second migration step
4. THE API_Server SHALL configure the CI pipeline to run TypeScript type-checking (tsc --noEmit) on all .ts files

---

### Requirement 38: Remove Committed Environment File

**User Story:** As a platform operator, I want secrets not committed to version control, so that credentials are not exposed in the Git history.

#### Acceptance Criteria

1. THE repository SHALL add client/.env to .gitignore
2. THE repository SHALL provide a client/.env.example with placeholder values and documentation
3. THE repository SHALL purge client/.env from Git history using BFG or git-filter-repo

---

### Requirement 39: Structured Logging

**User Story:** As a platform operator, I want structured JSON logs with request context, so that logs are searchable, parseable, and useful for debugging production issues.

#### Acceptance Criteria

1. THE API_Server SHALL emit all log entries as JSON objects with fields: timestamp, level, requestId, message, and optional metadata
2. THE API_Server SHALL generate a unique requestId for each incoming request and include it in all log entries for that request
3. THE API_Server SHALL use log levels (error, warn, info, debug) consistently and suppress debug-level logs in production
4. THE API_Server SHALL NOT use console.log for production logging — a structured logger (pino or winston) SHALL be used

---

### Requirement 40: Application Performance Monitoring and Error Tracking

**User Story:** As a platform operator, I want runtime errors and performance issues automatically captured and reported, so that the team is alerted to production problems without relying on user reports.

#### Acceptance Criteria

1. THE API_Server SHALL integrate an error tracking service (Sentry or equivalent) that captures unhandled exceptions with full stack traces and request context
2. THE Client_App SHALL integrate client-side error tracking that reports uncaught exceptions and React error boundary activations
3. THE Admin_Panel SHALL integrate client-side error tracking
4. THE API_Server SHALL report request latency metrics for p50, p95, and p99 percentiles

---

### Requirement 41: Comprehensive Health Check

**User Story:** As a platform operator, I want a health check endpoint that reports the status of all dependencies, so that load balancers and monitoring can detect degraded states.

#### Acceptance Criteria

1. THE API_Server SHALL expose a GET /health endpoint that returns the status of: MongoDB connection, Redis connection, and external service reachability
2. WHEN all dependencies are healthy, THE Health_Check SHALL return HTTP 200 with `{"status": "healthy"}`
3. WHEN one or more dependencies are degraded, THE Health_Check SHALL return HTTP 503 with details of which dependency is unhealthy
4. THE Health_Check SHALL complete within 5 seconds (timeout on slow dependency checks)

---

### Requirement 42: Database Backup Strategy

**User Story:** As a platform operator, I want automated database backups with tested restore procedures, so that data can be recovered in case of corruption or accidental deletion.

#### Acceptance Criteria

1. THE platform SHALL perform automated MongoDB backups at least once every 24 hours
2. THE platform SHALL retain backups for a minimum of 30 days with daily granularity
3. THE platform SHALL store backups in a separate storage location from the primary database
4. THE platform SHALL include a documented and tested restore procedure that can recover the database to any backup point within the retention period

---

### Requirement 43: Zero-Downtime Deployment

**User Story:** As a platform operator, I want deployments to occur without user-visible downtime, so that releases do not interrupt active users.

#### Acceptance Criteria

1. THE deployment pipeline SHALL implement a rolling or blue-green deployment strategy that keeps at least one instance serving traffic at all times
2. THE deployment pipeline SHALL perform a health check on the new instance before routing traffic to it
3. IF the new instance fails the health check, THEN THE deployment pipeline SHALL automatically rollback to the previous version
4. THE deployment pipeline SHALL complete within 10 minutes from merge to production traffic

---

### Requirement 44: Design Tokens

**User Story:** As a developer, I want design decisions encoded as tokens, so that colors, spacing, and typography are consistent and changeable from one place.

#### Acceptance Criteria

1. THE platform SHALL define a shared set of Design_Tokens for colors, spacing scale, typography scale, border-radius, and shadows
2. THE Client_App SHALL reference Design_Tokens through Tailwind CSS theme configuration instead of hardcoded values
3. THE Admin_Panel SHALL reference the same Design_Tokens through its Tailwind CSS theme configuration
4. THE platform SHALL NOT use raw CSS color values (hex, rgb) outside of the token definitions

---

### Requirement 45: Remove Raw CSS Files

**User Story:** As a developer, I want all styling handled through Tailwind utility classes and the design token system, so that style maintenance is centralized and consistent.

#### Acceptance Criteria

1. THE Admin_Panel SHALL migrate Sidebar.css, Dashboard.css, and Login.css styles into Tailwind utility classes
2. THE Admin_Panel SHALL NOT contain standalone .css files (excluding the single index.css with Tailwind directives)
3. THE Client_App SHALL NOT duplicate gradient definitions across multiple files — shared visual patterns SHALL be extracted into Tailwind utilities or component classes

---

### Requirement 46: Font Loading Optimization

**User Story:** As a user, I want fonts loaded optimally without render-blocking external requests, so that text is visible immediately and layout shift is minimized.

#### Acceptance Criteria

1. THE Client_App SHALL load all Google Fonts using next/font (local or Google provider) instead of external link tags
2. THE Client_App SHALL configure font-display: swap to ensure text remains visible during font loading
3. THE Client_App SHALL preload only the font weights actually used (currently Inter 300-700 and Fascinate 400)
4. THE Admin_Panel SHALL load fonts via the Vite build pipeline rather than external link tags

---

### Requirement 47: Monorepo Tooling

**User Story:** As a developer, I want a unified workspace management approach, so that dependencies are deduplicated, scripts are run from the root, and cross-package changes are atomic.

#### Acceptance Criteria

1. THE platform SHALL configure a monorepo tool (npm workspaces, Turborepo, or equivalent) with a root package.json declaring all three packages (server, client, admin)
2. THE platform SHALL support running build, test, and lint commands from the root directory for all packages
3. THE platform SHALL deduplicate shared dependencies (react, typescript, tailwindcss) where version ranges overlap
4. THE CI pipeline SHALL use the monorepo tool for caching and incremental builds

---

