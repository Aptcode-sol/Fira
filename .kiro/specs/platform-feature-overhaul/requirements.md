# Requirements Document

## Introduction

This document captures the comprehensive requirements for the Firaa platform feature overhaul — a collection of new features, bug fixes, and enhancements spanning the admin panel, ticketing system, creator ecosystem, venue management, notifications, billing, and access control domains. Firaa is an event/venue booking platform with a Next.js 16 client, React + Vite admin panel, and Express + MongoDB server.

## Glossary

- **Admin_Panel**: The React + Vite administration dashboard used by platform administrators to manage events, venues, creators, and users
- **Client**: The Next.js 16 public-facing website used by attendees and event organizers
- **Server**: The Express.js backend API with MongoDB (Mongoose) data layer
- **Creator**: A verified user with a BrandProfile (verificationBadge in ['brand', 'band', 'organizer']) who can host events
- **Ticket_Holder**: A user who has purchased or acquired a ticket for an event
- **Venue_Owner**: A user with role 'venue_owner' who manages one or more Venue listings
- **Booking**: A venue reservation tracked in the Booking model with status lifecycle (pending → accepted → completed)
- **Payment_Model**: The Mongoose model tracking Razorpay transactions including platformFee and platformFeePercentage
- **Notification_Service**: The server-side service responsible for creating Notification documents and dispatching web-push alerts
- **Scanning_Link**: A unique URL with embedded access code that authorizes personnel to scan/validate tickets at event entry
- **Redeem_Code**: An alphanumeric code that applies a discount to a ticket purchase when entered during checkout
- **Audit_Trail**: A timestamped log recording which admin user performed which action on which entity
- **GST**: Goods and Services Tax applicable in India (currently 18% on service fees)
- **IFSC**: Indian Financial System Code identifying a bank branch for NEFT/RTGS transfers

---

## Requirements

---

### Domain: Admin Panel

---

### Requirement 1: Featured Events Management in Admin

**User Story:** As an admin, I want to mark events as featured from the admin panel, so that featured events appear in the "Featured Events" section on the homepage.

#### Acceptance Criteria

1. WHEN an admin navigates to the Events section, THE Admin_Panel SHALL display a "Featured" toggle or checkbox for each event in the event detail view
2. WHEN an admin marks an event as featured, THE Server SHALL set the `isFeatured` field to `true` on the corresponding Event document and return a success response within 2 seconds
3. WHEN an admin removes the featured status from an event, THE Server SHALL set the `isFeatured` field to `false` on the corresponding Event document
4. THE Client SHALL display all events where `isFeatured` is `true` and status is 'approved' or 'upcoming' in the "Featured Events" homepage section, ordered by `startDateTime` ascending, limited to a maximum of 10 events
5. IF an admin attempts to feature an event that is not in 'approved' or 'upcoming' status, THEN THE Server SHALL reject the request with a 400 response containing an error message specifying the required event status
6. WHEN the featured toggle is clicked, THE Admin_Panel SHALL provide immediate visual feedback (optimistic UI update) and revert if the server request fails

---

### Requirement 2: Admin Sidebar Hamburger Toggle Fix

**User Story:** As an admin on a mobile device, I want the hamburger menu button to close the sidebar when clicked while the sidebar is open, so that I can dismiss the navigation overlay.

#### Acceptance Criteria

1. WHILE the viewport width is below 1024px AND the sidebar is in the open state, WHEN the hamburger button is clicked, THE Admin_Panel SHALL close the sidebar by transitioning it to width 0 (fully hidden) within 300ms
2. WHILE the viewport width is below 1024px AND the sidebar is in the closed state, WHEN the hamburger button is clicked, THE Admin_Panel SHALL open the sidebar by expanding it to its full navigation width within 300ms
3. WHILE the viewport width is below 1024px, THE Admin_Panel SHALL render exactly one hamburger button in the DOM at any given time, regardless of whether the sidebar is open or closed
4. WHILE the sidebar is open on a viewport below 1024px, THE Admin_Panel SHALL display a backdrop overlay covering the remaining viewport area, and WHEN the user taps the backdrop, THE Admin_Panel SHALL close the sidebar using the same transition as the hamburger toggle
5. WHEN the user navigates to a route via a sidebar link on a viewport below 1024px, THE Admin_Panel SHALL close the sidebar automatically after navigation completes

