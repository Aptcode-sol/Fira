/**
 * Unit tests for tokenBlocklist service.
 *
 * ponytail: vitest vi.mock doesn't intercept CJS require() chains properly in
 * this project's ESM/CJS hybrid setup. We use the proxyquire-style approach:
 * mock by patching the real module's exports before importing the dependent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to manually intercept the cacheService module that tokenBlocklist requires.
// Strategy: require cacheService first, then spy on its exports.
// This works because CJS modules share the same exports object by reference.

const cacheService = require('../../services/cacheService');
const originalIsRedisAvailable = cacheService.isRedisAvailable;
const originalGetRedisClient = cacheService.getRedisClient;

const mockRedisClient = {
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
};

// Patch cacheService BEFORE tokenBlocklist is loaded so destructured refs capture our mock.
const isRedisAvailableMock = vi.fn(() => true);
const getRedisClientMock = vi.fn(() => mockRedisClient);
cacheService.isRedisAvailable = isRedisAvailableMock;
cacheService.getRedisClient = getRedisClientMock;

// Now load tokenBlocklist — it will destructure our mocked functions
const { blockToken, isBlocked } = require('../../services/tokenBlocklist');

describe('tokenBlocklist service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.get.mockResolvedValue(null);
    isRedisAvailableMock.mockReturnValue(true);
  });

  afterEach(() => {
    // Restore originals
    cacheService.isRedisAvailable = originalIsRedisAvailable;
    cacheService.getRedisClient = originalGetRedisClient;
  });

  it('blockToken stores token in Redis with TTL matching remaining expiry', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
    const fakeToken = `eyJhbGciOiJIUzI1NiJ9.${payload}.fakesig`;

    const result = await blockToken(fakeToken);
    expect(result.blocked).toBe(true);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      `blocked:${fakeToken}`,
      '1',
      'EX',
      expect.any(Number),
    );
    const ttl = (mockRedisClient.set.mock.calls[0] as any[])[3] as number;
    expect(ttl).toBeGreaterThan(3500);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('blockToken returns error when Redis is unavailable', async () => {
    isRedisAvailableMock.mockReturnValue(false);
    const result = await blockToken('some-token');
    expect(result.blocked).toBe(false);
    expect(result.error).toBe('Redis unavailable');
  });

  it('isBlocked returns true for a blocked token', async () => {
    mockRedisClient.get.mockResolvedValue('1');
    const result = await isBlocked('blocked-token');
    expect(result).toBe(true);
  });

  it('isBlocked throws when Redis is unavailable (fail-closed)', async () => {
    isRedisAvailableMock.mockReturnValue(false);
    await expect(isBlocked('any-token')).rejects.toThrow('Redis unavailable');
  });
});
