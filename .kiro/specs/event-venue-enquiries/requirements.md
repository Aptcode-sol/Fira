# Requirements — Event/Venue Enquiries with Owner Reply

## Introduction

FIRA currently has an "Ask a Question" inquiry form that files a one-way `Inquiry`
record and notifies the owner by email/notification, but the owner has **no in-app
way to reply**, the sender has **no way to see a response inside the app**, and the
`Inquiry.status` field (`pending`/`responded`/`closed`) is never transitioned.

This feature turns enquiries into a **structured, per-listing, reply-enabled system**:

- Enquiries require sign-in and are scoped to a **specific event or venue**.
- The **owner** (event organizer or venue owner) sees enquiries as an **"Enquiries"
  tab on that listing's Manage page** and can **reply once** to each.
- The **sender** sees their enquiries and the owner's reply in a **"My Enquiries"**
  view, and is notified — *"You got a reply to your enquiry"* — when a reply arrives.
- The enquiry moves through a real **status lifecycle**: `pending → responded → closed`.
- Owners are notified on new enquiries; senders on replies (in-app + push + email).
- Admins can view enquiries platform-wide for moderation/support.
- Anti-spam **rate limiting** is preserved.

This is a **single-reply model** (not an ongoing chat thread): the owner answers
each enquiry once. It reuses the existing `Inquiry` model and notification/email
infrastructure; it does **not** depend on the `Conversation`/`Message` chat system.

### Terminology

- **Enquiry**: a question a signed-in user sends about a specific event or venue.
- **Sender**: the signed-in user who submitted the enquiry.
- **Owner**: the event organizer (for events) or venue owner (for venues) who
  receives and answers the enquiry.
- **Reply**: the owner's single response to an enquiry.
- **Listing**: the event or venue an enquiry is about.
- **Manage page**: the owner-facing page for a listing (`/dashboard/events/[id]`
  for events; the venue-portal/venue manage page for venues).

### Glossary of statuses

| Status | Meaning | Set by |
|--------|---------|--------|
| `pending` | Enquiry submitted, no owner reply yet | System, on submit |
| `responded` | Owner has replied | System, when owner sends the reply |
| `closed` | Owner marked the enquiry resolved | Owner action |

---

## Requirements

### Requirement 1: Sign-in required to submit an enquiry

**User Story:** As a signed-in user, I want to send an enquiry about a specific
event or venue, so that I can ask the owner a question and receive an answer in the app.

#### Acceptance Criteria

1. WHEN an authenticated user opens the "Ask a Question" form on an event or venue page, THE system SHALL allow them to submit an enquiry with a message.
2. WHERE the visitor is NOT authenticated, THE system SHALL NOT allow enquiry submission and SHALL prompt them to sign in (redirect to sign-in, preserving the return URL to the listing).
3. WHEN an authenticated user submits an enquiry, THE system SHALL persist an `Inquiry` record with `referenceType` (`event`|`venue`), `referenceId`, `user` (the sender), `message`, and `status = 'pending'`.
4. THE system SHALL require the message to be between 10 and 2000 characters and SHALL reject submissions outside that range with a validation error shown inside the form.
5. WHILE the sender is authenticated, THE system SHALL capture the sender's identity (name/email) from their account rather than requiring manual re-entry, regardless of other validation states.
6. WHERE the referenced event is not in a valid status (`upcoming`|`approved`|`ongoing`) OR the referenced venue is not `approved`, THE system SHALL reject the enquiry with a clear "unavailable" error.

### Requirement 2: Rate limiting (anti-spam)

**User Story:** As the platform, I want to limit how many enquiries a user can send
for one listing, so that owners are not spammed.

#### Acceptance Criteria

1. THE system SHALL allow at most 5 enquiries per sender per listing within any rolling 24-hour window.
2. WHEN a sender exceeds the limit, THE system SHALL reject the enquiry with HTTP 429 and a message indicating the limit and retry guidance.
3. THE rate limit SHALL be enforced server-side (never trusting client state).

