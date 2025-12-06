import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

const buildRateLimitedApp = (createApiRateLimiter, createLlmRateLimiter) => {
  const app = express();
  app.disable('x-powered-by');

  app.get(
    '/general',
    createApiRateLimiter({ trustProxy: true }),
    (req, res) => {
      res.json({
        limit: req.rateLimit.limit,
        remaining: req.rateLimit.remaining,
        resetTime: req.rateLimit.resetTime,
      });
    }
  );

  app.get('/llm', createLlmRateLimiter({ trustProxy: true }), (req, res) => {
    res.json({
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining,
      resetTime: req.rateLimit.resetTime,
    });
  });

  return app;
};

describe('Rate limiting environment configuration coverage', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  it('applies elevated thresholds in non-production environments', async () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();

    const [{ createApiRateLimiter, createLlmRateLimiter }, constants] =
      await Promise.all([
        import('../../src/middleware/rateLimiting.js'),
        import('../../src/config/constants.js'),
      ]);

    const app = buildRateLimitedApp(createApiRateLimiter, createLlmRateLimiter);
    const agent = request(app);

    const generalResponse = await agent.get('/general');
    expect(generalResponse.status).toBe(200);
    expect(generalResponse.body.limit).toBe(
      constants.RATE_LIMIT_GENERAL_MAX_REQUESTS
    );
    expect(generalResponse.body.limit).toBe(2000);
    expect(generalResponse.body.remaining).toBe(
      constants.RATE_LIMIT_GENERAL_MAX_REQUESTS - 1
    );

    const llmResponse = await agent.get('/llm');
    expect(llmResponse.status).toBe(200);
    expect(llmResponse.body.limit).toBe(constants.RATE_LIMIT_LLM_MAX_REQUESTS);
    expect(llmResponse.body.limit).toBe(100);
    expect(llmResponse.body.remaining).toBe(
      constants.RATE_LIMIT_LLM_MAX_REQUESTS - 1
    );
  });

  it('enforces production thresholds with strict limits', async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();

    const [{ createApiRateLimiter, createLlmRateLimiter }, constants] =
      await Promise.all([
        import('../../src/middleware/rateLimiting.js'),
        import('../../src/config/constants.js'),
      ]);

    expect(constants.RATE_LIMIT_GENERAL_MAX_REQUESTS).toBe(100);
    expect(constants.RATE_LIMIT_LLM_MAX_REQUESTS).toBe(10);

    const app = buildRateLimitedApp(createApiRateLimiter, createLlmRateLimiter);
    const agent = request(app);

    const initialGeneral = await agent.get('/general');
    expect(initialGeneral.status).toBe(200);
    expect(initialGeneral.body.limit).toBe(100);

    for (let i = 0; i < constants.RATE_LIMIT_GENERAL_MAX_REQUESTS - 1; i += 1) {
      const response = await agent.get('/general');
      expect(response.status).toBe(200);
    }

    const blockedGeneral = await agent.get('/general');
    expect(blockedGeneral.status).toBe(429);
    expect(blockedGeneral.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED',
          details: expect.objectContaining({
            retryAfter: constants.RATE_LIMIT_GENERAL_WINDOW_MS / 1000,
          }),
        }),
      })
    );

    const initialLlm = await agent.get('/llm');
    expect(initialLlm.status).toBe(200);
    expect(initialLlm.body.limit).toBe(10);

    for (let i = 0; i < constants.RATE_LIMIT_LLM_MAX_REQUESTS - 1; i += 1) {
      const response = await agent.get('/llm');
      expect(response.status).toBe(200);
    }

    const blockedLlm = await agent.get('/llm');
    expect(blockedLlm.status).toBe(429);
    expect(blockedLlm.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'LLM_RATE_LIMIT_EXCEEDED',
          details: expect.objectContaining({
            retryAfter: constants.RATE_LIMIT_LLM_WINDOW_MS / 1000,
          }),
        }),
      })
    );
  });
});
