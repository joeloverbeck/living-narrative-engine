import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createAdaptiveRateLimiter,
  createApiRateLimiter,
  createAuthRateLimiter,
  createLlmRateLimiter,
  SuspiciousPatternsManager,
} from '../../src/middleware/rateLimiting.js';

const buildProbeApp = (limiter, mutate) => {
  const app = express();

  if (mutate) {
    app.use((req, res, next) => {
      mutate(req, res);
      next();
    });
  }

  app.use(limiter);
  app.get('/probe', (req, res) => {
    res.json({
      key: req.rateLimit?.key ?? null,
      clientId: req.rateLimit?.key ? req.rateLimit.key.split(':')[0] : null,
    });
  });

  return app;
};

describe('rate limiting fallback resilience integration', () => {
  it('handles default suspicious pattern lifecycle and cleanup fallbacks', () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });

    const manager = new SuspiciousPatternsManager();

    try {
      manager.set('ghost-client');
      manager.scheduleCleanup();
      manager.scheduleCleanup();

      const beforeCleanupStats = manager.getStats();
      expect(beforeCleanupStats.totalRequestsTracked).toBe(0);

      jest.runOnlyPendingTimers();

      manager.set('non-array-client', {
        requests: 'not-an-array',
        updatedAt: Date.now(),
      });

      const cleaned = manager.cleanupExpired();
      expect(cleaned).toBeGreaterThanOrEqual(0);

      const stats = manager.getStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(1);
      expect(stats.totalRequestsTracked).toBeGreaterThanOrEqual(0);
      expect(manager.estimateMemoryUsage()).toBeGreaterThan(0);

      manager.destroy();
      manager.destroy();
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  it('derives client keys for extreme IPv4 inputs using safe fallbacks', async () => {
    const scenarios = [
      {
        name: 'array-header',
        mutate(req) {
          req.headers['x-forwarded-for'] = '';
          req.headers['x-real-ip'] = ['203.0.113.10', '198.51.100.5'];
        },
        assert(response) {
          expect(response.body.clientId).toBe('ip');
          expect(response.body.key).toContain('203.0.113.10');
        },
      },
      {
        name: 'empty-forwarded-for',
        mutate(req) {
          req.headers['x-forwarded-for'] = '';
        },
        assert(response) {
          expect(response.body.clientId).toBe('ip');
          expect(response.body.key).toMatch(/127\.0\.0\.1|::1/);
        },
      },
      {
        name: 'invalid-octets',
        mutate(req) {
          req.headers['x-forwarded-for'] = '256.0.0.1';
        },
        assert(response) {
          expect(response.body.key).toMatch(/127\.0\.0\.1|::1/);
        },
      },
      {
        name: 'private-10',
        mutate(req) {
          req.headers['x-forwarded-for'] = '10.0.0.5';
        },
        assert(response) {
          expect(response.body.key).toMatch(/127\.0\.0\.1|::1/);
        },
      },
      {
        name: 'private-172',
        mutate(req) {
          req.headers['x-forwarded-for'] = '172.16.0.1';
        },
        assert(response) {
          expect(response.body.key).toMatch(/127\.0\.0\.1|::1/);
        },
      },
      {
        name: 'private-192',
        mutate(req) {
          req.headers['x-forwarded-for'] = '192.168.0.1';
        },
        assert(response) {
          expect(response.body.key).toMatch(/127\.0\.0\.1|::1/);
        },
      },
      {
        name: 'loopback-127',
        mutate(req) {
          req.headers['x-forwarded-for'] = '127.0.0.1';
        },
        assert(response) {
          expect(response.body.key).toMatch(/127\.0\.0\.1|::1/);
        },
      },
      {
        name: 'linklocal-169',
        mutate(req) {
          req.headers['x-forwarded-for'] = '169.254.0.1';
        },
        assert(response) {
          expect(response.body.key).toMatch(/127\.0\.0\.1|::1/);
        },
      },
      {
        name: 'multicast-224',
        mutate(req) {
          req.headers['x-forwarded-for'] = '224.0.0.1';
        },
        assert(response) {
          expect(response.body.key).toMatch(/127\.0\.0\.1|::1/);
        },
      },
    ];

    for (const scenario of scenarios) {
      const app = buildProbeApp(createApiRateLimiter(), (req) => {
        const headerScenario = req.headers['x-scenario'];
        delete req.headers['x-scenario'];
        if (headerScenario === scenario.name) {
          scenario.mutate(req);
        }
      });

      const response = await request(app)
        .get('/probe')
        .set('x-scenario', scenario.name);

      expect(response.status).toBe(200);
      scenario.assert(response);
    }
  });

  it('supports default limiter options across API, LLM, auth, and adaptive flows', async () => {
    const adaptiveLimiter = createAdaptiveRateLimiter();
    const app = express();

    app.get('/adaptive', adaptiveLimiter, (req, res) => {
      res.json({ key: req.rateLimit?.key ?? null });
    });

    app.get('/llm', createLlmRateLimiter(), (req, res) => {
      res.json({ key: req.rateLimit?.key ?? null });
    });

    app.post('/auth', createAuthRateLimiter(), (req, res) => {
      res.json({ key: req.rateLimit?.key ?? null });
    });

    try {
      const adaptiveResponse = await request(app)
        .get('/adaptive')
        .set('X-Forwarded-For', '198.51.100.25');
      expect(adaptiveResponse.status).toBe(200);
      expect(adaptiveResponse.body.key).toContain('198.51.100.25');

      const llmWithoutKey = await request(app).get('/llm');
      expect(llmWithoutKey.status).toBe(200);
      expect(llmWithoutKey.body.key).toMatch(/127\.0\.0\.1|::1/);

      const llmWithKey = await request(app)
        .get('/llm')
        .set('X-API-Key', 'integration-key-1234567890');
      expect(llmWithKey.status).toBe(200);
      expect(llmWithKey.body.key.startsWith('api:')).toBe(true);

      const authResponse = await request(app).post('/auth');
      expect(authResponse.status).toBe(200);
      expect(authResponse.body.key).toMatch(/127\.0\.0\.1|::1/);
    } finally {
      adaptiveLimiter.destroy();
    }
  });
});