### Requirement 3: Owner is notified of a new enquiry

**User Story:** As an owner, I want to be notified when someone asks a question about
my event or venue, so that I can respond promptly.

#### Acceptance Criteria

1. WHEN an enquiry is submitted, THE system SHALL create an in-app notification for the owner titled for the specific listing (e.g. "New enquiry for {listingName}").
2. THE notification's action link SHALL open the owner's **Enquiries tab for that specific listing** (not the public listing page).
3. THE system SHALL send a push notification to the owner if they have push enabled.
4. THE system SHALL send an email to the owner containing the sender's name, the listing name, and the enquiry message.
5. IF notification and/or email delivery fails — including when all delivery methods fail simultaneously — THEN THE system SHALL still persist the enquiry so the owner can review it later (delivery is best-effort and never blocks submission).

### Requirement 4: Owner views enquiries per listing

**User Story:** As an owner, I want to see all enquiries for a specific event or venue
on that listing's manage page, so that I can review and answer them in context.

#### Acceptance Criteria

1. THE system SHALL display an "Enquiries" tab/section on the owner's Manage page for each event and each venue they own.
2. THE Enquiries section SHALL list enquiries for that listing, most recent first, showing sender name, message, status, and timestamp.
3. THE Enquiries section SHALL show a count of `pending` enquiries for the listing.
4. THE system SHALL only return enquiries for listings the requesting user owns (event organizer or venue owner); IF a non-owner requests another owner's listing enquiries, THEN THE system SHALL return an authorization error regardless of how many enquiries the listing has (never an empty list in place of the error).
5. WHERE a listing has no enquiries, THE system SHALL show an empty state.

### Requirement 5: Owner replies once to an enquiry

**User Story:** As an owner, I want to reply to an enquiry once, so that the sender
gets my answer without opening an ongoing chat.

#### Acceptance Criteria

1. WHEN an owner submits a reply to a `pending` enquiry, THE system SHALL store the reply text and the responder identity, and SHALL set the enquiry `status = 'responded'`.
2. THE system SHALL require the reply to be between 1 and 2000 characters, and THE reply UI SHALL show a live character count with guidance as the sender approaches the 2000-character limit.
3. THE system SHALL only allow the listing's owner to reply; any other user's reply attempt SHALL be rejected with an authorization error.
4. WHERE an enquiry is already `responded` or `closed`, THE system SHALL NOT allow another reply (single-reply model), and SHALL surface the existing reply as read-only.
5. THE reply SHALL be persisted atomically with the status transition so a stored reply always implies `status != 'pending'`.

### Requirement 6: Sender is notified of the reply

**User Story:** As a sender, I want to be told when an owner answers my enquiry, so
that I can read the response.

#### Acceptance Criteria

1. WHEN an owner replies, THE system SHALL create an in-app notification for the sender worded as a reply notice (e.g. "You got a reply to your enquiry about {listingName}").
2. THE notification's action link SHALL open the sender's **"My Enquiries"** view (or the specific enquiry) where the reply is visible.
3. THE system SHALL send a push notification to the sender if they have push enabled.
4. THE system SHALL send an email to the sender containing the listing name and the owner's reply.
5. IF sender notification or email delivery fails, THEN THE system SHALL still persist the reply (delivery is best-effort).

### Requirement 7: Sender views their enquiries and replies

**User Story:** As a sender, I want a place to see the enquiries I've sent and any
replies, so that I can track responses.

#### Acceptance Criteria

1. THE system SHALL provide a "My Enquiries" view in the user dashboard listing the sender's own enquiries, most recent first.
2. Each entry SHALL show the listing name/type, the sender's message, the current status, and — WHERE present — the owner's reply.
3. THE system SHALL only return enquiries belonging to the requesting user.
4. WHEN the sender opens an enquiry that has an unseen reply, THE system SHALL mark the reply as seen so the "you got a reply" indicator clears.

