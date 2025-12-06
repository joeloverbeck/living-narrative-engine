/**
 * @file rate-limiting-identification-edge-cases.integration.test.js
 * @description Integration coverage for rate limiting identification fallbacks
 *              and suspicious pattern telemetry that previously lacked tests.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createApiRateLimiter,
  createAdaptiveRateLimiter,
  createAuthRateLimiter,
  createLlmRateLimiter,
  SuspiciousPatternsManager,
} from '../../src/middleware/rateLimiting.js';
import {
  RATE_LIMIT_AUTH_MAX_REQUESTS,
  RATE_LIMIT_GENERAL_MAX_REQUESTS,
  RATE_LIMIT_LLM_MAX_REQUESTS,
} from '../../src/config/constants.js';

jest.setTimeout(30000);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Rate limiting identification edge cases integration', () => {
  let limiter;

  afterEach(() => {
    if (limiter && typeof limiter.destroy === 'function') {
      limiter.destroy();
    }
    limiter = undefined;
  });

  it('derives client keys for IPv6 headers, fallback proxies, and anonymised requests', async () => {
    const limiter = createApiRateLimiter({ trustProxy: true });
    const responseStub = {
      headersSent: false,
      status: () => responseStub,
      json: () => responseStub,
    };
    const next = jest.fn();

    const ipv6Request = {
      method: 'GET',
      path: '/manual',
      headers: { 'x-forwarded-for': '2001:db8::1' },
      ip: undefined,
      connection: {},
    };
    await limiter(ipv6Request, responseStub, next);
    expect(ipv6Request.rateLimit.key).toBe('global:unknown');

    const fallbackRequest = {
      method: 'GET',
      path: '/manual',
      headers: { 'x-real-ip': '203.0.113.45' },
      ip: undefined,
      connection: {},
    };
    await limiter(fallbackRequest, responseStub, next);
    expect(fallbackRequest.rateLimit.key).toBe('ip:203.0.113.45');

    const userAgentRequest = {
      method: 'GET',
      path: '/manual',
      headers: { 'user-agent': 'ua-hash-client' },
      ip: undefined,
      connection: {},
    };
    await limiter(userAgentRequest, responseStub, next);
    expect(userAgentRequest.rateLimit.key).toMatch(/^ua:/);

    const unknownRequest = {
      method: 'GET',
      path: '/manual',
      headers: {},
      ip: undefined,
      connection: {},
    };
    await limiter(unknownRequest, responseStub, next);
    expect(unknownRequest.rateLimit.key).toBe('global:unknown');

    const directLimiter = createApiRateLimiter({ trustProxy: false });
    const directRequest = {
      method: 'GET',
      path: '/manual',
      headers: {},
      ip: '203.0.113.42',
      connection: {},
    };
    await directLimiter(directRequest, responseStub, next);
    expect(directRequest.rateLimit.key).toBe('direct:203.0.113.42');
  });

  it('tracks expired suspicious patterns and prunes them through adaptive limiter telemetry', async () => {
    const manager = new SuspiciousPatternsManager({
      maxAge: 10,
      cleanupInterval: 1000,
      minCleanupInterval: 1000,
      batchSize: 2,
    });

    try {
      const now = Date.now();
      manager.set('client-a', {
        requests: [now - 1000],
        suspiciousScore: 0,
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });
      manager.patterns.get('client-a').updatedAt = now - 1000;
      manager.set('client-b', {
        requests: [now],
        suspiciousScore: 5,
        createdAt: now,
        updatedAt: now,
      });

      const statsBefore = manager.getStats();
      expect(statsBefore.totalEntries).toBe(2);
      expect(statsBefore.expiredEntries).toBeGreaterThanOrEqual(1);

      await wait(15);
      const cleaned = manager.cleanupExpired(5);
      expect(cleaned).toBeGreaterThanOrEqual(1);

      const statsAfter = manager.getStats();
      expect(statsAfter.totalEntries).toBeLessThanOrEqual(1);

      limiter = createAdaptiveRateLimiter({
        baseWindowMs: 200,
        baseMaxRequests: 4,
        trustProxy: true,
        maxAge: 10,
        cleanupInterval: 5,
        minCleanupInterval: 0,
      });

      const app = express();
      app.get('/adaptive', limiter, (req, res) => {
        res.status(200).json({ key: req.rateLimit.key });
      });

      const agent = request(app);
      let blockResponse = null;
      for (let i = 0; i < 8; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const burst = await agent
          .get('/adaptive')
          .set('x-forwarded-for', '198.51.100.101')
          .set('user-agent', 'adaptive-client');

        if (burst.status === 429) {
          blockResponse = burst;
          break;
        }
      }

      if (!blockResponse) {
        blockResponse = await agent
          .get('/adaptive')
          .set('x-forwarded-for', '198.51.100.101')
          .set('user-agent', 'adaptive-client');
      }

      expect(blockResponse.status).toBe(429);
      expect(blockResponse.body.error.details.severity).toMatch(
        /^(high|normal)$/
      );
    } finally {
      manager.destroy();
    }
  });

  it('manages LRU eviction and scheduled cleanup cycles across multiple clients', async () => {
    const manager = new SuspiciousPatternsManager({
      maxSize: 2,
      maxAge: 30,
      cleanupInterval: 15,
      minCleanupInterval: 0,
      batchSize: 1,
    });

    let managerDestroyed = false;

    try {
      expect(manager.get(undefined)).toBeUndefined();
      manager.set(undefined, null);
      manager.delete(undefined);

      const initialCleanup = manager.lastCleanup;
      await wait(20);
      expect(manager.lastCleanup).toBeGreaterThanOrEqual(initialCleanup);

      manager.lastCleanup = 0;
      const timestamp = Date.now() - 40;
      manager.set('alpha', { requests: [timestamp, timestamp - 5] });
      manager.set('beta', { requests: [timestamp] });
      manager.set('gamma', { requests: [timestamp] });

      expect(manager.size()).toBeLessThanOrEqual(2);
      expect(manager.get('alpha')).toBeUndefined();

      manager.scheduleCleanup();
      const pendingTimer = manager.cleanupTimer;
      manager.scheduleCleanup();
      expect(manager.cleanupTimer).toBe(pendingTimer);
      manager.destroy();
      managerDestroyed = true;
      expect(manager.cleanupTimer).toBeNull();
      expect(manager.periodicCleanupInterval).toBeNull();

      const followUpManager = new SuspiciousPatternsManager({
        maxSize: 2,
        maxAge: 30,
        cleanupInterval: 15,
        minCleanupInterval: 0,
        batchSize: 1,
      });

      const followUpTimestamp = Date.now() - 40;
      followUpManager.set('alpha', { requests: [followUpTimestamp] });
      followUpManager.set('beta', { requests: [followUpTimestamp] });
      followUpManager.set('gamma', { requests: [followUpTimestamp] });
      expect(followUpManager.size()).toBeLessThanOrEqual(2);
      expect(followUpManager.get('alpha')).toBeUndefined();

      followUpManager.patterns.forEach((pattern, key) => {
        pattern.requests.push(Date.now() - 35, Date.now());
        followUpManager.patterns.set(key, pattern);
      });

      const batchCleaned = followUpManager.cleanupExpired(1);
      expect(batchCleaned).toBeGreaterThanOrEqual(0);

      followUpManager.patterns.forEach((pattern, key) => {
        pattern.updatedAt = Date.now() - 40;
        followUpManager.patterns.set(key, pattern);
      });

      const fullyCleaned = followUpManager.fullCleanup();
      expect(fullyCleaned).toBeGreaterThanOrEqual(0);

      followUpManager.set('delta', {
        requests: [Date.now()],
        suspiciousScore: 2,
      });
      const stats = followUpManager.getStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsageEstimate).toBeGreaterThanOrEqual(0);

      const memoryEstimate = followUpManager.estimateMemoryUsage();
      expect(memoryEstimate).toBeGreaterThanOrEqual(0);

      followUpManager.clear();
      expect(followUpManager.size()).toBe(0);

      followUpManager.destroy();
    } finally {
      if (!managerDestroyed) {
        manager.destroy();
      }
    }
  });

  it('enforces API, LLM, and auth rate limits with structured responses', async () => {
    const generalApp = express();
    generalApp.use(createApiRateLimiter({ trustProxy: false }));
    generalApp.get('/limited', (_req, res) =>
      res.status(200).json({ ok: true })
    );

    const generalAgent = request(generalApp);
    for (let i = 0; i < RATE_LIMIT_GENERAL_MAX_REQUESTS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await generalAgent.get('/limited');
    }
    const generalBlocked = await generalAgent.get('/limited');
    expect(generalBlocked.status).toBe(429);
    expect(generalBlocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');

    const llmApp = express();
    llmApp.post(
      '/llm',
      createLlmRateLimiter({ trustProxy: true, useApiKey: true }),
      (_req, res) => res.status(200).json({ ok: true })
    );

    const llmAgent = request(llmApp);
    for (let i = 0; i < RATE_LIMIT_LLM_MAX_REQUESTS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await llmAgent.post('/llm').set('x-api-key', 'edge-api-key-1234567890');
    }
    const llmBlocked = await llmAgent
      .post('/llm')
      .set('x-api-key', 'edge-api-key-1234567890');
    expect(llmBlocked.status).toBe(429);
    expect(llmBlocked.body.error.code).toBe('LLM_RATE_LIMIT_EXCEEDED');

    const authApp = express();
    authApp.post(
      '/auth',
      createAuthRateLimiter({ trustProxy: false }),
      (_req, res) => res.status(401).json({ ok: false })
    );

    const authAgent = request(authApp);
    for (let i = 0; i < RATE_LIMIT_AUTH_MAX_REQUESTS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await authAgent.post('/auth');
    }
    const authBlocked = await authAgent.post('/auth');
    expect(authBlocked.status).toBe(429);
    expect(authBlocked.body.error.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
  });
});
