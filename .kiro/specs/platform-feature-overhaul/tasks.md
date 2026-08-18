# Implementation Plan: Platform Feature Overhaul

## Overview

This plan implements 19 requirements across 7 domains for the Firaa platform. The approach is bottom-up: schema changes first, then service layer, then routes, then UI (admin panel and client). Property-based tests are placed close to the logic they validate. The stack is Express + MongoDB (Mongoose) server, React + Vite admin panel, and Next.js 16 client.

## Tasks

- [x] 1. Schema changes and new models
  - [x] 1.1 Add `adminRole` field to User model and `bankDetails` sub-document
    - Add `adminRole: { type: String, enum: ['super_admin', 'admin', 'moderator'], default: null }` to User schema
    - Add `bankDetails: { accountName, accountNumber, ifscCode, bankName }` sub-document to User schema
    - _Requirements: 3.1, 13.4_

  - [x] 1.2 Modify Event model — add `isFeatured` and `ticketTiers` array
    - Add `isFeatured: { type: Boolean, default: false }` to Event schema
    - Add `ticketTiers` embedded array with name, price, description, maxQuantity, soldCount fields
    - Ensure `ticketTiers[].name` has maxlength 50, price min 0, maxQuantity min 1, soldCount default 0
    - _Requirements: 1.2, 5.1_

  - [x] 1.3 Modify Ticket model — change `ticketType` from enum to String, add `checkedInBy`
    - Change `ticketType` from `enum: ['general', 'vip', 'early_bird']` to `{ type: String, default: 'general' }`
    - Add `checkedInBy: { type: String, default: null }`
    - _Requirements: 5.3, 8.8_

  - [x] 1.4 Modify Payment model — add billing breakdown fields
    - Add `subtotal`, `gstAmount`, `totalAmount`, `discountCode`, `discountAmount` fields
    - _Requirements: 9.3, 9.4_

  - [x] 1.5 Modify Venue model — add `cancellationPolicy` sub-document
    - Add `cancellationPolicy: { freeCancellationHours, partialRefundPercentage, noCancellationHours }` with defaults (48, 50, 24)
    - _Requirements: 15.1_

  - [x] 1.6 Add `event_update` to Notification type enum
    - Extend existing Notification schema type enum array with `'event_update'`
    - _Requirements: 16.2_

  - [x] 1.7 Create AuditLog model
    - New file `server/models/AuditLog.js` with schema: adminUser, action (enum), entityType (enum), entityId, metadata, timestamp
    - Add indexes on `{ entityType, action }`, `{ adminUser }`, `{ timestamp: -1 }`
    - _Requirements: 3.5, 3.6_

  - [x] 1.8 Create DiscountCode model
    - New file `server/models/DiscountCode.js` with schema: event, code, discountType, discountValue, maxUses, usedCount, validFrom, validUntil, isActive, createdBy, activatedBy
    - Add unique compound index on `{ event, code }` and index on `{ code }`
    - _Requirements: 10.1_

  - [x] 1.9 Create ScanningCode model
    - New file `server/models/ScanningCode.js` with schema: event, code (unique, 12 chars), label, createdBy, isActive, createdAt
    - Add indexes on `{ event }` and unique index on `{ code }`
    - _Requirements: 8.2_

  - [x] 1.10 Create Inquiry model
    - New file `server/models/Inquiry.js` with schema: referenceType (enum), referenceId, senderName, senderEmail, senderPhone, message, status, user
    - Add indexes on `{ referenceId, senderEmail, createdAt }` and `{ referenceType, status }`
    - _Requirements: 19.1_

  - [x] 1.11 Create VenueReview model
    - New file `server/models/VenueReview.js` with schema: user, venue, rating (1-5), comment
    - Add unique compound index on `{ user, venue }` and index on `{ venue, createdAt: -1 }`
    - _Requirements: 14.4, 14.5_

