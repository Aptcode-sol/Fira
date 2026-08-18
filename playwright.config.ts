import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E configuration for FIRA platform.
 * Covers three core journeys: registration, event booking, venue creation.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  // 5-minute global timeout per test
  timeout: 5 * 60 * 1000,

  use: {
    // Client app base URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Capture screenshots on failure
    screenshot: 'only-on-failure',

    // Capture trace on first retry
    trace: 'on-first-retry',

    // Extra HTTP headers for API calls
    extraHTTPHeaders: {
      'X-Test-Suite': 'playwright-e2e',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  // ponytail: no webServer block — tests assume infra is running externally
  // or started via CI pipeline before this suite executes.
});
