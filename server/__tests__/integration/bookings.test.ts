import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './helpers/createApp';

vi.mock('../../services/bookingService', () => ({
  default: {
    getAllBookings: vi.fn(),
    getUserBookings: vi.fn(),
  },
  __esModule: true,
}));

vi.mock('../../middleware/httpCache', () => ({
  publicCache: (_req: any, _res: any, next: any) => next(),
  noStoreCache: (_req: any, _res: any, next: any) => next(),
  invalidateCache: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/auth', () => {
  // Simulate auth rejecting when no token provided
  const realAuth = (req: any, res: any, next: any) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    req.user = { _id: 'test-user-id', role: 'user' };
    req.token = token;
    next();
  };
  return { default: realAuth, requireAuth: () => realAuth, __esModule: true };
});

vi.mock('../../services/cacheService', () => ({
  isRedisAvailable: () => false,
  getRedisClient: () => null,
}));

describe('Booking routes integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = createApp();
    const bookingRoutes = (await import('../../routes/booking')).default || (await import('../../routes/booking'));
    app.use('/api/v1/bookings', bookingRoutes);
  });

  it('GET /api/v1/bookings — returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/bookings');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/bookings/user/:userId — returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/bookings/user/some-user-id');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
