import { describe, it, expect, jest, afterEach } from '@jest/globals';
import {
  RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_SIZE,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_AGE,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_INTERVAL,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_BATCH_SIZE,
  RATE_LIMIT_SUSPICIOUS_PATTERNS_MIN_CLEANUP_INTERVAL,
} from '../../../src/config/constants.js';

/**
 * Helper to mock express-rate-limit and expose the configuration used by the middleware factories.
 * @returns {jest.Mock}
 */
function setupRateLimitMock() {
  const rateLimitMock = jest.fn((config) => {
    const middleware = (req, res, next) => {
      middleware.config = config;
      if (config.keyGenerator) {
        try {
          middleware.generatedKey = config.keyGenerator(req);
        } catch (error) {
          middleware.keyGeneratorError = error;
        }
      }
      if (typeof next === 'function') {
        next();
      }
    };
    middleware.config = config;
    return middleware;
  });

  jest.doMock('express-rate-limit', () => ({
    __esModule: true,
    default: rateLimitMock,
  }));

  return rateLimitMock;
}

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('SuspiciousPatternsManager uncovered branches', () => {
  it('uses default configuration values when options are omitted', async () => {
    jest.useFakeTimers();
    const { SuspiciousPatternsManager } = await import(
      '../../../src/middleware/rateLimiting.js'
    );

    const manager = new SuspiciousPatternsManager();

    expect(manager.maxSize).toBe(RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_SIZE);
    expect(manager.maxAge).toBe(RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_AGE);
    expect(manager.cleanupInterval).toBe(
      RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_INTERVAL
    );
    expect(manager.batchSize).toBe(
      RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_BATCH_SIZE
    );
    expect(manager.minCleanupInterval).toBe(
      RATE_LIMIT_SUSPICIOUS_PATTERNS_MIN_CLEANUP_INTERVAL
    );

    manager.destroy();
  });

  it('counts patterns without request history safely in getStats()', async () => {
    jest.useFakeTimers();
    const { SuspiciousPatternsManager } = await import(
      '../../../src/middleware/rateLimiting.js'
    );

    const manager = new SuspiciousPatternsManager();
    const staleTimestamp = Date.now() - manager.maxAge - 1;

    manager.patterns.set('no-history-client', {
      updatedAt: staleTimestamp,
      requests: undefined,
    });

    const stats = manager.getStats();

    expect(stats.totalRequestsTracked).toBe(0);
    expect(stats.expiredEntries).toBeGreaterThanOrEqual(1);

    manager.destroy();
  });
});

describe('generateRateLimitKey uncovered scenarios', () => {
  it('returns a global key when invoked with an invalid request object', async () => {
    const rateLimitMock = setupRateLimitMock();
    const { createApiRateLimiter } = await import(
      '../../../src/middleware/rateLimiting.js'
    );

    const limiter = createApiRateLimiter();
    expect(rateLimitMock).toHaveBeenCalled();

    const key = limiter.config.keyGenerator(undefined);
    expect(key).toBe('global:unknown');
  });

  it('falls back to the direct client IP when IPv6 extraction fails', async () => {
    setupRateLimitMock();
    jest.doMock('../../../src/utils/ipv6Utils.js', () => ({
      __esModule: true,
      isIPv6Hostname: jest.fn(() => true),
      extractIPv6FromHostname: jest.fn(() => null),
      isValidPublicIPv6: jest.fn(() => false),
    }));

    const { createApiRateLimiter } = await import(
      '../../../src/middleware/rateLimiting.js'
    );

    const limiter = createApiRateLimiter();
    const req = {
      headers: { 'x-forwarded-for': '[2001:db8::1]' },
      ip: '198.51.100.9',
      connection: {},
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    limiter(req, res, next);

    expect(limiter.generatedKey).toBe('ip:198.51.100.9');
    expect(next).toHaveBeenCalled();
  });
});
