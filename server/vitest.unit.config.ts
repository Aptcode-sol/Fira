import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/unit/**/*.test.ts', '__tests__/*.property.test.ts'],
    // No global setupFiles — pure unit tests don't need MongoDB.
    // Property tests that need MongoDB spin up mongodb-memory-server themselves
    // (see beforeAll/afterAll in __tests__/*.property.test.ts).
    // Money property tests can be slow (many generated cases); give them room.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
