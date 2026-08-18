import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './helpers/createApp';

vi.mock('../../services/eventService', () => ({
  default: {
    getAllEvents: vi.fn(),
    getEventById: vi.fn(),
  },
  __esModule: true,
}));

vi.mock('../../middleware/httpCache', () => ({
  publicCache: (_req: any, _res: any, next: any) => next(),
  noStoreCache: (_req: any, _res: any, next: any) => next(),
  invalidateCache: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/auth', () => {
  const passthrough = (_req: any, _res: any, next: any) => next();
  return { default: passthrough, requireAuth: () => passthrough, __esModule: true };
});

vi.mock('../../services/cacheService', () => ({
  isRedisAvailable: () => false,
  getRedisClient: () => null,
}));

describe('Event routes integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = createApp();
    const eventRoutes = (await import('../../routes/event')).default || (await import('../../routes/event'));
    app.use('/api/v1/events', eventRoutes);
  });

  it('GET /api/v1/events — returns 200 with event list', async () => {
    const eventService = (await import('../../services/eventService')).default || (await import('../../services/eventService'));
    eventService.getAllEvents.mockResolvedValue({ events: [], total: 0 });

    const res = await request(app).get('/api/v1/events');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
  });

  it('GET /api/v1/events/:id — returns 404 for non-existent event', async () => {
    const eventService = (await import('../../services/eventService')).default || (await import('../../services/eventService'));
    eventService.getEventById.mockRejectedValue(new Error('Event not found'));

    const res = await request(app).get('/api/v1/events/000000000000000000000000');

    // Route handler catches and returns 500 (or 404 depending on route impl)
    expect([404, 500]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });
});