- [x] 2. Server middleware and authorization
  - [x] 2.1 Create `roleGuard` middleware
    - Create higher-order middleware `roleGuard(allowedRoles)` that checks `req.user.adminRole` against allowed roles
    - Return 403 with `{ error: "Insufficient permissions for this action" }` if role not in allowed set
    - Integrate with existing `adminAuth.js` middleware
    - _Requirements: 3.2, 3.3, 3.4, 3.7_

  - [ ]* 2.2 Write property test for role-based access enforcement
    - **Property 2: Role-Based Access Enforcement**
    - **Validates: Requirements 3.3, 3.4, 3.7, 3.8**

- [x] 3. Checkpoint — Ensure schema and middleware compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Admin service layer
  - [x] 4.1 Implement featured event toggle in adminService
    - Add `toggleFeatured(eventId, isFeatured, adminUserId)` function
    - Validate event status is 'approved' or 'upcoming' before allowing feature toggle
    - Create AuditLog entry on success
    - Return 400 if event status is invalid
    - _Requirements: 1.2, 1.3, 1.5, 3.5_

  - [ ]* 4.2 Write property test for featured events filter correctness
    - **Property 1: Featured Events Filter Correctness**
    - **Validates: Requirements 1.4, 1.5**

  - [x] 4.3 Implement audit trail query service
    - Add `getAuditTrail({ page, limit, entityType, action })` function with pagination (20 per page)
    - Support filtering by entityType and action
    - _Requirements: 3.5, 3.6_

  - [ ]* 4.4 Write property test for audit trail completeness
    - **Property 3: Audit Trail Completeness**
    - **Validates: Requirements 3.5**

- [x] 5. Ticketing service layer
  - [x] 5.1 Implement tier-based ticket purchase validation in ticketService
    - Add `purchaseTicket(eventId, tierName, quantity, userId)` using atomic `findOneAndUpdate` with `$inc: { 'ticketTiers.$.soldCount': quantity }` and filter `soldCount: { $lt: maxQuantity }`
    - Validate tier exists in event's ticketTiers array
    - Handle backward compatibility: events with single `ticketPrice` treated as one "General" tier
    - _Requirements: 5.4, 5.6_

  - [ ]* 5.2 Write property test for ticket tier quantity invariant
    - **Property 4: Ticket Tier Quantity Invariant**
    - **Validates: Requirements 5.4, 5.7**

  - [x] 5.3 Restrict ticket cancellation to admin-only
    - Modify existing cancel ticket logic: check `req.user.adminRole` or `req.user.role === 'admin'`
    - Return 403 for non-admin users with message "Ticket cancellation is not available for non-admin users"
    - _Requirements: 6.3, 6.5_

  - [ ]* 5.4 Write property test for non-admin ticket cancellation prohibition
    - **Property 5: Non-Admin Ticket Cancellation Prohibition**
    - **Validates: Requirements 6.3**

  - [x] 5.5 Implement scanning code CRUD in eventService
    - Add `createScanningCodes(eventId, codes[], organizerId)` — max 20 per event, 12-char alphanumeric codes
    - Add `validateScanAndCheckIn(accessCode, ticketId)` — verify code active, event match, mark ticket used, record checkedInBy
    - Add `deactivateScanningCode(codeId, organizerId)`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 5.6 Write property test for scanning code event-ticket match invariant
    - **Property 6: Scanning Code Event-Ticket Match Invariant**
    - **Validates: Requirements 8.4, 8.7, 8.8**

