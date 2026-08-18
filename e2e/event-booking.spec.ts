import { test, expect } from '@playwright/test';
import { resetTestData, TEST_USER } from './fixtures/reset-data';

test.describe('Event Booking Journey', () => {
  test.beforeAll(async () => {
    await resetTestData();
  });

  test('browse events listing page', async ({ page }) => {
    // Navigate to events listing
    // Verify events are displayed (at least one from seed data)
    // Verify event cards show title, date, venue, price
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('select event and view details', async ({ page }) => {
    // Click on an event card
    // Verify event detail page loads
    // Verify all event information is displayed (description, venue, schedule, pricing)
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('initiate booking requires authentication', async ({ page }) => {
    // Click "Book" on event detail page while logged out
    // Verify redirect to login or auth prompt
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('complete booking with payment', async ({ page }) => {
    // Login as TEST_USER
    // Navigate to event detail
    // Click "Book" button
    // Select ticket type/quantity
    // Complete payment flow (Razorpay test mode)
    // Verify booking confirmation page
    // Verify booking appears in user's bookings list
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('booking confirmation shows ticket details', async ({ page }) => {
    // After successful booking, verify confirmation page shows:
    // - Event name, date, venue
    // - Ticket type and quantity
    // - Payment amount and reference
    // - QR code or ticket ID
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });
});
