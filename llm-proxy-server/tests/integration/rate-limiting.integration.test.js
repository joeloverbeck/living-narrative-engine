import { describe, test, beforeAll, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

let createApiRateLimiter;
let createLlmRateLimiter;
let createAdaptiveRateLimiter;
let RATE_LIMIT_GENERAL_MAX_REQUESTS;
let RATE_LIMIT_LLM_MAX_REQUESTS;
let originalNodeEnv;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Rate limiting middleware integration', () => {
  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    ({ createApiRateLimiter, createLlmRateLimiter, createAdaptiveRateLimiter } =
      await import('../../src/middleware/rateLimiting.js'));
    const constantsModule = await import('../../src/config/constants.js');
    RATE_LIMIT_GENERAL_MAX_REQUESTS =
      constantsModule.RATE_LIMIT_GENERAL_MAX_REQUESTS;
    RATE_LIMIT_LLM_MAX_REQUESTS = constantsModule.RATE_LIMIT_LLM_MAX_REQUESTS;
    process.env.NODE_ENV = originalNodeEnv;
    jest.setTimeout(60000);
  });

  test('general rate limiter enforces limits using direct identification when proxies are not trusted', async () => {
    const app = express();
    app.use(createApiRateLimiter({ trustProxy: false }));
    app.get('/general', (req, res) => {
      res.status(200).json({ ok: true });
    });

    const agent = request(app);
    const forwardedIp = '2606:4700:4700::1111';

    for (let i = 0; i < RATE_LIMIT_GENERAL_MAX_REQUESTS; i++) {
      const response = await agent
        .get('/general')
        .set('x-forwarded-for', forwardedIp)
        .set('x-real-ip', forwardedIp)
        .set('user-agent', 'rate-limit-client');
      expect(response.status).toBe(200);
    }

    const blocked = await agent
      .get('/general')
      .set('x-forwarded-for', forwardedIp)
      .set('x-real-ip', forwardedIp)
      .set('user-agent', 'rate-limit-client');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.body.error.details.clientId).toBe('direct');
    expect(blocked.body.error.details.retryAfter).toBeGreaterThan(0);
  });

  test('general rate limiter extracts proxy headers for client fingerprinting', async () => {
    const app = express();

    app.use(createApiRateLimiter({ trustProxy: true }));
    app.get('/fallback', (req, res) => {
      res.status(200).json({ ok: true });
    });

    const agent = request(app);

    for (let i = 0; i < RATE_LIMIT_GENERAL_MAX_REQUESTS; i++) {
      const response = await agent
        .get('/fallback')
        .set('user-agent', 'fallback-client');
      expect(response.status).toBe(200);
    }

    const blocked = await agent
      .get('/fallback')
      .set('user-agent', 'fallback-client');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.details.clientId).toBe('ip');
    expect(blocked.body.error.details.retryAfter).toBeGreaterThan(0);
  });

  test('llm rate limiter prioritises API key identity and reports rate limit metadata', async () => {
    const app = express();
    app.post('/llm', createLlmRateLimiter(), (req, res) => {
      res.status(200).json({ ok: true });
    });

    const agent = request(app);
    const apiKey = 'integration-test-api-key-1234567890';

    for (let i = 0; i < RATE_LIMIT_LLM_MAX_REQUESTS; i++) {
      const response = await agent
        .post('/llm')
        .set('x-api-key', apiKey)
        .send({ payload: 'ok' });
      expect(response.status).toBe(200);
    }

    const blocked = await agent
      .post('/llm')
      .set('x-api-key', apiKey)
      .send({ payload: 'ok' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('LLM_RATE_LIMIT_EXCEEDED');
    expect(blocked.body.error.details.clientType).toBe('api');
    expect(blocked.headers['ratelimit-limit']).toBeDefined();
  });

  test('adaptive rate limiter tracks suspicious behaviour and tightens limits progressively', async () => {
    const normalLimiter = createAdaptiveRateLimiter({
      baseWindowMs: 200,
      baseMaxRequests: 8,
      trustProxy: true,
      maxSize: 3,
      maxAge: 200,
      cleanupInterval: 60,
      minCleanupInterval: 10,
    });

    const normalApp = express();
    normalApp.get('/adaptive-normal', normalLimiter, (req, res) => {
      res.status(200).json({ ok: true });
    });

    const normalAgent = request(normalApp);
    const normalClient = '198.51.100.50';

    try {
      for (let i = 0; i < 8; i++) {
        const response = await normalAgent
          .get('/adaptive-normal')
          .set('x-forwarded-for', normalClient)
          .set('user-agent', 'steady-client');
        expect(response.status).toBe(200);
      }

      const normalBlock = await normalAgent
        .get('/adaptive-normal')
        .set('x-forwarded-for', normalClient)
        .set('user-agent', 'steady-client');
      expect(normalBlock.status).toBe(429);
      expect(normalBlock.body.error.details.severity).toBe('normal');
    } finally {
      normalLimiter.destroy();
    }

    const limiter = createAdaptiveRateLimiter({
      baseWindowMs: 100,
      baseMaxRequests: 4,
      trustProxy: true,
      maxSize: 2,
      maxAge: 1000,
      cleanupInterval: 40,
      minCleanupInterval: 5,
    });

    const app = express();
    app.get('/adaptive', limiter, (req, res) => {
      res.status(200).json({ ok: true });
    });

    const agent = request(app);
    const clientIp = '198.51.100.10';

    try {
      const sendBurst = async () => {
        let blockResponse = null;

        for (let i = 0; i < 6; i++) {
          const response = await agent
            .get('/adaptive')
            .set('x-forwarded-for', clientIp)
            .set('user-agent', 'suspicious-client');

          if (i === 0) {
            expect(response.status).toBe(200);
          }

          if (response.status === 429) {
            blockResponse = response;
            break;
          }
        }

        if (!blockResponse) {
          blockResponse = await agent
            .get('/adaptive')
            .set('x-forwarded-for', clientIp)
            .set('user-agent', 'suspicious-client');
        }

        expect(blockResponse.status).toBe(429);
        return blockResponse;
      };

      let lastBlock = await sendBurst();
      expect(lastBlock.body.error.details.severity).toBe('normal');

      for (let i = 0; i < 3; i++) {
        await delay(120);
        lastBlock = await sendBurst();
      }

      expect(lastBlock.body.error.details.severity).toBe('high');
      await delay(150);

      const firstAllowed = await agent
        .get('/adaptive')
        .set('x-forwarded-for', clientIp)
        .set('user-agent', 'suspicious-client');
      expect(firstAllowed.status).toBe(200);

      const escalatedBlock = await agent
        .get('/adaptive')
        .set('x-forwarded-for', clientIp)
        .set('user-agent', 'suspicious-client');
      expect(escalatedBlock.status).toBe(429);
      expect(escalatedBlock.body.error.details.severity).toBe('high');

      const newClientResponse = await agent
        .get('/adaptive')
        .set('x-forwarded-for', '203.0.113.21')
        .set('user-agent', 'new-client');
      expect(newClientResponse.status).toBe(200);

      const anotherClientResponse = await agent
        .get('/adaptive')
        .set('x-forwarded-for', '203.0.113.22')
        .set('user-agent', 'another-client');
      expect(anotherClientResponse.status).toBe(200);

      await delay(100);
    } finally {
      limiter.destroy();
    }
  });
});