---

### Requirement 3: Role-Based Admin Access with Audit Trail

**User Story:** As a platform owner, I want separate admin logins with role-based permissions and an audit trail, so that I can track which admin performed which action and restrict sensitive operations.

#### Acceptance Criteria

1. THE Server SHALL support admin roles: 'super_admin', 'admin', and 'moderator' via an `adminRole` field on the User model with enum values ['super_admin', 'admin', 'moderator']
2. WHEN an admin logs in, THE Server SHALL authenticate against credentials associated with the specific admin role and include the adminRole in the JWT payload
3. WHILE an admin with 'moderator' role is logged in, THE Admin_Panel SHALL restrict access to: user blocking/unblocking endpoints, Payment and Payout records, and admin role management
4. WHILE an admin with 'admin' role is logged in, THE Admin_Panel SHALL allow event/venue/creator approval and user management but restrict admin role assignment and system-wide configuration changes
5. WHEN any admin accepts or rejects a venue, creator, or event, THE Server SHALL record an audit entry containing the admin user ID, action performed, target entity ID, target entity type, and timestamp
6. THE Admin_Panel SHALL display the audit trail with pagination (20 entries per page), showing who accepted or rejected each venue, creator, and event with timestamps, filterable by entity type and action
7. IF an admin attempts an action outside their role permissions, THEN THE Server SHALL return a 403 response with an error indicating insufficient permissions
8. ONLY users with 'super_admin' role SHALL be permitted to assign or modify the adminRole field on other User documents

---

### Requirement 4: Show Completed Events in Admin Listing

**User Story:** As an admin, I want to view completed events in the events listing, so that I can review past event data and performance.

#### Acceptance Criteria

1. WHEN an admin views the Events listing without applying a status filter, THE Admin_Panel SHALL include events with status 'completed' in the default results alongside events of all other statuses
2. THE Admin_Panel SHALL provide a status filter with the following options: 'all', 'upcoming', 'approved', 'ongoing', 'completed', 'cancelled', 'rejected', 'pending', and 'blocked'
3. WHEN an admin selects the 'completed' status filter, THE Admin_Panel SHALL display only events with status 'completed' in the listing
4. THE Admin_Panel SHALL display a distinct status badge for completed events that is visually differentiated from non-terminal statuses ('upcoming', 'approved', 'ongoing', 'pending') by using a color and label that indicates the event has ended
5. IF no events match the selected status filter, THEN THE Admin_Panel SHALL display an empty-state message indicating no events were found for that filter

---

### Domain: Ticketing

---

### Requirement 5: Custom Ticket Types

**User Story:** As an event organizer, I want to define custom ticket types with unique names, prices, and descriptions, so that I can offer diverse ticket options such as couples, women-only, or group passes.

#### Acceptance Criteria

1. THE Event model SHALL support a `ticketTiers` array where each tier contains: name (String, required, 1–50 characters, unique within the event), price (Number, required, >= 0), description (String, optional, max 200 characters), maxQuantity (Number, required, >= 1), and soldCount (Number, default 0)
2. WHEN an organizer creates or edits an event, THE Client SHALL allow adding between 1 and 10 ticket tiers with custom names, prices, and descriptions
3. THE Ticket model SHALL replace the fixed enum `ticketType: ['general', 'vip', 'early_bird']` with a flexible `ticketType` String field that references the tier name from the Event's ticketTiers array
4. WHEN a user purchases a ticket, THE Server SHALL validate that the selected tier name exists in the event's ticketTiers AND has available quantity (soldCount < maxQuantity), using atomic increment to prevent overselling under concurrent purchases
5. IF all tiers of an event have soldCount equal to maxQuantity, THEN THE Client SHALL display the event as "Sold Out" and disable the purchase button
6. THE Server SHALL maintain backward compatibility by treating existing events with the single `ticketPrice` field (and no ticketTiers) as having one "General" tier with maxQuantity equal to maxAttendees
7. IF a tier name submitted during event creation already exists in the ticketTiers array for that event, THEN THE Server SHALL reject the request with an error indicating duplicate tier names are not allowed

