/**
 * Minimal Express app factory for integration tests.
 *
 * Avoids importing the full index.js (which connects to MongoDB, Redis, Sentry
 * at startup). Instead, wires just the middleware and routes needed for each
 * test file. Tests use mongodb-memory-server via the global setup.ts.
 */
import express from 'express';

export function createApp() {
  const app = express();

  // Body parsing — same limits as production
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  return app;
}
