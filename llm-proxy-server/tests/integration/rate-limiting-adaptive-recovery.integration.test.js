import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  createAdaptiveRateLimiter,
  createApiRateLimiter,
  SuspiciousPatternsManager,
} from '../../src/middleware/rateLimiting.js';

const createResponseStub = () => ({
  headersSent: false,
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  setHeader() {
    return this;
  },
  end() {
    return this;
  },
  send() {
    return this;
  },
  on() {
    return this;
  },
});

describe('Rate limiting adaptive recovery integration coverage', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('gracefully schedules cleanup even when cleanup logic throws', () => {
    jest.useFakeTimers();

    const manager = new SuspiciousPatternsManager({
      cleanupInterval: 1000,
      minCleanupInterval: 0,
      batchSize: 1,
    });

    const cleanupSpy = jest
      .spyOn(manager, 'cleanupExpired')
      .mockImplementation(() => {
        throw new Error('intentional cleanup failure');
      });

    manager.scheduleCleanup();
    expect(manager.cleanupTimer).not.toBeNull();

    jest.runOnlyPendingTimers();

    expect(cleanupSpy).toHaveBeenCalled();
    expect(manager.cleanupTimer).toBeNull();

    cleanupSpy.mockRestore();
    manager.destroy();
  });

  it('falls back to the global identifier when proxy headers are malformed', async () => {
    const limiter = createApiRateLimiter({ trustProxy: true });

    const malformedRequest = {
      method: 'GET',
      path: '/manual-fallback',
      headers: { 'x-forwarded-for': 'not-a-valid-ip' },
      connection: {},
      ip: undefined,
    };

    const response = createResponseStub();
    const next = jest.fn();

    await limiter(malformedRequest, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(malformedRequest.rateLimit?.key).toBe('global:unknown');

    if (typeof limiter.destroy === 'function') {
      limiter.destroy();
    }
  });

  it('reduces limits for suspicious bursts and maintains safe handling after cooldowns', async () => {
    const limiter = createAdaptiveRateLimiter({
      baseWindowMs: 200,
      baseMaxRequests: 5,
      trustProxy: true,
      useApiKey: false,
      minCleanupInterval: 0,
    });

    const createRequest = () => ({
      method: 'GET',
      path: '/adaptive-recovery',
      headers: {
        'x-forwarded-for': '198.51.100.188',
        'user-agent': 'adaptive-recovery-suite',
      },
      connection: {},
      ip: undefined,
    });

    const next = jest.fn();

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const callLimiter = async () => {
      const req = createRequest();
      const res = createResponseStub();
      await limiter(req, res, next);
      return { req, res };
    };

    const burstOutcomes = [];
    for (let i = 0; i < 8; i += 1) {
      burstOutcomes.push(await callLimiter());
      // Keep requests within the same window to trigger the adaptive guard quickly.
      await sleep(10);
    }

    const highSeverityBlock = burstOutcomes.find(
      (entry) =>
        entry.res.statusCode === 429 &&
        entry.res.body?.error?.details?.severity === 'high'
    );

    expect(highSeverityBlock).toBeDefined();
    expect(highSeverityBlock?.req.rateLimit.limit).toBe(1);

    await sleep(500);
    const postCooldown = await callLimiter();
    expect(postCooldown.res.statusCode).toBe(200);
    expect(postCooldown.req.rateLimit.limit).toBe(1);

    if (typeof limiter.destroy === 'function') {
      limiter.destroy();
    }
  });
});