---

### Requirement 6: Remove Cancel Ticket Option

**User Story:** As the platform owner, I want to remove the ticket cancellation option from the website, so that ticket holders cannot self-cancel tickets.

#### Acceptance Criteria

1. THE Client SHALL NOT display a "Cancel Ticket" button or cancellation option on the user's tickets dashboard page
2. THE Client SHALL NOT render the CancellationModal component for event tickets
3. IF a non-admin user sends a POST request to `/api/tickets/:id/cancel`, THEN THE Server SHALL respond with HTTP 403 and a JSON body containing an error field indicating that ticket cancellation is not available for non-admin users
4. IF a ticket has status 'cancelled' from a prior cancellation, THEN THE Client SHALL display the ticket with a 'cancelled' status label and SHALL NOT render any action buttons for that ticket
5. WHILE a user is authenticated as an admin, THE Server SHALL continue to process POST requests to `/api/tickets/:id/cancel` and perform the cancellation flow as before

---

### Requirement 7: iOS Ticket Download Fix

**User Story:** As a ticket holder using an iOS device, I want to download or save my ticket image, so that I can access it offline at the event venue.

#### Acceptance Criteria

1. WHEN a ticket holder taps the download/save button on iOS Safari (version 15.0 or later), THE Client SHALL generate the ticket as a PNG image and offer it for download via the browser download prompt or the native iOS share sheet
2. THE Client SHALL use a rendering approach compatible with iOS WebKit that avoids tainted canvas and CORS restrictions when converting the ticket HTML element (including the QR code) to an image
3. IF the primary image generation or download method fails (throws an error or produces no output within 10 seconds), THEN THE Client SHALL attempt the fallback method (Web Share API or blob URL approach) and display an inline error message indicating the save failed if the fallback also fails
4. WHEN the ticket image is generated, THE Client SHALL produce a PNG image with a minimum resolution of 1080px width and a pixel ratio of at least 2x to ensure the QR code is scannable
5. WHILE the ticket image is being generated, THE Client SHALL display a loading indicator on the download button and disable it to prevent duplicate requests

---

### Requirement 8: Scanning Links with Access Codes

**User Story:** As an event organizer, I want to generate scanning links with unique access codes, so that I can authorize multiple personnel to scan tickets at the event without sharing my login credentials.

#### Acceptance Criteria

1. WHEN an organizer requests scanning link generation for an event, THE Server SHALL create one or more unique access codes tied to that event, up to a maximum of 20 access codes per event
2. THE Server SHALL store each access code with: eventId, code (unique alphanumeric string of 12 characters), label (max 50 characters, e.g., "Gate A"), createdBy (organizer ID), isActive (Boolean defaulting to true), and createdAt timestamp
3. WHEN a personnel member opens a scanning link containing a valid access code (one that exists, is marked isActive true, and belongs to an existing event), THE Client SHALL display the QR scanner interface without requiring full authentication
4. WHEN a QR code is scanned with a valid access code, THE Server SHALL validate the ticket belongs to the same event as the access code, mark it as used, record the access code identifier as the `checkedInBy` reference, and return success within 3 seconds
5. IF a scanning link is opened with an access code that does not exist or belongs to no event, THEN THE Server SHALL reject the request with an error indicating the code is invalid
6. IF an access code is deactivated by the organizer, THEN THE Server SHALL reject all subsequent scan requests using that code with an error indicating the code has been deactivated
7. IF a ticket's event does not match the access code's event, THEN THE Server SHALL reject the scan with an error indicating the ticket belongs to a different event
8. THE Server SHALL record which access code was used for each ticket check-in for audit purposes

