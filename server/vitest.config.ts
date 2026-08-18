import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['services/**', 'middleware/**', 'routes/**', 'lib/**'],
      exclude: ['node_modules', 'dist', 'seeds', '__tests__'],
      thresholds: {
        lines: 60,
      },
    },
  },
});
