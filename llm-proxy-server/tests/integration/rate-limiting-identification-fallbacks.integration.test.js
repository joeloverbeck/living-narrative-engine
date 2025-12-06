import { beforeAll, afterAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let createApiRateLimiter;
let RATE_LIMIT_GENERAL_MAX_REQUESTS;
let originalNodeEnv;

/**
 * Builds an Express app that strips direct client identification metadata before
 * invoking the API rate limiter. This forces the middleware to exercise its
 * identification fallbacks rather than relying on connection information.
 *
 * @param {(agent: request.SuperTest<request.Test>) => Promise<request.Response>} requestExecutor
 *   Function that executes requests against the constructed app.
 * @returns {Promise<request.Response>} The final response returned by the executor.
 */
async function withAnonymousClientApp(requestExecutor) {
  const app = express();
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(req, 'connection', {
      configurable: true,
      value: { remoteAddress: undefined },
    });
    next();
  });
  app.use(createApiRateLimiter({ trustProxy: true }));
  app.get('/limited', (_req, res) => res.status(200).json({ ok: true }));

  const agent = request(app);
  return requestExecutor(agent);
}

describe('Rate limiting identification fallbacks integration', () => {
  beforeAll(async () => {
    jest.resetModules();
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    ({ createApiRateLimiter } = await import(
      '../../src/middleware/rateLimiting.js'
    ));
    ({ RATE_LIMIT_GENERAL_MAX_REQUESTS } = await import(
      '../../src/config/constants.js'
    ));
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('hashes the user agent when proxy metadata is unavailable', async () => {
    const finalResponse = await withAnonymousClientApp(async (agent) => {
      let response;
      for (let i = 0; i < RATE_LIMIT_GENERAL_MAX_REQUESTS + 1; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        response = await agent
          .get('/limited')
          .set('User-Agent', 'ua-fallback-client/1.0');
        if (response.status === 429) {
          break;
        }
      }
      return response;
    });

    expect(finalResponse.status).toBe(429);
    expect(finalResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(finalResponse.body.error.details.clientId).toBe('ua');
  });

  it('falls back to a global identifier when no headers remain', async () => {
    const finalResponse = await withAnonymousClientApp(async (agent) => {
      let response;
      for (let i = 0; i < RATE_LIMIT_GENERAL_MAX_REQUESTS + 1; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        response = await agent.get('/limited').unset('User-Agent');
        if (response.status === 429) {
          break;
        }
      }
      return response;
    });

    expect(finalResponse.status).toBe(429);
    expect(finalResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(finalResponse.body.error.details.clientId).toBe('global');
  });
});