---

### Domain: Billing & Payments

---

### Requirement 9: Billing Card with Tax and Platform Fee Breakdown

**User Story:** As a ticket purchaser, I want to see a detailed billing breakdown showing ticket price, platform fees, and GST, so that I understand exactly what I am paying.

#### Acceptance Criteria

1. WHEN a user selects a quantity and initiates payment for a paid event, THE Client SHALL display a billing card showing: base ticket price per unit, quantity, subtotal (ticketPrice × quantity), platform fee (percentage and calculated amount), GST on platform fee (18% of platform fee), and total payable amount
2. THE Server SHALL calculate the total as: (ticketPrice × quantity) + platformFee + GST, where platformFee = Math.round(subtotal × platformFeePercentage / 100) and GST = Math.round(platformFee × 0.18), with all intermediate monetary values rounded to the nearest integer in paise before summing
3. THE Payment_Model SHALL store the GST amount as a separate `gstAmount` field alongside the existing platformFee field
4. WHEN the payment is completed, THE Server SHALL persist the subtotal, platformFee, platformFeePercentage, gstAmount, and totalAmount in the Payment document for reconciliation
5. THE Client SHALL display all monetary values in INR with the ₹ symbol and two decimal places
6. IF the event ticket price is zero, THEN THE Client SHALL skip the billing card and proceed directly without payment

---

### Requirement 10: Discount and Redeem Code System

**User Story:** As an event owner, I want to create discount codes for my events, and as an admin I want to activate redeem codes and see purchase analytics per code, so that promotional pricing can be managed effectively.

#### Acceptance Criteria

1. WHEN an event owner creates a discount code, THE Server SHALL store: code (String, unique per event, 3–20 alphanumeric characters, case-insensitive), discountType (percentage or flat), discountValue (Number: 1–99 for percentage, 1–99999 INR for flat), maxUses (Number between 1 and 100000, or null for unlimited), usedCount (default 0), validFrom (Date), validUntil (Date, must be after validFrom), eventId, createdBy, and isActive (Boolean, default true)
2. THE Client SHALL allow event owners to add, edit, and deactivate discount codes for their events from the event management dashboard
3. WHEN a user enters a valid redeem code during checkout, THE Server SHALL calculate the discount on the ticket subtotal (unit price × quantity), then compute platform fee and GST on the discounted subtotal, and return the final amount to charge
4. IF a percentage discount results in a fractional amount, THEN THE Server SHALL round the discount to the nearest whole number (INR)
5. IF a flat discount value equals or exceeds the ticket subtotal, THEN THE Server SHALL cap the discount at the ticket subtotal so that the final ticket amount is zero, and platform fee and GST SHALL be calculated on zero
6. IF a redeem code has reached maxUses OR the current date is outside the validFrom/validUntil range OR isActive is false, THEN THE Server SHALL reject the code with an error message indicating the reason for rejection (expired, usage limit reached, or deactivated)
7. WHEN an admin activates a redeem code, THE Server SHALL set isActive to true and record the activating admin's ID
8. THE Admin_Panel SHALL display a report per redeem code showing: total uses, total revenue collected from purchases using the code (amount charged to user after discount), and a list of purchases (user, ticket type, original price, discount applied, price paid, purchase date)
9. THE Server SHALL apply only one discount code per transaction

---

### Domain: Creator Ecosystem

---

### Requirement 11: Creator Application Duplicate Account Fix

**User Story:** As a user applying to become a creator, I want the application process to upgrade my existing account rather than creating a duplicate, so that I maintain a single identity on the platform.

#### Acceptance Criteria

