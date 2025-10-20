import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { createApiRateLimiter } from '../../src/middleware/rateLimiting.js';

const createStubRequest = () => {
  const req = Object.create(null);
  req.method = 'GET';
  req.url = '/anonymous';
  req.originalUrl = '/anonymous';
  req.headers = undefined;
  req.connection = undefined;
  req.socket = undefined;
  req.ip = undefined;
  req.get = () => undefined;
  return req;
};

const createStubResponse = () => ({
  statusCode: 200,
  headers: Object.create(null),
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = String(value);
  },
  getHeader(name) {
    return this.headers[name.toLowerCase()];
  },
  end() {},
  on() {},
  once() {},
  emit() {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const invokeLimiter = (limiter, req, res) =>
  new Promise((resolve, reject) => {
    limiter(req, res, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

describe('rate limiting integration for nullish client identification', () => {
  let limiter;

  beforeEach(() => {
    limiter = createApiRateLimiter({ trustProxy: true });
  });

  afterEach(() => {
    if (limiter && typeof limiter.destroy === 'function') {
      limiter.destroy();
    }
  });

  it('falls back to the global anonymous key when network metadata is absent', async () => {
    const req = createStubRequest();
    const res = createStubResponse();

    await invokeLimiter(limiter, req, res);

    expect(req.rateLimit).toBeDefined();
    expect(req.rateLimit.key).toBe('global:unknown');
    expect(req.rateLimit.current).toBe(1);

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-policy']).toBe('2000;w=900');
    expect(res.headers['ratelimit-remaining']).toBe('1999');
  });

  it('continues tracking successive anonymous requests with consistent fallback keys', async () => {
    const firstReq = createStubRequest();
    const firstRes = createStubResponse();
    await invokeLimiter(limiter, firstReq, firstRes);

    const secondReq = createStubRequest();
    const secondRes = createStubResponse();
    await invokeLimiter(limiter, secondReq, secondRes);

    const thirdReq = createStubRequest();
    const thirdRes = createStubResponse();
    await invokeLimiter(limiter, thirdReq, thirdRes);

    expect(firstReq.rateLimit.key).toBe('global:unknown');
    expect(secondReq.rateLimit.key).toBe('global:unknown');
    expect(thirdReq.rateLimit.key).toBe('global:unknown');

    expect(firstReq.rateLimit.current).toBe(1);
    expect(secondReq.rateLimit.current).toBe(2);
    expect(thirdReq.rateLimit.current).toBe(3);

    expect(Number(secondRes.headers['ratelimit-remaining'])).toBe(
      Number(firstRes.headers['ratelimit-remaining']) - 1
    );
    expect(Number(thirdRes.headers['ratelimit-remaining'])).toBe(
      Number(secondRes.headers['ratelimit-remaining']) - 1
    );
  });
});