- [x] 6. Billing and payment service layer
  - [x] 6.1 Implement billing calculation with GST in paymentService
    - Add `calculateBilling(ticketPrice, quantity, platformFeePercentage, discountAmount)` function
    - Compute: subtotal, platformFee (rounded), gstAmount (rounded), totalAmount
    - Store all fields in Payment document on completion
    - _Requirements: 9.2, 9.4_

  - [ ]* 6.2 Write property test for payment calculation consistency
    - **Property 7: Payment Calculation Consistency**
    - **Validates: Requirements 9.2**

  - [x] 6.3 Create discountService — CRUD, validation, and analytics
    - Implement `createDiscountCode`, `editDiscountCode`, `deactivateDiscountCode`
    - Implement `validateAndApplyDiscount(code, eventId, subtotal)` — check isActive, date range, usedCount < maxUses, cap flat discounts at subtotal
    - Atomic `$inc: { usedCount: 1 }` with filter `usedCount: { $lt: maxUses }` on redemption
    - Implement `getDiscountAnalytics(codeId)` — total uses, revenue, purchase list
    - Only one discount per transaction
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.6, 10.9_

  - [ ]* 6.4 Write property test for discount application calculation
    - **Property 8: Discount Application Calculation**
    - **Validates: Requirements 10.3, 10.5, 10.9**

  - [ ]* 6.5 Write property test for discount code validity enforcement
    - **Property 9: Discount Code Validity Enforcement**
    - **Validates: Requirements 10.6**

- [x] 7. Checkpoint — Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Creator ecosystem service layer
  - [x] 8.1 Fix creator application duplicate account in verificationService
    - Query existing User by email (case-insensitive) before creating new records
    - If user exists: update verificationBadge, set isVerified, create/update BrandProfile
    - Never create a new User document for existing email
    - Wrap in try/catch — no partial state on failure
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 8.2 Write property test for single email single account invariant
    - **Property 10: Single Email Single Account Invariant**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

  - [x] 8.3 Fix self-follow bug in userService
    - Add guard in follow endpoint: reject if `userId === targetId` with error "A user cannot follow themselves"
    - Exclude self-references when returning follower counts and lists (legacy data handling)
    - Never store user's own ID in followers/following arrays
    - _Requirements: 12.1, 12.3, 12.4_

  - [ ]* 8.4 Write property test for self-follow invariant
    - **Property 11: Self-Follow Invariant**
    - **Validates: Requirements 12.1, 12.3, 12.4**

  - [x] 8.5 Implement bank details validation and storage in userService
    - Add `updateBankDetails(userId, { accountName, accountNumber, ifscCode, bankName })` function
    - Validate IFSC: `/^[A-Z]{4}0[A-Z0-9]{6}$/`, account number: digits only, 9-18 chars
    - Return field-specific errors on validation failure
    - _Requirements: 13.2, 13.3, 13.4_

  - [ ]* 8.6 Write property test for bank details validation
    - **Property 12: Bank Details Validation**
    - **Validates: Requirements 13.2**

- [x] 9. Venue service layer
  - [x] 9.1 Implement venue review eligibility check and submission in venueService
    - Add `submitReview(userId, venueId, rating, comment)` — verify completed Booking exists for user+venue
    - Enforce one review per user-venue pair (409 on duplicate)
    - Update venue `rating.average` and `rating.count` using formula: `newAvg = (avg * count + r) / (count + 1)`
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

  - [ ]* 9.2 Write property test for venue review eligibility
    - **Property 13: Venue Review Eligibility**
    - **Validates: Requirements 14.1, 14.4**

  - [ ]* 9.3 Write property test for venue rating recalculation
    - **Property 14: Venue Rating Recalculation**
    - **Validates: Requirements 14.5**

  - [x] 9.4 Implement cancellation policy enforcement in venueService
    - Add `processCancellation(bookingId, userId)` — calculate hoursRemaining, apply policy tier
    - Full refund if hoursRemaining > freeCancellationHours
    - Partial refund at partialRefundPercentage if noCancellationHours < hoursRemaining <= freeCancellationHours
    - Reject if hoursRemaining <= noCancellationHours
    - Validate noCancellationHours < freeCancellationHours on policy save
    - Apply default policy (48, 50, 24) if venue has none configured
    - _Requirements: 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [ ]* 9.5 Write property test for cancellation policy tier application
    - **Property 15: Cancellation Policy Tier Application**
    - **Validates: Requirements 15.3, 15.4, 15.5, 15.6, 15.8**