### Requirement 8: Enquiry status lifecycle

**User Story:** As an owner, I want enquiries to have a clear status, so that I can
tell which ones still need attention.

#### Acceptance Criteria

1. THE system SHALL initialize every new enquiry with `status = 'pending'`.
2. WHEN the owner replies, THE system SHALL transition the enquiry to `status = 'responded'`.
3. THE system SHALL allow the owner to mark a `pending` or `responded` enquiry as `closed`.
4. THE system SHALL reject invalid transitions (e.g. `closed → pending`) and SHALL treat status as owner-controlled only (senders cannot change status).
5. THE owner's Enquiries section SHALL allow filtering by status (`pending`/`responded`/`closed`/all).

### Requirement 9: Admin visibility

**User Story:** As an admin, I want to view enquiries across the platform, so that I
can moderate and support users.

#### Acceptance Criteria

1. THE system SHALL provide an admin-only endpoint/view listing enquiries platform-wide, filterable by status and reference type, with pagination.
2. THE admin view SHALL show sender, listing, message, reply (if any), status, and timestamps.
3. THE admin enquiry endpoints SHALL be gated behind admin authentication and SHALL reject non-admin access.

### Requirement 10: Data model & backward compatibility

**User Story:** As a developer, I want the enquiry data model extended cleanly, so
that existing inquiries keep working and the reply feature is queryable.

#### Acceptance Criteria

1. THE system SHALL extend the existing `Inquiry` model with reply fields (reply text, responder reference, replied-at timestamp) and a sender-seen indicator, rather than introducing a parallel model.
2. THE system SHALL preserve existing `Inquiry` records; THE reply content field SHALL be authoritative — WHERE an enquiry has no reply content, THE system SHALL treat and present it as `pending` regardless of any stored status value, automatically correcting an inconsistent `responded`/`closed` status that lacks reply content.
3. THE system SHALL index enquiries for the two primary reads: by owner's listings (owner view) and by sender (My Enquiries).
4. THE `senderName`/`senderEmail` capture SHALL continue to work, populated from the authenticated user's account.

### Requirement 11: Migration from the current form and chat bridge

**User Story:** As a product owner, I want the current "Ask a Question" behavior
cleanly replaced, so there is one consistent enquiry path.

#### Acceptance Criteria

1. THE "Ask a Question" form on event and venue pages SHALL submit through the new sign-in-gated enquiry path; IF the new enquiry path is unavailable (e.g. the endpoint errors as unreachable), THEN THE system MAY fall back to the existing chat bridge so the sender is not left with no way to contact the owner.
2. On the normal (available) enquiry path, THE system SHALL NOT open the existing `Conversation`/`Message` chat thread from the enquiry submit path (the single-reply enquiry model replaces the inquiry→chat bridge for event/venue enquiries); the chat bridge is only a degraded fallback per 11.1.
3. THE brand/creator "Send Enquiry" chat (`start-brand-enquiry`) SHALL remain unchanged — this feature governs event/venue enquiries only.
4. THE removal of the inquiry→chat bridge SHALL NOT break existing brand enquiry conversations or the messages inbox.

### Requirement 12: Reliability and correctness

**User Story:** As the platform, I want enquiry operations to be safe under
concurrency and failure, so that data stays consistent.

#### Acceptance Criteria

1. THE reply write and status transition SHALL be atomic; WHEN a reply write succeeds, THE enquiry SHALL have a non-`pending` status, and WHEN a reply write fails, THE enquiry SHALL remain `pending` with no stored reply (the invariant is enforced on successful writes; a failed write leaves the prior state untouched).
2. WHERE two reply attempts race for the same enquiry, THE system SHALL accept at most one and reject the second (single-reply invariant).
3. THE ownership check SHALL be enforced server-side on every owner action (view, reply, close), independent of client UI.
4. THE system SHALL validate all inputs (message length, status transitions, reference validity) at the server trust boundary.
