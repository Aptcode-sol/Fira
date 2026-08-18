<!-- converted from FIRA.docx -->






FIRA - Event Organising & Management Platform
- Aptcode











1. Introduction
1.1 Purpose
The Event Organising & Management Platform is a full-stack web platform that enables:
Venue owners to list and monetize venues
Users to book venues and organize events
Event organizers to sell tickets or host free events
Users to attend events (public or private)
Brands and bands to build audiences through verified profiles
The platform fully manages bookings, payments, ticketing, approvals, notifications, and tracking in a secure and transparent way.

1.2 Scope
The system manages:
Venue listings & bookings
Event creation (public & private)
Ticket sales and free events
Private event invitation system
Payment gateway integration
Refunds and organizer payouts
Admin dashboard & verification workflows
Location-based discovery (Google Maps)

2. User Roles & Access Levels
2.1 User (Common Role)
A single user account can:
Book venues
Create events
Sell tickets
Buy tickets
Attend events
Follow brands/bands

2.2 Venue Owner
Venue owners can:
List venues
Set prices & availability
Accept or reject booking requests
Receive payments for bookings
A venue owner is also a user but with venue management privileges.

2.3 Verified User (Brand / Band / Organizer)
Verified users receive:
Verification badge
Dedicated public page
Followers & notification system
Higher trust visibility

2.4 Admin
Admins control platform governance:
Verification approvals
Event monitoring
Payment oversight
Dispute handling
Platform analytics



3. Registration, Profiles & Verification
3.1 Registration
Users register using:
Email & password
(Optional) social login

3.2 Verification Application Flow
Users can apply for verification by submitting:
Brand/Band name
Description
Supporting documents or links
Social media profiles

3.3 Verification Status
Pending
Approved (verified badge shown)
Rejected (reason recorded)

4. Venue Management (Owner Side)
4.1 Venue Listing
Venue details include:
Name & description
Images/videos
Capacity
Pricing
Amenities
Rules
Location via Google Maps
4.2 Availability & Booking
Owners define availability slots
Users request booking
Owner can:
Accept
Reject
Modify dates

5. Venue & Event Discovery (User Side)
Users can search:
Nearby venues
Upcoming events
Verified brand events
Filters include:
Location
Date
Price
Event type

6. Event Creation & Types
6.1 Event Types
Public Events
Visible to all users
Free or paid tickets
Private Events
Access controlled by private code
Approval-based joining

6.2 Event Creation Details
Event creator provides:
Event name
Description
Date & time
Venue
Ticket type (free/paid)
Max attendees

7. Ticketing System
7.1 Ticket Generation
Each ticket includes:
Unique ticket ID
QR code
Buyer details
Event reference

7.2 Ticket Usage
Tickets stored in user account
QR code used for entry validation
Attendance tracked

8. Payment Gateway Integration (Critical Feature)
8.1 Payment Gateway Scope
The platform fully manages all payments, including:
Venue booking payments
Ticket purchases
Refunds
Organizer payouts
Platform commissions

8.2 Supported Payment Methods
UPI
Debit / Credit Cards
Net Banking
Wallets (future scope)

9. Payment Flow – Venue Booking
Venue Booking Payment Flow
User selects venue and booking date
Booking request sent to owner
Owner accepts booking
User is redirected to payment gateway
Payment success:
Booking confirmed
Amount held in platform escrow
Payment failure:
Booking cancelled

10. Payment Flow – Ticket Purchase
Ticket Purchase Flow
User selects event
Chooses ticket quantity
Redirected to payment gateway


On success:
Ticket generated
Ticket stored in user profile
Event attendance updated

11. Platform Commission & Payouts
11.1 Commission Model
Platform deducts a configurable percentage
Remaining amount credited to organizer/venue owner

11.2 Organizer Payout Flow
Event completed
Admin/system triggers payout
Amount transferred to organizer’s bank account
Payout status updated

12. Refund Management
12.1 Refund Scenarios
Refunds can occur due to:
Event cancellation
Venue booking cancellation
Admin-enforced refunds
12.2 Refund Flow
Refund request initiated
Eligibility checked
Amount refunded via payment gateway
Refund status updated

13. Private Event Access System
13.1 Private Event Code
Auto-generated unique code
Shareable externally

13.2 Approval Flow
User enters private code
Request sent to event owner
Owner approves or rejects
Access granted only on approval

14. Notifications System
Notifications sent for:
Booking approvals
Payment success/failure
Event reminders
New events from followed pages
Verification status updates

15. User History & Tracking
15.1 User Dashboard
Users can view:
Created events
Booked venues
Tickets purchased
Events attended
Payment history

15.2 Organizer Dashboard
Organizers can view:
Ticket sales
Revenue
Attendee lists
Event performance

16. Admin Dashboard (Detailed)
16.1 Verification Management
Admin can:
View verification applications
Review documents
Approve or reject
Assign verified badge

16.2 Event Monitoring
Admin dashboard displays:
Ongoing events
Upcoming events
Past events
Event details:
Organizer
Venue
Tickets sold
Revenue




16.3 Payment & Finance Panel
Admin can view:
Total platform revenue
Pending payouts
Completed payouts
Refund requests
Failed payments

16.4 Venue Moderation
Admins can:
Approve/reject venue listings
Suspend venues
Handle disputes

17. External Integrations
Google Maps API (location & nearby search)
Payment Gateway API
Notification service (email/SMS/push)
