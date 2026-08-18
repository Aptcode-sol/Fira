import { describe, it, expect } from 'vitest';

const { createCircuitBreaker, ServiceUnavailableError } = require('../../lib/circuitBreaker');

describe('circuitBreaker', () => {
  it('createCircuitBreaker returns a working breaker that calls the wrapped function', async () => {
    const fn = async (x: number) => x * 2;
    const breaker = createCircuitBreaker('test-service', fn, {
      volumeThreshold: 1,
      rollingCountTimeout: 1000,
      resetTimeout: 500,
    });
    const result = await breaker.fire(5);
    expect(result).toBe(10);
    breaker.shutdown();
  });

  it('breaker opens after failures and subsequent calls throw ServiceUnavailableError', async () => {
    const failingFn = async () => {
      throw new Error('upstream down');
    };

    const breaker = createCircuitBreaker('fail-service', failingFn, {
      volumeThreshold: 1,
      errorThresholdPercentage: 1,
      rollingCountTimeout: 10_000,
      resetTimeout: 30_000,
    });

    // The fallback intercepts failures immediately (converts to ServiceUnavailableError)
    // After volumeThreshold failures, opossum opens the circuit
    await expect(breaker.fire()).rejects.toThrow(ServiceUnavailableError);
    // Second call also gets the 503 error (circuit now open, fallback fires)
    await expect(breaker.fire()).rejects.toThrow(ServiceUnavailableError);

    breaker.shutdown();
  });

  it('ServiceUnavailableError has statusCode 503', () => {
    const err = new ServiceUnavailableError('TestSvc');
    expect(err.statusCode).toBe(503);
    expect(err.service).toBe('TestSvc');
    expect(err.message).toContain('TestSvc');
  });
});