1. WHEN a user submits a creator application, THE Server SHALL query for an existing User document matching the applicant's email (case-insensitive) before creating any new records
2. IF a User document already exists with the applicant's email, THEN THE Server SHALL update that existing user's verificationBadge to the value matching the application type ('brand', 'band', or 'organizer'), set isVerified to true, and create a BrandProfile document with its user field set to the existing User's _id
3. THE Server SHALL NOT create a new User document when processing a creator application for an email that already exists in the system
4. WHEN a creator application is approved, THE Server SHALL update exactly one User document (the existing one) with the verificationBadge value equal to the VerificationRequest.type field for that application
5. IF a BrandProfile already exists for the user's _id when processing a creator application approval, THEN THE Server SHALL update the existing BrandProfile rather than attempting to create a duplicate
6. IF the user lookup or update operation fails during creator application processing, THEN THE Server SHALL return an error response indicating the failure reason and SHALL NOT leave the User document or BrandProfile in a partially updated state

---

### Requirement 12: Self-Follow Bug Fix

**User Story:** As a creator, I want my own profile page to never show that I am following myself, so that the follower/following counts and states are accurate.

#### Acceptance Criteria

1. IF a follow request is made where the authenticated user's ID equals the target user's ID, THEN THE Server SHALL reject the request with an error message indicating that a user cannot follow themselves
2. WHEN a creator views their own profile, THE Client SHALL NOT display a "Follow" button or "Following" state for the creator's own profile
3. IF a user's `followers` or `following` array already contains their own ID (legacy data), THEN THE Server SHALL exclude the self-reference when returning follower counts and follower/following lists
4. THE Server SHALL NOT store a user's own ID in their `followers` or `following` arrays under any operation (follow, unfollow, bulk update, or data migration)

---

### Requirement 13: Bank Details for Creator Payouts

**User Story:** As a creator, I want to fill in my bank details from my profile dashboard, so that I can receive event revenue payouts to my bank account.

#### Acceptance Criteria

1. THE Client SHALL display a "Bank Details" section in the creator's profile/dashboard showing fields: Account Holder Name (max 120 characters), Account Number (9 to 18 digits), Confirm Account Number, IFSC Code (11 characters), and Bank Name (max 100 characters)
2. WHEN a creator submits bank details, THE Server SHALL validate that the IFSC code matches the standard 11-character format (4 letters + 0 + 6 alphanumeric characters) AND that the Account Number contains only digits between 9 and 18 characters in length AND that the Account Number and Confirm Account Number fields match
3. IF bank detail validation fails, THEN THE Client SHALL display an error message indicating which field failed validation and THE Server SHALL not update the stored bank details
4. WHEN valid bank details are submitted, THE Server SHALL update the `bankDetails` sub-document on the creator's User document with the provided accountName, accountNumber, ifscCode, and bankName values
5. THE Client SHALL mask the account number (show only last 4 digits) after bank details are saved, and SHALL allow the creator to edit and resubmit their bank details
6. IF a creator has not filled bank details (any of accountName, accountNumber, ifscCode, or bankName is null) AND has at least one Payout record with status "pending" or "processing", THEN THE Client SHALL display a prompt directing the creator to fill their bank details

---

### Domain: Venues

---

### Requirement 14: Venue Review Restrictions

**User Story:** As the platform owner, I want venue reviews restricted to users who have completed a booking at that venue, so that reviews are authentic and from verified guests.

#### Acceptance Criteria

1. WHEN a user attempts to submit a venue review, THE Server SHALL verify that a Booking document exists with the user's ID, the venue's ID, and status 'completed'
2. IF no completed booking exists for the user at that venue, THEN THE Server SHALL reject the review submission with a 403 response containing an error message stating the user must complete a booking before reviewing
3. THE Client SHALL display the review form only for venues where the logged-in user has at least one completed booking, determined via an API check before rendering
4. THE Server SHALL allow only one review per user per venue; IF a review already exists for the user-venue pair, THEN THE Server SHALL reject the submission with a 409 response indicating a review has already been submitted
5. WHEN a review is submitted, THE Server SHALL update the venue's rating.average and rating.count fields to reflect the new review

---

### Requirement 15: Venue Advance Booking Cancellation Policy

**User Story:** As a venue owner, I want to set a time-based cancellation policy for advance bookings, so that last-minute cancellations are handled according to my defined rules.

#### Acceptance Criteria

