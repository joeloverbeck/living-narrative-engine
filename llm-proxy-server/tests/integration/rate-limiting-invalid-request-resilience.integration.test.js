import { describe, beforeAll, afterAll, it, expect, jest } from '@jest/globals';

let createApiRateLimiter;
let RATE_LIMIT_GENERAL_MAX_REQUESTS;
let originalNodeEnv;

const createCorruptedRequest = () => {
  /** @type {Function & Record<string, any>} */
  const req = function corruptedRequest() {};
  req.headers = {};
  req.method = 'GET';
  req.originalUrl = '/corrupted';
  req.path = '/corrupted';
  req.ip = '198.51.100.200';
  req.connection = { remoteAddress: '198.51.100.200' };
  req.socket = { remoteAddress: '198.51.100.200' };
  req.app = { get: () => false };
  req.rateLimit = { limit: RATE_LIMIT_GENERAL_MAX_REQUESTS, totalHits: 0, resetTime: new Date(Date.now() + 1000) };
  req.res = createFakeResponse();
  return req;
};

const createFakeResponse = () => {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    locals: {},
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.writableEnded = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.writableEnded = true;
      return this;
    },
    end(payload) {
      this.body = payload;
      this.writableEnded = true;
      return this;
    },
    on() {
      return this;
    },
  };
};

describe('Rate limiting middleware corrupted request resilience', () => {
  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    ({ createApiRateLimiter } = await import('../../src/middleware/rateLimiting.js'));
    ({ RATE_LIMIT_GENERAL_MAX_REQUESTS } = await import('../../src/config/constants.js'));
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('falls back to global rate limit key when request is not a plain object', async () => {
    const limiter = createApiRateLimiter({ trustProxy: true });

    for (let i = 0; i < RATE_LIMIT_GENERAL_MAX_REQUESTS; i++) {
      const req = createCorruptedRequest();
      const res = req.res;
      const next = jest.fn();
      await limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    }

    const blockedReq = createCorruptedRequest();
    const blockedRes = blockedReq.res;
    const next = jest.fn();

    await limiter(blockedReq, blockedRes, next);

    expect(next).not.toHaveBeenCalled();
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedRes.body?.error?.details?.clientId).toBe('global');
    expect(blockedRes.body?.error?.details?.retryAfter).toBeGreaterThan(0);
    expect(blockedRes.headers['ratelimit-limit']).toBeDefined();

    await limiter.resetKey('global:unknown');
  });
});
