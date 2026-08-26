# Implementation Plan: Event/Venue Enquiries with Owner Reply

## Overview

This plan extends the existing `Inquiry` model, `inquiryService`, and route table to
turn the one-way "Ask a Question" form into a sign-in-gated, single-reply enquiry
system. Work is ordered backend-first (model → service → routes → admin), then the
three client/admin UIs, so each layer builds on a tested foundation and nothing is
left orphaned.

Property-based tests reuse the existing `server/__tests__/*.property.test.ts` harness
(`vitest` + `fast-check` + `mongodb-memory-server`), run a minimum of 100 iterations
each, and are tagged `Feature: event-venue-enquiries, Property {n}: {text}`. UI
rendering, the admin list, notifications/email, and migration branching are covered by
example/snapshot tests.

## Tasks

- [x] 1. Extend the `Inquiry` model with reply fields and read-side normalization
  - [x] 1.1 Add reply schema fields and indexes to `server/models/Inquiry.js`
    - Add `replyText` (String, minlength 1, maxlength 2000, default null), `responder` (ObjectId ref User, default null), `repliedAt` (Date, default null), `senderSeenReply` (Boolean, default false)
    - Add index `{ user: 1, createdAt: -1 }` (My Enquiries) and `{ referenceType: 1, referenceId: 1, createdAt: -1 }` (owner view); retain existing rate-limit and admin-filter indexes
    - Keep all existing fields (`senderName`, `senderEmail`, `message`, `status` enum, reference fields) unchanged for backward compatibility
    - _Requirements: 10.1, 10.3_

  - [x] 1.2 Add pure `normalizeStatus` helper to `server/services/inquiryService.js`
    - Given an inquiry, present `status = 'pending'` whenever `replyText == null`, regardless of the stored status value (auto-correct inconsistent `responded`/`closed`)
    - Keep it pure (no DB write) so it can be applied on every read path
    - _Requirements: 10.2_

  - [x]* 1.3 Write property test for status normalization
    - **Property 12: Reply content is authoritative over stored status**
    - **Validates: Requirements 10.2**
    - New file `server/__tests__/inquiryNormalizeStatus.property.test.ts`

- [x] 2. Harden `submitInquiry` (auth-derived identity, validation, references, rate limit)
  - [x] 2.1 Rework `submitInquiry` in `server/services/inquiryService.js` to require an authenticated user
    - Accept `{ referenceType, referenceId, message, user }`; derive `senderName`/`senderEmail` from the account, ignoring any body-supplied identity
    - Validate message length 10–2000 at the boundary; reject out-of-range with a field-level validation error
    - Reject references whose event is not in (`upcoming`/`approved`/`ongoing`) or venue not `approved` with an "unavailable" error and no `Inquiry` created
    - Persist exactly one `Inquiry` with `status = 'pending'`, `replyText = null`
    - Keep owner notify + email best-effort (wrapped in try/catch-and-log) so delivery never blocks persistence
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 3.5, 8.1, 10.4, 12.4_

  - [x] 2.2 Preserve and enforce the per-sender-per-listing rate limit server-side
    - Cap at 5 accepted enquiries per sender per listing in any rolling 24-hour window; reject the 6th with a 429-mapped error and retry guidance
    - Count from stored records (never trust client state); enquiries outside the window do not count
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.3 Write property test for pending persistence with account identity
    - **Property 1: Submitted enquiries are persisted as pending with account identity**
    - **Validates: Requirements 1.3, 1.5, 8.1, 10.4**

  - [ ]* 2.4 Write property test for message-length boundary validation
    - **Property 2: Message length is validated at the boundary**
    - **Validates: Requirements 1.4, 12.4**

  - [ ]* 2.5 Write property test for unavailable-reference rejection
    - **Property 3: Unavailable references are rejected**
    - **Validates: Requirements 1.6, 12.4**

  - [ ]* 2.6 Write property test for the rate limit
    - **Property 4: Rate limit caps enquiries per sender per listing**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ] 3. Checkpoint - Ensure all model and submit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement owner reply, close, and ownership resolution in `inquiryService`
  - [x] 4.1 Implement `replyToInquiry({ inquiryId, responder, replyText })`
    - Validate reply length 1–2000 at the boundary
    - Resolve listing owner (event → organizer, venue → owner, reusing existing resolution logic); assert `responder === owner` else authorization error
    - Atomic `findOneAndUpdate({ _id, status: 'pending' }, { replyText, responder, repliedAt, status: 'responded' })`; on no match return a 409 "already answered" with the existing reply
    - Best-effort sender notify + email after the successful write (never blocks persistence)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.5, 8.2, 12.1, 12.2, 12.4_

  - [x] 4.2 Implement `closeInquiry({ inquiryId, requester })`
    - Assert `requester === owner` else authorization error
    - Atomic transition to `closed` guarded on `status in ['pending','responded']`; reject `closed → *` and any invalid transition with 409
    - _Requirements: 8.3, 8.4, 12.3_

  - [ ]* 4.3 Write property test for atomic reply write + transition
    - **Property 6: Reply writes the response and transitions atomically**
    - **Validates: Requirements 5.1, 5.5, 8.2, 12.1**

  - [ ]* 4.4 Write property test for the single-reply invariant under concurrency
    - **Property 7: Single-reply invariant under concurrency**
    - **Validates: Requirements 5.4, 12.2**
    - Issue two concurrent `replyToInquiry` calls; assert exactly one succeeds and the stored reply is the winner

  - [ ]* 4.5 Write property test for reply-length boundary validation
    - **Property 8: Reply length is validated at the boundary**
    - **Validates: Requirements 5.2, 12.4**

  - [ ]* 4.6 Write property test for status-transition graph
    - **Property 10: Status transitions are restricted to the valid graph**
    - **Validates: Requirements 8.3, 8.4, 12.3**

  - [ ]* 4.7 Write property test for best-effort delivery on reply
    - **Property 5: Persistence survives notification/email failure**
    - **Validates: Requirements 3.5, 6.5, 12.1**
    - Force notify/email to throw; assert submit and reply still persist