- [ ] 10. Notification and inquiry service layer
  - [x] 10.1 Implement event update notifications with batching in notificationService
    - Trigger notification when event fields [name, startDateTime, endDateTime, venue, description] are updated
    - Create notifications with type 'event_update' for all active ticket holders
    - Batch in groups of 500 for events with >1000 ticket holders
    - Skip notifications for admin-triggered status transitions
    - Log batch failures, continue processing remaining batches
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ]* 10.2 Write property test for event update notification correctness
    - **Property 16: Event Update Notification Correctness**
    - **Validates: Requirements 16.1, 16.4**

  - [x] 10.3 Create inquiryService — submission, validation, rate limiting
    - Implement `submitInquiry({ referenceType, referenceId, senderName, senderEmail, senderPhone, message, userId })`
    - Validate reference exists and has valid status (event: upcoming/approved/ongoing; venue: approved)
    - Rate limit: max 5 inquiries per senderEmail + referenceId within 24 hours
    - Notify event organizer or venue owner via notification + email; persist Inquiry even if notification fails
    - _Requirements: 19.1, 19.3, 19.4, 19.5, 19.6_

  - [ ]* 10.4 Write property test for inquiry rate limiting
    - **Property 18: Inquiry Rate Limiting**
    - **Validates: Requirements 19.6**

  - [ ]* 10.5 Write property test for inquiry reference validation
    - **Property 19: Inquiry Reference Validation**
    - **Validates: Requirements 19.5**

- [x] 11. Checkpoint — Ensure all service layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Server route handlers
  - [x] 12.1 Extend admin routes — featured toggle and audit trail endpoints
    - `PATCH /admin/events/:id/featured` — toggle isFeatured, requires adminAuth + roleGuard(['super_admin', 'admin'])
    - `GET /admin/audit-trail` — paginated audit log, requires adminAuth + roleGuard(['super_admin', 'admin'])
    - `PATCH /admin/users/:id/role` — assign adminRole, requires roleGuard(['super_admin'])
    - _Requirements: 1.2, 3.6, 3.8_

  - [x] 12.2 Extend ticket routes — restrict cancellation, add scanning endpoints
    - Modify `POST /tickets/:id/cancel` — add admin-only check
    - `POST /events/:id/scanning-codes` — create scanning codes, requires auth + event ownership
    - `GET /scan/:code` — public endpoint for scanning link validation
    - `POST /scan/:code/checkin` — validate and check in ticket via access code
    - _Requirements: 6.3, 8.1, 8.3, 8.4_

  - [x] 12.3 Extend event routes — ticket tiers validation, completed events, update notifications
    - Add ticketTiers validation on event create/edit (1-10 tiers, unique names)
    - Add `includeCompleted` query param to public events listing
    - Return completed events in separate `completedEvents` array when requested
    - Trigger notification service on tracked field updates
    - _Requirements: 5.2, 5.7, 18.4, 18.5, 16.1_

  - [ ]* 12.4 Write property test for completed events listing separation
    - **Property 17: Completed Events Listing Separation**
    - **Validates: Requirements 18.1, 18.4, 18.5**

  - [x] 12.5 Extend payment routes — billing calculation and discount application
    - `POST /payments/calculate-billing` — return billing breakdown without charging
    - `POST /payments/apply-discount` — validate and apply discount code to transaction
    - Update existing payment creation to store full billing breakdown
    - _Requirements: 9.2, 10.3_

  - [x] 12.6 Extend venue routes — reviews, cancellation policy
    - `POST /venues/:id/reviews` — submit review with eligibility check, requires auth
    - `PATCH /venues/:id/cancellation-policy` — update policy, requires venueOwnerAuth
    - `POST /bookings/:id/cancel` — process cancellation with policy enforcement
    - _Requirements: 14.1, 15.2, 15.3_

  - [x] 12.7 Create discount routes — CRUD and analytics
    - New file `server/routes/discount.js`
    - `POST /events/:id/discount-codes` — create, requires auth + event ownership
    - `PATCH /discount-codes/:id` — edit, requires auth + ownership
    - `DELETE /discount-codes/:id` — deactivate, requires auth + ownership
    - `GET /events/:id/discount-codes` — list codes for event
    - `GET /admin/discount-codes/:id/analytics` — analytics, requires adminAuth
    - `PATCH /admin/discount-codes/:id/activate` — admin activation
    - _Requirements: 10.1, 10.2, 10.7, 10.8_

  - [x] 12.8 Create inquiry routes
    - New file `server/routes/inquiry.js`
    - `POST /inquiries` — submit inquiry (public, validates sender fields)
    - `GET /inquiries/:id` — get inquiry by ID, requires auth
    - _Requirements: 19.1, 19.3, 19.4_

  - [x] 12.9 Extend user routes — bank details and self-follow prevention
    - `PATCH /users/me/bank-details` — update bank details with validation, requires auth
    - Add self-follow guard to existing follow/unfollow endpoints
    - _Requirements: 13.2, 12.1_

