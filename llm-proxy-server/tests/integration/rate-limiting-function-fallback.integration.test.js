/**
 * @file rate-limiting-function-fallback.integration.test.js
 * @description Exercises the rate limiting middlewares when invoked with
 *              callable request shells (functions) to ensure the global
 *              fallback identifier path executes without throwing and that
 *              limiter counters continue to advance normally.
 */

import { describe, expect, it } from '@jest/globals';

import {
  createAdaptiveRateLimiter,
  createApiRateLimiter,
  createLlmRateLimiter,
} from '../../src/middleware/rateLimiting.js';

/**
 * Creates a callable request shell that mimics the minimal surface that
 * express-rate-limit interacts with while keeping the underlying value a
 * function so that `typeof req !== 'object'` evaluates to true inside
 * generateRateLimitKey.
 * @param {Partial<import('express').Request>} overrides
 * @returns {Function & import('express').Request}
 */
function createCallableRequest(overrides = {}) {
  const req = function requestShell() {};
  Object.assign(req, {
    method: 'GET',
    url: '/callable-rate-limit',
    originalUrl: '/callable-rate-limit',
    headers: Object.create(null),
    connection: {},
    get: () => undefined,
    ...overrides,
  });
  return req;
}

/**
 * Creates a minimal stub response implementing the methods exercised by
 * express-rate-limit during middleware execution.
 * @returns {import('express').Response}
 */
function createStubResponse() {
  return {
    headers: Object.create(null),
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = String(value);
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {},
    on() {},
    once() {},
    emit() {},
  };
}

/**
 * Invokes a rate limiter middleware with the provided request/response shell.
 * @param {Function} limiter
 * @param {Function & import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
function invokeLimiter(limiter, req, res) {
  return new Promise((resolve, reject) => {
    limiter(req, res, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

describe('rate limiting callable request fallback integration', () => {
  it('produces the global key for the API limiter when the request is callable', async () => {
    const limiter = createApiRateLimiter({ trustProxy: true });
    const req = createCallableRequest();
    const res = createStubResponse();

    await invokeLimiter(limiter, req, res);

    expect(req.rateLimit).toBeDefined();
    expect(req.rateLimit.key).toBe('global:unknown');
    expect(req.rateLimit.used).toBe(1);
    expect(res.getHeader('ratelimit-remaining')).toBeDefined();
  });

  it('maintains consistent fallback behaviour for the LLM limiter with callable requests', async () => {
    const limiter = createLlmRateLimiter({
      trustProxy: true,
      useApiKey: false,
    });
    const firstReq = createCallableRequest({
      url: '/llm-callable',
      originalUrl: '/llm-callable',
    });
    const firstRes = createStubResponse();
    await invokeLimiter(limiter, firstReq, firstRes);

    const secondReq = createCallableRequest({
      url: '/llm-callable',
      originalUrl: '/llm-callable',
    });
    const secondRes = createStubResponse();
    await invokeLimiter(limiter, secondReq, secondRes);

    expect(firstReq.rateLimit.key).toBe('global:unknown');
    expect(secondReq.rateLimit.key).toBe('global:unknown');
    expect(secondReq.rateLimit.used).toBe(2);
    expect(Number(secondRes.getHeader('ratelimit-remaining'))).toBeLessThan(
      Number(firstRes.getHeader('ratelimit-remaining'))
    );
  });

  it('integrates callable requests with the adaptive limiter and suspicious pattern tracking', async () => {
    const limiter = createAdaptiveRateLimiter({
      trustProxy: true,
      baseWindowMs: 1000,
      baseMaxRequests: 2,
      useApiKey: false,
    });

    const firstReq = createCallableRequest({
      url: '/adaptive-callable',
      originalUrl: '/adaptive-callable',
    });
    const firstRes = createStubResponse();
    await invokeLimiter(limiter, firstReq, firstRes);

    const secondReq = createCallableRequest({
      url: '/adaptive-callable',
      originalUrl: '/adaptive-callable',
    });
    const secondRes = createStubResponse();
    await invokeLimiter(limiter, secondReq, secondRes);

    expect(firstReq.rateLimit.key).toBe('global:unknown');
    expect(secondReq.rateLimit.key).toBe('global:unknown');
    expect(secondReq.rateLimit.used).toBe(2);
    expect(secondRes.getHeader('ratelimit-remaining')).toBeDefined();

    if (typeof limiter.destroy === 'function') {
      limiter.destroy();
    }
  });
});