- [x] 5. Implement scoped list reads and mark-seen in `inquiryService`
  - [x] 5.1 Implement `getOwnerInquiries({ requester, referenceType, referenceId, statusFilter })`
    - Assert requester owns the listing else authorization error (never return `[]` in place of the error)
    - Return enquiries newest-first with a `pending` count; apply optional status filter (`pending`/`responded`/`closed`/all); apply `normalizeStatus` on each
    - _Requirements: 4.2, 4.4, 8.5, 12.3_

  - [x] 5.2 Implement `getSenderInquiries({ userId })`
    - Return only the caller's own enquiries, newest-first, each passed through `normalizeStatus`, including owner reply when present
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.3 Implement `markReplySeen({ inquiryId, requester })`
    - Assert requester is the sender else authorization error; set `senderSeenReply = true`; idempotent on repeat
    - _Requirements: 7.4_

  - [ ]* 5.4 Write property test for owner/sender list scoping and ordering
    - **Property 11: Owner and sender list views are correctly scoped and ordered**
    - **Validates: Requirements 4.2, 7.1, 7.3**

  - [ ]* 5.5 Write property test for owner-only authorization on view/reply/close
    - **Property 9: Only the listing owner may reply, close, or view listing enquiries**
    - **Validates: Requirements 4.4, 5.3, 12.3**

  - [ ]* 5.6 Write property test for idempotent mark-seen
    - **Property 13: Marking a reply seen is idempotent**
    - **Validates: Requirements 7.4**

- [ ] 6. Checkpoint - Ensure all service-layer property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Wire inquiry routes to the hardened service
  - [ ] 7.1 Update `server/routes/inquiry.js` submit + add reply/close/list/seen routes
    - Change `POST /inquiries` from `optionalAuth` to `requireAuth`; pass `req.user` to `submitInquiry` and accept only `{ referenceType, referenceId, message }` in the body
    - Add `GET /inquiries/mine` (requireAuth → `getSenderInquiries`)
    - Add `POST /inquiries/:id/seen` (requireAuth → `markReplySeen`)
    - Add `GET /inquiries/listing/:refType/:refId` (requireAuth → `getOwnerInquiries`, with status filter query param)
    - Add `POST /inquiries/:id/reply` (requireAuth → `replyToInquiry`)
    - Add `POST /inquiries/:id/close` (requireAuth → `closeInquiry`)
    - Map service errors to HTTP: 400 validation/unavailable, 429 rate limit, 403 authorization, 409 already-answered/invalid-transition
    - _Requirements: 1.1, 1.2, 4.1, 5.1, 7.1, 8.3_

  - [ ]* 7.2 Write route-level example tests for auth gating and status mapping
    - Assert unauthenticated `POST /inquiries` is rejected; owner-only routes 403 for non-owners; reply-on-responded returns 409 with existing reply; 429 on rate-limit
    - _Requirements: 1.2, 4.4, 5.3, 5.4, 2.2_

- [ ] 8. Add admin platform-wide enquiries endpoint
  - [ ] 8.1 Add `getInquiries` to `server/services/adminService.js` and wire `GET /admin/inquiries`
    - Service returns platform-wide enquiries filterable by status and reference type, paginated, showing sender, listing, message, reply, status, timestamps
    - Add the route under the existing `router.use(adminAuth)`-gated `server/routes/admin.js`
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 8.2 Write example tests for admin filtering, pagination, and access control
    - Assert non-admin access is rejected and status/reference filters + pagination behave correctly
    - _Requirements: 9.1, 9.3_

