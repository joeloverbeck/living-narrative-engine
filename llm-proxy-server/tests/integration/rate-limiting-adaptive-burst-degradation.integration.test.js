import { describe, it, afterEach, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createAdaptiveRateLimiter } from '../../src/middleware/rateLimiting.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('adaptive rate limiting burst degradation integration', () => {
  let limiter;

  afterEach(() => {
    if (limiter && typeof limiter.destroy === 'function') {
      limiter.destroy();
    }
  });

  it('reduces the allowed capacity after repeated bursts from the same client', async () => {
    limiter = createAdaptiveRateLimiter({
      baseWindowMs: 200,
      baseMaxRequests: 10,
      trustProxy: false,
      // Tighten cleanup behaviour so the test finishes quickly without leaking timers
      maxAge: 1_000,
      cleanupInterval: 500,
      minCleanupInterval: 0,
      batchSize: 10,
    });

    const app = express();
    app.get('/adaptive-burst', limiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const agent = request(app);

    const sendBurst = async (count) => {
      for (let i = 0; i < count; i += 1) {
        const response = await agent.get('/adaptive-burst');
        expect(response.status).toBe(200);
      }
    };

    // Two full bursts from the same client drive the suspicious score above the
    // adaptive threshold (score > 3) without mocking any collaborators.
    await sendBurst(10);
    await wait(250);

    const burstTwoFirst = await agent.get('/adaptive-burst');
    expect(burstTwoFirst.status).toBe(200);

    const burstTwoSecond = await agent.get('/adaptive-burst');
    expect(burstTwoSecond.status).toBe(429);
    expect(burstTwoSecond.body).toMatchObject({
      error: {
        code: 'ADAPTIVE_RATE_LIMIT_EXCEEDED',
        details: { rateLimitType: 'adaptive', severity: 'high' },
      },
    });

    await wait(250);

    const allowed = await agent.get('/adaptive-burst');
    expect(allowed.status).toBe(200);

    const throttled = await agent.get('/adaptive-burst');
    expect(throttled.status).toBe(429);
    expect(throttled.body).toMatchObject({
      error: {
        code: 'ADAPTIVE_RATE_LIMIT_EXCEEDED',
        details: { rateLimitType: 'adaptive', severity: 'high' },
      },
    });

    // Express-rate-limit emits modern RateLimit headers when throttling. The
    // adaptive limiter should surface a near-zero remaining value once the
    // suspicious score forces the single-request budget.
    const remainingHeader = throttled.headers['ratelimit-remaining'];
    expect(remainingHeader === '0' || remainingHeader === '1').toBe(true);
  });
});
