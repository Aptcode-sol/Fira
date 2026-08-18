import { test, expect } from '@playwright/test';
import { resetTestData, TEST_VENUE_OWNER } from './fixtures/reset-data';

test.describe('Venue Creation Journey', () => {
  test.beforeAll(async () => {
    await resetTestData();
  });

  test('venue creation form loads for authenticated venue owner', async ({ page }) => {
    // Login as TEST_VENUE_OWNER
    // Navigate to venue creation page
    // Verify form fields are visible: name, description, address, capacity, images
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('submit venue creation form with valid data', async ({ page }) => {
    // Login as TEST_VENUE_OWNER
    // Fill in all required venue fields
    // Upload at least one image
    // Submit the form
    // Verify success message or redirect to venue detail
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('created venue appears in public listings', async ({ page }) => {
    // After venue creation, navigate to public venue listings
    // Verify the newly created venue appears in the list
    // Verify venue card shows correct name, location, and image
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('venue creation fails with missing required fields', async ({ page }) => {
    // Login as TEST_VENUE_OWNER
    // Submit form with missing required fields
    // Verify validation errors are shown
    // Verify form is not submitted
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('unauthenticated users cannot access venue creation', async ({ page }) => {
    // Navigate to venue creation page while logged out
    // Verify redirect to login page
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });
});