- [ ] 9. Checkpoint - Ensure backend routes and admin endpoint pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Extend the client inquiries API and rewire the form
  - [ ] 10.1 Extend `inquiriesApi` in `client/src/lib/api.ts`
    - Slim `submit` body to `{ referenceType, referenceId, message }`; add `listMine`, `listForListing`, `reply`, `close`, `markSeen`
    - _Requirements: 1.1, 4.1, 5.1, 7.1_

  - [ ] 10.2 Rewire the client `InquiryForm`
    - Remove manual name/email/phone inputs and the post-submit `startInquiryConversation` call
    - If unauthenticated, prompt sign-in preserving the return URL to the listing
    - On success do not open a chat; only fall back to `startInquiryConversation` when the enquiry endpoint is unreachable (network/endpoint error, not a 4xx)
    - _Requirements: 1.1, 1.2, 11.1, 11.2_

  - [ ]* 10.3 Write component/snapshot tests for the rewired `InquiryForm`
    - Cover sign-in gate, no-chat-on-success, and fallback-on-unreachable (but not on 4xx)
    - _Requirements: 1.2, 11.1, 11.2_

- [ ] 11. Build the owner Enquiries tab
  - [ ] 11.1 Create `EnquiriesTab` and mount it on the event and venue manage pages
    - List enquiries newest-first with sender name, message, status, timestamp; show pending count and status filter (`pending`/`responded`/`closed`/all); empty state when none
    - Reply composer (1–2000 chars, live counter with guidance near the limit) for `pending` enquiries; read-only reply display for `responded`/`closed`; "Mark closed" action
    - Mount on `/dashboard/events/[id]` and the venue manage page
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 5.2, 5.4, 8.5_

  - [ ]* 11.2 Write snapshot/component tests for `EnquiriesTab`
    - Cover empty state, pending count, reply composer counter, and read-only reply rendering
    - _Requirements: 4.2, 4.3, 4.5, 5.2_

- [ ] 12. Build the sender My Enquiries view
  - [ ] 12.1 Create the `MyEnquiries` view at `/dashboard/enquiries`
    - List the sender's enquiries newest-first with listing name/type, message, current status, and owner reply when present
    - When opening an enquiry with an unseen reply, call `/inquiries/:id/seen` so the "you got a reply" indicator clears
    - _Requirements: 7.1, 7.2, 7.4_

  - [ ]* 12.2 Write snapshot/component tests for `MyEnquiries`
    - Cover reply-present rendering and the mark-seen call on open
    - _Requirements: 7.2, 7.4_

- [ ] 13. Build the admin Enquiries page
  - [ ] 13.1 Create the admin Enquiries page in the React admin app
    - Follow the existing `Events.jsx`/`Venues.jsx` list pattern; call `GET /admin/inquiries` with status and reference-type filters and pagination; show sender, listing, message, reply, status, timestamps
    - _Requirements: 9.1, 9.2_

  - [ ]* 13.2 Write snapshot/component tests for the admin Enquiries page
    - Cover filter controls and row rendering
    - _Requirements: 9.1, 9.2_

- [ ] 14. Notification wiring and migration safety
  - [ ] 14.1 Point owner and sender notification action links at the correct destinations
    - Owner new-enquiry notification links to the owner's Enquiries tab for that specific listing; sender reply notification links to My Enquiries (or the specific enquiry)
    - Ensure push + email are sent when enabled, all best-effort
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 14.2 Write example tests for notification links and migration safety
    - Assert owner/sender notification action links target the right views; assert `start-brand-enquiry` is untouched and existing brand conversations / messages inbox still resolve; assert `start-inquiry-conversation` remains available as fallback
    - _Requirements: 3.1, 3.2, 6.1, 6.2, 11.3, 11.4_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements (granular sub-clauses) for traceability.
- Property tests reuse the existing `server/__tests__/*.property.test.ts` harness
  (`vitest` + `fast-check` + `mongodb-memory-server`), run ≥100 iterations, and are
  tagged `Feature: event-venue-enquiries, Property {n}: {text}`.
- UI rendering, the admin list, notifications/email, and migration branching use
  example/snapshot tests rather than property tests.
- Checkpoints ensure incremental validation before moving to the next layer.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "4.1", "4.2", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "5.4", "5.5", "5.6", "8.1"] },
    { "id": 5, "tasks": ["7.1", "8.2"] },
    { "id": 6, "tasks": ["7.2", "10.1"] },
    { "id": 7, "tasks": ["10.2", "11.1", "12.1", "13.1", "14.1"] },
    { "id": 8, "tasks": ["10.3", "11.2", "12.2", "13.2", "14.2"] }
  ]
}
```
