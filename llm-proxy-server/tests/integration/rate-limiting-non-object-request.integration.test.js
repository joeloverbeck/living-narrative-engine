/**
 * @file rate-limiting-non-object-request.integration.test.js
 * @description Ensures the API rate limiter gracefully handles callable request shells
 *              that are not plain objects by falling back to the global identifier while
 *              still advancing the limiter counters without throwing.
 */

import { describe, expect, it } from '@jest/globals';

import { createApiRateLimiter } from '../../src/middleware/rateLimiting.js';

describe('rate limiting middleware resilience with non-object requests', () => {
  it('falls back to the global key when invoked with a callable request shell', async () => {
    const limiter = createApiRateLimiter();

    const req = () => {};
    Object.assign(req, {
      headers: undefined,
      method: 'GET',
      path: '/resilience-check',
      ip: undefined,
      connection: {},
    });

    const res = {
      headers: {},
      setHeader() {},
      status() {
        return this;
      },
      json() {},
      on() {},
    };

    let nextCalled = false;
    await new Promise((resolve, reject) => {
      limiter(req, res, (err) => {
        if (err) {
          reject(err);
          return;
        }
        nextCalled = true;
        resolve();
      });
    });

    expect(nextCalled).toBe(true);
    expect(req.rateLimit).toBeDefined();
    expect(req.rateLimit.key).toBe('global:unknown');
    expect(req.rateLimit.used).toBe(1);
  });
});
