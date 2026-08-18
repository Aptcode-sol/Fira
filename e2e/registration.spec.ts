import { test, expect } from '@playwright/test';
import { resetTestData, TEST_USER } from './fixtures/reset-data';

test.describe('User Registration Journey', () => {
  test.beforeAll(async () => {
    await resetTestData();
  });

  test('signup with valid credentials', async ({ page }) => {
    // Navigate to signup page
    // Fill in name, email, phone, password
    // Submit the form
    // Verify redirect to verification page or success message
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('email verification completes registration', async ({ page }) => {
    // Simulate clicking the verification link (or entering OTP)
    // Verify account becomes active
    // Verify redirect to login or dashboard
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('login with verified account succeeds', async ({ page }) => {
    // Navigate to login page
    // Enter verified credentials
    // Submit the form
    // Verify redirect to dashboard / home
    // Verify auth token is stored (cookie or localStorage)
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('login with unverified account fails', async ({ page }) => {
    // Attempt login with unverified email
    // Verify appropriate error message is displayed
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });

  test('login with wrong password shows error', async ({ page }) => {
    // Navigate to login
    // Enter valid email with wrong password
    // Verify error message without leaking account existence
    test.skip(true, 'Skeleton — implement when infrastructure is running');
  });
});
