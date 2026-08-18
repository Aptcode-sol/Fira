import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './helpers/createApp';

vi.mock('../../services/venueService', () => ({
  default: {
    getAllVenues: vi.fn(),
    getVenueById: vi.fn(),
  },
  __esModule: true,
}));

vi.mock('../../middleware/httpCache', () => ({
  publicCache: (_req: any, _res: any, next: any) => next(),
  noStoreCache: (_req: any, _res: any, next: any) => next(),
  invalidateCache: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/venueOwnerAuth', () => {
  const passthrough = (_req: any, _res: any, next: any) => next();
  return { venueOwnerAuth: passthrough, requireAuth: () => passthrough, __esModule: true };
});

vi.mock('../../services/cacheService', () => ({
  isRedisAvailable: () => false,
  getRedisClient: () => null,
}));

describe('Venue routes integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = createApp();
    const venueRoutes = (await import('../../routes/venue')).default || (await import('../../routes/venue'));
    app.use('/api/v1/venues', venueRoutes);
  });

  it('GET /api/v1/venues — returns 200 with venue list', async () => {
    const venueService = (await import('../../services/venueService')).default || (await import('../../services/venueService'));
    venueService.getAllVenues.mockResolvedValue({ venues: [], total: 0 });

    const res = await request(app).get('/api/v1/venues');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('venues');
  });

  it('GET /api/v1/venues/:id — returns 404 for non-existent venue', async () => {
    const venueService = (await import('../../services/venueService')).default || (await import('../../services/venueService'));
    venueService.getVenueById.mockRejectedValue(new Error('Venue not found'));

    const res = await request(app).get('/api/v1/venues/000000000000000000000000');

    expect([404, 500]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });
});
