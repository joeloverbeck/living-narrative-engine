import { describe, it, expect, afterEach, jest } from '@jest/globals';

import {
  createApiRateLimiter,
  createAdaptiveRateLimiter,
  SuspiciousPatternsManager,
} from '../../src/middleware/rateLimiting.js';

function createStubRequest(overrides = {}) {
  const baseHeaders = overrides.headers || {};
  const normalizedHeaders = Object.keys(baseHeaders).reduce((acc, key) => {
    acc[key.toLowerCase()] = baseHeaders[key];
    return acc;
  }, {});

  return {
    method: 'GET',
    headers: normalizedHeaders,
    connection: {},
    ip: undefined,
    get(header) {
      return this.headers[header.toLowerCase()];
    },
    ...overrides,
    headers: normalizedHeaders,
  };
}

function createStubResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    headersSent: false,
    body: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    header(name, value) {
      this.setHeader(name, value);
      return this;
    },
    get(name) {
      return headers.get(name.toLowerCase());
    },
    on() {
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  };
}

function invokeLimiter(limiter, req, res) {
  return new Promise((resolve) => {
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      const result = originalJson(payload);
      resolve('blocked');
      return result;
    };

    const originalStatus = res.status.bind(res);
    res.status = (code) => {
      originalStatus(code);
      return res;
    };

    limiter(req, res, () => resolve('next'));
  });
}

describe('rate limiting resilience for anomalous client contexts', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('derives a global fallback key when requests lack distinguishing headers or connection metadata', async () => {
    const limiter = createApiRateLimiter({ trustProxy: true });

    const anonymousRequest = createStubRequest({
      headers: {},
      connection: {},
      ip: undefined,
      method: 'GET',
    });
    const response = createStubResponse();

    const outcome = await invokeLimiter(limiter, anonymousRequest, response);

    expect(outcome).toBe('next');
    expect(anonymousRequest.rateLimit.key).toBe('global:unknown');

    await limiter.resetKey(anonymousRequest.rateLimit.key);
  });

  it('emits adaptive limiter responses when repeated malformed requests exceed dynamic thresholds', async () => {
    jest.useFakeTimers();

    const limiter = createAdaptiveRateLimiter({
      baseWindowMs: 200,
      baseMaxRequests: 2,
      trustProxy: true,
      minCleanupInterval: 0,
    });

    const buildRequest = () =>
      createStubRequest({
        headers: {
          'x-forwarded-for': 'not-an-ip',
          'x-real-ip': 'also-not-valid',
          'user-agent': '',
        },
        connection: {},
        ip: undefined,
        method: 'POST',
      });

    const first = createStubResponse();
    const second = createStubResponse();
    const third = createStubResponse();

    const firstOutcome = await invokeLimiter(limiter, buildRequest(), first);
    const secondOutcome = await invokeLimiter(limiter, buildRequest(), second);
    const thirdOutcome = await invokeLimiter(limiter, buildRequest(), third);

    expect(firstOutcome).toBe('next');
    expect(secondOutcome).toBe('next');
    expect(thirdOutcome).toBe('blocked');
    expect(third.statusCode).toBe(429);
    expect(third.body.error.code).toBe('ADAPTIVE_RATE_LIMIT_EXCEEDED');
    expect(third.body.error.details.rateLimitType).toBe('adaptive');
    expect(third.body.error.details.severity).toBe('normal');

    limiter.destroy();
  });

  it('ignores invalid keys when managing suspicious patterns and cleans up safely', () => {
    const manager = new SuspiciousPatternsManager({
      maxSize: 1,
      maxAge: 25,
      minCleanupInterval: 0,
      cleanupInterval: 20,
      batchSize: 1,
    });

    expect(manager.get(null)).toBeUndefined();
    manager.set(null, null);
    expect(manager.size()).toBe(0);

    const now = Date.now();
    manager.set('valid-client', {
      createdAt: now,
      updatedAt: now,
      requests: [now - 10],
    });

    expect(manager.size()).toBe(1);

    manager.delete(null);
    expect(manager.size()).toBe(1);

    const removed = manager.fullCleanup();
    expect(removed).toBeGreaterThanOrEqual(0);

    manager.destroy();
  });
});
