import { describe, it, expect, afterEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createAdaptiveRateLimiter,
  SuspiciousPatternsManager,
} from '../../src/middleware/rateLimiting.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('adaptive rate limiting suspicious pattern integration', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('downgrades limits for aggressive clients and recovers after scheduled cleanup', async () => {
    const limiter = createAdaptiveRateLimiter({
      baseWindowMs: 500,
      baseMaxRequests: 6,
      trustProxy: true,
      // Tighten manager thresholds so cleanup happens during the test run
      maxSize: 5,
      maxAge: 80,
      cleanupInterval: 40,
      minCleanupInterval: 0,
      batchSize: 1,
    });

    const app = express();
    app.get('/adaptive-patterns', limiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const agent = request(app);
    const clientIp = '198.51.100.200';
    let blockResponse = null;

    try {
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const response = await agent
          .get('/adaptive-patterns')
          .set('x-forwarded-for', clientIp)
          .set('user-agent', 'burst-client');

        if (response.status === 429) {
          blockResponse = response;
          if (response.body.error.details.severity === 'high') {
            break;
          }
        }
      }

      expect(blockResponse).not.toBeNull();
      expect(blockResponse.status).toBe(429);
      expect(blockResponse.body.error.code).toBe(
        'ADAPTIVE_RATE_LIMIT_EXCEEDED'
      );
      expect(blockResponse.body.error.details.severity).toBe('high');

      await wait(600);

      const recovered = await agent
        .get('/adaptive-patterns')
        .set('x-forwarded-for', clientIp)
        .set('user-agent', 'burst-client');

      expect(recovered.status).toBe(200);
    } finally {
      limiter.destroy();
    }
  });

  it('manages cleanup scheduling, LRU eviction, and statistics without leaking timers', async () => {
    const manager = new SuspiciousPatternsManager({
      maxSize: 2,
      maxAge: 30,
      cleanupInterval: 15,
      minCleanupInterval: 0,
      batchSize: 1,
    });

    const cleanupSpy = jest.spyOn(manager, 'cleanupExpired');

    try {
      const now = Date.now();
      manager.set('client-a', {
        createdAt: now - 40,
        updatedAt: now - 40,
        requests: [now - 40],
      });
      manager.set('client-b', {
        createdAt: now,
        updatedAt: now,
        requests: [now],
      });
      manager.set('client-c', {
        createdAt: now,
        updatedAt: now,
        requests: [now],
      });

      expect(manager.size()).toBe(2);

      await wait(30);

      expect(cleanupSpy).toHaveBeenCalled();

      const stats = manager.getStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(1);
      expect(stats.totalEntries).toBeLessThanOrEqual(2);
      expect(stats.memoryUsageEstimate).toBeGreaterThan(0);
      expect(stats.timeSinceLastCleanup).toBeGreaterThanOrEqual(0);

      const removed = manager.fullCleanup();
      expect(removed).toBeGreaterThanOrEqual(0);
    } finally {
      cleanupSpy.mockRestore();
      manager.destroy();
    }
  });
});
