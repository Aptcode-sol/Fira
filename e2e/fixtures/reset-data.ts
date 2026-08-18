/**
 * Deterministic fixture data reset helper.
 * Calls the server's test seed API to reset DB state before each suite.
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

export async function resetTestData(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/test/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suite: 'e2e', reset: true }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to reset test data: ${response.status} ${response.statusText}`
    );
  }
}

/**
 * Test user credentials seeded by resetTestData.
 */
export const TEST_USER = {
  email: 'e2e-user@fira.test',
  password: 'TestPass123!',
  name: 'E2E Test User',
  phone: '+919999900000',
} as const;

export const TEST_ADMIN = {
  email: 'e2e-admin@fira.test',
  password: 'AdminPass123!',
  name: 'E2E Admin',
} as const;

export const TEST_VENUE_OWNER = {
  email: 'e2e-venue@fira.test',
  password: 'VenuePass123!',
  name: 'E2E Venue Owner',
} as const;