1. THE Venue model SHALL support a `cancellationPolicy` sub-document containing: freeCancellationHours (Number, range 1 to 720, minimum hours before booking start for full refund), partialRefundPercentage (Number, range 0 to 100, refund percentage for cancellations within the free window), and noCancellationHours (Number, range 0 to 720, hours before booking start within which cancellation is not permitted), where noCancellationHours SHALL be less than freeCancellationHours
2. WHEN a venue owner creates or edits a venue, THE Client SHALL provide a cancellation policy configuration section displaying input fields for freeCancellationHours, partialRefundPercentage, and noCancellationHours with their valid ranges
3. WHEN a user requests booking cancellation, THE Server SHALL calculate the hours remaining from the current time until the booking's bookingDate combined with startTime and apply the matching policy tier
4. IF the cancellation request is made more than `freeCancellationHours` before the booking start, THEN THE Server SHALL process a full refund of the advance payment amount
5. IF the cancellation request is made within `freeCancellationHours` but more than `noCancellationHours` before the booking start, THEN THE Server SHALL process a partial refund at the configured `partialRefundPercentage` of the advance payment amount
6. IF the cancellation request is made within `noCancellationHours` before the booking start, THEN THE Server SHALL reject the cancellation request and return an error message indicating the cancellation window has passed
7. IF a venue has no `cancellationPolicy` configured, THEN THE Server SHALL apply a default policy of freeCancellationHours: 48, partialRefundPercentage: 50, and noCancellationHours: 24
8. IF `noCancellationHours` is set to a value greater than or equal to `freeCancellationHours` during venue creation or editing, THEN THE Server SHALL reject the update with an error message indicating that noCancellationHours must be less than freeCancellationHours

---

### Domain: Notifications

---

### Requirement 16: Event Update Notifications for Ticket Holders

**User Story:** As a ticket holder, I want to receive notifications whenever an event I have tickets for is updated, so that I am informed of schedule changes, venue changes, or other important updates.

#### Acceptance Criteria

1. WHEN an organizer updates any of the following event fields: name, startDateTime, endDateTime, venue, or description, THE Server SHALL send a notification to all users who hold tickets with status 'active' for that event
2. THE Notification_Service SHALL create notifications with type 'event_update', a title containing the event name, a message listing each changed field and its new value, and a data.actionUrl pointing to the event page
3. THE Notification_Service SHALL dispatch push notifications via pushService to all ticket holders who have at least one PushSubscription record associated with their account
4. THE Server SHALL NOT send update notifications when the only fields changed are event status transitions triggered by the admin approval workflow (e.g., pending → approved, pending → rejected)
5. WHEN an event has more than 1000 active ticket holders, THE Server SHALL process notifications in batches of no more than 500 users per batch to limit memory usage
6. IF the notification dispatch fails for a batch, THEN THE Server SHALL log the error and continue processing remaining batches without blocking the event update response

---

### Domain: Client UI & UX

---

### Requirement 17: Contact Us Cleanup

**User Story:** As a user, I want the Contact Us page to show only the email address, so that the displayed contact information is current and accurate.

#### Acceptance Criteria

1. THE Client SHALL display only the email address as the sole contact method on the Contact Us page
2. THE Client SHALL NOT display a phone number on the Contact Us page
3. THE Client SHALL NOT display a physical/postal address on the Contact Us page
4. THE Client SHALL present the email address as a clickable `mailto:` link that opens the user's default email client when activated
5. WHEN a user navigates to the Contact Us page, THE Client SHALL display a visible page heading identifying the page as the contact page

---

### Requirement 18: Show Completed Events in Public Listing

**User Story:** As a user browsing events, I want to see completed events alongside upcoming ones, so that I can discover past events and their organizers.

#### Acceptance Criteria