- [x] 13. Checkpoint — Ensure all route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Admin panel UI changes
  - [x] 14.1 Fix hamburger sidebar toggle in AdminDashboardLayout
    - Ensure single hamburger button in DOM at all times below 1024px viewport
    - Toggle sidebar open/close on click (300ms transition)
    - Add backdrop overlay when sidebar open on mobile; close on backdrop tap
    - Auto-close sidebar after navigation on mobile
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 14.2 Add role-based nav visibility to AdminDashboardLayout
    - Hide restricted nav items based on `adminRole` from JWT
    - Moderators: hide user blocking, payments, role management sections
    - Admin: hide admin role assignment section
    - _Requirements: 3.3, 3.4_

  - [x] 14.3 Add featured toggle to EventDetail page
    - Add "Featured" toggle/checkbox in event detail view
    - Implement optimistic UI update with revert on server failure
    - Disable toggle for events not in 'approved' or 'upcoming' status
    - _Requirements: 1.1, 1.6_

  - [x] 14.4 Update Events listing — completed status filter and badges
    - Include 'completed' events in default (unfiltered) results
    - Add status filter dropdown with all statuses: all, upcoming, approved, ongoing, completed, cancelled, rejected, pending, blocked
    - Add distinct "Completed" status badge with differentiated color
    - Show empty-state message when no events match filter
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 14.5 Create AuditTrail page
    - New file `admin/src/pages/AuditTrail.jsx`
    - Paginated list (20 per page) showing admin user, action, entity, timestamp
    - Filter by entity type and action
    - Add route and nav link in admin sidebar
    - _Requirements: 3.6_

  - [x] 14.6 Create DiscountCodes admin page
    - New file `admin/src/pages/DiscountCodes.jsx`
    - Display per-code analytics: total uses, revenue, purchase list
    - Admin activate/deactivate controls
    - _Requirements: 10.7, 10.8_

- [x] 15. Client UI — ticketing and billing
  - [x] 15.1 Implement ticket tiers form in event creation/edit page
    - Allow adding 1-10 tiers with name, price, description, maxQuantity
    - Validate unique tier names, character limits
    - _Requirements: 5.2_

  - [x] 15.2 Implement billing card component
    - Display: base price, quantity, subtotal, platform fee (% and amount), GST (18% of fee), total
    - Format as INR with ₹ symbol and two decimal places
    - Integrate discount code input field
    - Skip billing card for free events
    - _Requirements: 9.1, 9.5, 9.6_

  - [x] 15.3 Remove ticket cancellation UI
    - Remove "Cancel Ticket" button from tickets dashboard
    - Remove/disable CancellationModal component for event tickets
    - Display 'cancelled' status label for previously cancelled tickets without action buttons
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 15.4 Fix iOS ticket download
    - Implement PNG generation compatible with iOS WebKit (avoid tainted canvas/CORS)
    - Minimum 1080px width, 2x pixel ratio for QR scannable output
    - Add fallback chain: primary → Web Share API → blob URL → inline error
    - Loading indicator on download button during generation
    - 10-second timeout before fallback
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 15.5 Implement scanning link generation UI on event detail
    - Allow organizer to generate scanning links (up to 20) with labels
    - Display generated links with copy-to-clipboard
    - Allow deactivation of individual codes
    - _Requirements: 8.1, 8.2_

  - [x] 15.6 Implement QR scanner interface for scanning links
    - Display QR scanner when valid access code is in URL (no full auth required)
    - Show scan result (success/error) after each scan
    - Handle invalid/deactivated code errors
    - _Requirements: 8.3, 8.5, 8.6_

  - [x] 15.7 Implement discount code input during checkout
    - Add redeem code input field in checkout flow
    - Call validation endpoint on submit, display discount in billing card
    - Show specific error messages (expired, limit reached, deactivated)
    - _Requirements: 10.2, 10.3, 10.6_