1. WHEN a user views the events listing page with the `includeCompleted` parameter set to true, THE Client SHALL display completed events in a separate "Past Events" section positioned below all active/upcoming events, sorted by `endDateTime` descending (most recently completed first), displaying a maximum of 20 completed events per page
2. THE Client SHALL visually distinguish completed events by displaying a "Completed" badge on each completed event card and reducing the card opacity to indicate inactive status
3. WHILE an event has status 'completed', THE Client SHALL NOT display ticket purchase buttons, "Get Tickets" links, or any other ticket acquisition controls for that event
4. IF the `includeCompleted` query parameter is set to true, THEN THE Server SHALL include events with status 'completed' in the public events API response alongside approved upcoming events, with completed events returned in a separate `completedEvents` array
5. IF the `includeCompleted` query parameter is absent or set to false, THEN THE Server SHALL return only approved upcoming/ongoing events in the public events API response, preserving existing default behavior

---

### Domain: Inquiry & Communication

---

### Requirement 19: Inquiry Feature via Reference Link

**User Story:** As a potential customer, I want to submit an inquiry using a reference link, so that I can request information about an event or venue without committing to a booking.

#### Acceptance Criteria

1. THE Server SHALL support an Inquiry model containing: referenceType (enum: "event" or "venue"), referenceId (ObjectId), senderName (string, 1–100 characters), senderEmail (valid email format, max 254 characters), senderPhone (optional, string, max 20 characters), message (string, 10–2000 characters), status (enum: "pending", "responded", "closed"), and createdAt (timestamp)
2. WHEN a user clicks an inquiry link on an event or venue page, THE Client SHALL display an inquiry form with the reference type and reference name pre-populated as read-only fields, and IF the user is authenticated, THE Client SHALL pre-fill senderName and senderEmail from the user's profile
3. WHEN an inquiry is submitted with valid data, THE Server SHALL create the Inquiry document and notify the event organizer or venue owner via in-app notification and email; IF notification or email delivery fails, THE Server SHALL still persist the Inquiry document and log the delivery failure
4. WHEN an unauthenticated user submits an inquiry, THE Server SHALL require senderName and senderEmail fields and validate them before accepting the inquiry
5. IF the referenced event does not exist or has a status other than "upcoming", "approved", or "ongoing", OR the referenced venue does not exist or has a status other than "approved", THEN THE Server SHALL reject the inquiry with an error response indicating the reference is unavailable
6. IF the same senderEmail submits more than 5 inquiries to the same referenceId within a 24-hour period, THEN THE Server SHALL reject the submission with an error response indicating the rate limit has been exceeded

---

## Correctness Properties

### Property 1: Custom Ticket Tier Quantity Invariant
FOR ALL events with ticketTiers, the sum of all tier soldCounts SHALL be less than or equal to maxAttendees, AND each individual tier's soldCount SHALL be less than or equal to its maxQuantity.

### Property 2: Payment Calculation Consistency
FOR ALL payments, the stored totalAmount SHALL equal (subtotal + platformFee + gstAmount), AND platformFee SHALL equal Math.round(subtotal × platformFeePercentage / 100), AND gstAmount SHALL equal Math.round(platformFee × 0.18).

### Property 3: Audit Trail Completeness
FOR ALL admin approval/rejection actions on venues, creators, and events, an audit entry SHALL exist with matching adminId, entityId, action, and timestamp within 1 second of the action.

### Property 4: Self-Follow Invariant
FOR ALL users, the user's own ID SHALL NOT appear in their `followers` array AND SHALL NOT appear in their `following` array.

### Property 5: Venue Review Eligibility Invariant
FOR ALL venue reviews, a Booking document SHALL exist with the reviewer's userId, the venue's venueId, and status 'completed'.

### Property 6: Discount Code Application Idempotence
FOR ALL transactions, applying the same discount code twice SHALL produce the same discount amount as applying it once (single application only).

### Property 7: Cancellation Policy Time Boundary Consistency
FOR ALL venue cancellation policies, freeCancellationHours SHALL be greater than noCancellationHours, ensuring the policy tiers do not overlap or contradict.

### Property 8: Single Email Single Account Invariant
FOR ALL email addresses in the system, at most one User document SHALL exist with that email (case-insensitive comparison).