- [x] 16. Client UI — creator, venue, and general
  - [x] 16.1 Implement bank details form in creator dashboard
    - Display Bank Details section with: Account Holder Name, Account Number, Confirm Account Number, IFSC Code, Bank Name
    - Mask account number after save (show last 4 digits)
    - Allow edit and resubmit
    - Show prompt to fill bank details if creator has pending/processing payouts and no bank details
    - Client-side validation mirroring server rules
    - _Requirements: 13.1, 13.3, 13.5, 13.6_

  - [x] 16.2 Implement venue cancellation policy display and configuration
    - Show cancellation policy configuration section for venue owners on create/edit
    - Display policy to users on venue detail page
    - Input fields for freeCancellationHours, partialRefundPercentage, noCancellationHours with valid ranges
    - _Requirements: 15.2_

  - [x] 16.3 Implement venue review form (conditional)
    - Display review form only for venues where user has a completed booking (API check)
    - Submit rating (1-5) and optional comment
    - Handle 403 (no completed booking) and 409 (duplicate) errors gracefully
    - _Requirements: 14.3_

  - [x] 16.4 Implement completed events in public listing
    - Add "Past Events" section below active/upcoming events when `includeCompleted=true`
    - Display "Completed" badge on completed event cards with reduced opacity
    - Hide ticket purchase buttons for completed events
    - Sort by endDateTime descending, max 20 per page
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 16.5 Clean up Contact Us page
    - Display only email address as clickable `mailto:` link
    - Remove phone number and physical address
    - Ensure visible page heading
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 16.6 Hide Follow button on own profile
    - Do not render Follow/Following button when viewing own creator profile
    - _Requirements: 12.2_

  - [x] 16.7 Implement inquiry form page
    - New inquiry page/component with reference type and name pre-populated (read-only)
    - Pre-fill senderName and senderEmail for authenticated users
    - Require senderName and senderEmail for unauthenticated users
    - Add inquiry button/link on event and venue pages
    - _Requirements: 19.2, 19.4_

  - [x] 16.8 Display event "Sold Out" state
    - Show "Sold Out" label and disable purchase button when all tiers have soldCount >= maxQuantity
    - _Requirements: 5.5_

- [x] 17. Discount code management for event owners (Client)
  - [x] 17.1 Implement discount code CRUD in event management dashboard
    - Allow event owners to add, edit, and deactivate discount codes
    - Form fields: code, discountType (percentage/flat), discountValue, maxUses, validFrom, validUntil
    - Show list of existing codes with status
    - _Requirements: 10.1, 10.2_

- [x] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Schema changes (task group 1) must be done first as all other tasks depend on them
- The server uses JavaScript (not TypeScript) — all implementations follow existing codebase conventions
- Use `fast-check` for property-based tests as specified in the design's testing strategy

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "4.3", "5.1", "5.3", "5.5", "6.1", "6.3", "8.1", "8.3", "8.5", "9.1", "9.4", "10.1", "10.3"] },
    { "id": 3, "tasks": ["4.2", "4.4", "5.2", "5.4", "5.6", "6.2", "6.4", "6.5", "8.2", "8.4", "8.6", "9.2", "9.3", "9.5", "10.2", "10.4", "10.5"] },
    { "id": 4, "tasks": ["12.1", "12.2", "12.3", "12.5", "12.6", "12.7", "12.8", "12.9"] },
    { "id": 5, "tasks": ["12.4"] },
    { "id": 6, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "15.7", "16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7", "16.8", "17.1"] }
  ]
}
```
