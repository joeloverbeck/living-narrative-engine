/**
 * @file rate-limiting-maintenance.integration.test.js
 * @description Integration suite extending coverage of rate limiting utilities, including
 *               authentication limiting, key generation fallbacks, IPv6 handling, and the
 *               suspicious patterns manager lifecycle.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

let createAuthRateLimiter;
let createApiRateLimiter;
let createLlmRateLimiter;
let createAdaptiveRateLimiter;
let SuspiciousPatternsManager;

const originalNodeEnv = process.env.NODE_ENV;

/**
 * Builds a lightweight response mock compatible with express-rate-limit needs.
 * @returns {object} response stub
 */
function createStubResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    headersSent: false,
    body: null,
    writableEnded: true,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    header(name, value) {
      this.setHeader(name, value);
      return this;
    },
    get(name) {
      return headers.get(name.toLowerCase());
    },
    on() {
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = 'production';
  ({
    createAuthRateLimiter,
    createApiRateLimiter,
    createLlmRateLimiter,
    createAdaptiveRateLimiter,
    SuspiciousPatternsManager,
  } = await import('../../src/middleware/rateLimiting.js'));
  process.env.NODE_ENV = originalNodeEnv;
});

describe('rate limiting maintenance and lifecycle integration', () => {
  describe('authentication limiter interactions', () => {
    it('skips successful requests, exposes metadata, and falls back to user-agent derived keys', async () => {
      const limiter = createAuthRateLimiter({ trustProxy: false });
      const app = express();

      let attempts = 0;
      app.use(express.json());
      app.use((req, res, next) => limiter(req, res, next));
      app.post('/auth', (req, res) => {
        attempts += 1;
        if (attempts % 5 === 0) {
          return res.status(200).json({ ok: true });
        }
        return res.status(401).json({ error: 'unauthorized' });
      });

      const agent = request(app);

      for (let i = 0; i < 4; i += 1) {
        const response = await agent.post('/auth').send({ attempt: i });
        expect(response.status).toBe(401);
      }

      const success = await agent.post('/auth').send({ attempt: 'success' });
      expect(success.status).toBe(200);

      const fifthFailure = await agent
        .post('/auth')
        .send({ attempt: 'fifth-failure' });
      expect(fifthFailure.status).toBe(401);

      const blocked = await agent.post('/auth').send({ attempt: 'blocked' });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
      expect(blocked.body.error.details.rateLimitType).toBe('auth');
      expect(blocked.body.error.details.retryAfter).toBeGreaterThan(0);

      const stubReq = {
        headers: { 'user-agent': 'integration-suite/1.0' },
        method: 'POST',
        connection: {},
        ip: undefined,
        get(header) {
          return this.headers[header.toLowerCase()];
        },
      };
      const stubRes = createStubResponse();
      await limiter(stubReq, stubRes, () => {});
      expect(stubReq.rateLimit.key.startsWith('ua:')).toBe(true);
      await limiter.resetKey(stubReq.rateLimit.key);

      const emptyReq = {
        headers: {},
        method: 'POST',
        connection: {},
        ip: undefined,
        get() {
          return undefined;
        },
      };
      const emptyRes = createStubResponse();
      await limiter(emptyReq, emptyRes, () => {});
      expect(emptyReq.rateLimit.key).toBe('global:unknown');
      await limiter.resetKey(emptyReq.rateLimit.key);
    });

    it('derives keys from IPv6 aware proxy headers and trusted fallbacks', async () => {
      const apiLimiter = createApiRateLimiter({ trustProxy: true });

      const ipv6Req = {
        headers: { 'x-forwarded-for': '[2606:4700:4700::1111]' },
        method: 'GET',
        connection: {},
        ip: undefined,
        get(header) {
          return this.headers[header.toLowerCase()];
        },
      };
      const ipv6Res = createStubResponse();
      await apiLimiter(ipv6Req, ipv6Res, () => {});
      expect(ipv6Req.rateLimit.key.startsWith('ip:[')).toBe(true);
      expect(ipv6Req.rateLimit.key).toContain('2606:4700:4700::1111');
      await apiLimiter.resetKey(ipv6Req.rateLimit.key);

      const fallbackReq = {
        headers: {
          'x-forwarded-for': '10.0.0.1',
          'x-real-ip': '198.51.100.23',
        },
        method: 'GET',
        connection: {},
        ip: undefined,
        get(header) {
          return this.headers[header.toLowerCase()];
        },
      };
      const fallbackRes = createStubResponse();
      await apiLimiter(fallbackReq, fallbackRes, () => {});
      expect(fallbackReq.rateLimit.key).toBe('ip:198.51.100.23');
      await apiLimiter.resetKey(fallbackReq.rateLimit.key);

      const globalReq = {
        headers: {},
        method: 'GET',
        connection: {},
        ip: undefined,
        get() {
          return undefined;
        },
      };
      const globalRes = createStubResponse();
      await apiLimiter(globalReq, globalRes, () => {});
      expect(globalReq.rateLimit.key).toBe('global:unknown');
    });
  });

  describe('advanced limiter behaviours', () => {
    it('general limiter surfaces UA-derived client identifiers when limits are exceeded', async () => {
      const apiLimiter = createApiRateLimiter({ trustProxy: true });
      const baseHeaders = { 'user-agent': 'maintenance-suite/2.0' };

      for (let i = 0; i < 100; i += 1) {
        const req = {
          headers: { ...baseHeaders },
          method: 'GET',
          connection: {},
          ip: undefined,
          get(header) {
            return this.headers[header.toLowerCase()];
          },
        };
        const res = createStubResponse();
        let nextCalled = false;
        await apiLimiter(req, res, () => {
          nextCalled = true;
        });
        expect(nextCalled).toBe(true);
      }

      const blockingReq = {
        headers: { ...baseHeaders },
        method: 'GET',
        connection: {},
        ip: undefined,
        get(header) {
          return this.headers[header.toLowerCase()];
        },
      };
      const blockingRes = createStubResponse();
      await apiLimiter(blockingReq, blockingRes, () => {});
      expect(blockingRes.statusCode).toBe(429);
      expect(blockingRes.body.error.details.clientId).toBe('ua');
      expect(blockingRes.body.error.details.retryAfter).toBeGreaterThan(0);
      await apiLimiter.resetKey(blockingReq.rateLimit.key);
    });

    it('llm limiter prioritizes API key identification and reports metadata on block', async () => {
      const llmLimiter = createLlmRateLimiter({ trustProxy: false });

      const headers = { 'x-api-key': 'integration-api-key-987' };
      for (let i = 0; i < 10; i += 1) {
        const req = {
          headers: { ...headers },
          method: 'POST',
          body: { prompt: 'hello' },
          connection: {},
          ip: undefined,
          get(header) {
            return this.headers[header.toLowerCase()];
          },
        };
        const res = createStubResponse();
        let nextCalled = false;
        await llmLimiter(req, res, () => {
          nextCalled = true;
        });
        expect(nextCalled).toBe(true);
      }

      const blockingReq = {
        headers: { ...headers },
        method: 'POST',
        body: { prompt: 'blocked' },
        connection: {},
        ip: undefined,
        get(header) {
          return this.headers[header.toLowerCase()];
        },
      };
      const blockingRes = createStubResponse();
      await llmLimiter(blockingReq, blockingRes, () => {});
      expect(blockingRes.statusCode).toBe(429);
      expect(blockingRes.body.error.details.clientType).toBe('api');
      expect(blockingRes.body.error.details.rateLimitType).toBe('llm');
      await llmLimiter.resetKey(blockingReq.rateLimit.key);
    });

    it('adaptive limiter escalates severity for repeated bursts from the same client', async () => {
      const adaptiveLimiter = createAdaptiveRateLimiter({
        baseWindowMs: 200,
        baseMaxRequests: 4,
        trustProxy: true,
        useApiKey: false,
        cleanupInterval: 40,
        minCleanupInterval: 10,
      });

      const req = {
        headers: { 'x-forwarded-for': '198.51.100.77' },
        method: 'GET',
        connection: {},
        ip: undefined,
        get(header) {
          return this.headers[header.toLowerCase()];
        },
      };

      for (let i = 0; i < 4; i += 1) {
        const res = createStubResponse();
        let nextCalled = false;
        await adaptiveLimiter(req, res, () => {
          nextCalled = true;
        });
        expect(nextCalled).toBe(true);
      }

      const firstBlockRes = createStubResponse();
      await adaptiveLimiter(req, firstBlockRes, () => {});
      expect(firstBlockRes.statusCode).toBe(429);
      expect(firstBlockRes.body.error.details.severity).toBe('normal');

      let lastBlockRes = firstBlockRes;
      for (let i = 0; i < 4; i += 1) {
        const res = createStubResponse();
        await adaptiveLimiter(req, res, () => {});
        lastBlockRes = res;
      }

      expect(lastBlockRes.statusCode).toBe(429);
      expect(lastBlockRes.body.error.details.severity).toBe('high');
      await adaptiveLimiter.resetKey(req.rateLimit.key);
      adaptiveLimiter.destroy();
    });
  });

  describe('SuspiciousPatternsManager lifecycle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('performs LRU eviction, scheduled cleanup, and destruction without leaking timers', async () => {
      const manager = new SuspiciousPatternsManager({
        maxSize: 2,
        maxAge: 100,
        cleanupInterval: 50,
        batchSize: 1,
        minCleanupInterval: 10,
      });

      expect(manager.get(undefined)).toBeUndefined();
      manager.set('', { requests: [Date.now()] });
      manager.delete(undefined);
      expect(manager.size()).toBe(0);

      jest.setSystemTime(new Date('2024-01-01T00:00:10.000Z'));
      manager.set('client-one', {
        requests: [Date.now()],
        createdAt: Date.now() - 5,
      });
      jest.setSystemTime(new Date('2024-01-01T00:00:11.000Z'));
      manager.set('client-two', {
        requests: [Date.now()],
        createdAt: Date.now() - 5,
      });
      expect(manager.size()).toBe(2);

      jest.setSystemTime(new Date('2024-01-01T00:00:12.000Z'));
      manager.set('client-three', {
        requests: [Date.now()],
        createdAt: Date.now() - 5,
      });
      expect(manager.size()).toBe(2);
      expect(manager.get('client-one')).toBeUndefined();

      jest.setSystemTime(new Date('2024-01-01T00:01:12.000Z'));
      const patterns = manager.patterns;
      const clientTwo = patterns.get('client-two');
      const clientThree = patterns.get('client-three');
      clientTwo.updatedAt = Date.now() - 500;
      clientThree.requests.push(Date.now() - 500);
      clientThree.updatedAt = Date.now() - 20;

      manager.scheduleCleanup();
      manager.scheduleCleanup();
      await jest.runOnlyPendingTimersAsync();

      expect(manager.size()).toBe(1);
      const remainingKeys = Array.from(patterns.keys());
      expect(remainingKeys).toHaveLength(1);

      jest.advanceTimersByTime(50);

      const stats = manager.getStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.memoryUsageEstimate).toBeGreaterThanOrEqual(0);
      expect(stats.timeSinceLastCleanup).toBeGreaterThanOrEqual(0);

      jest.setSystemTime(new Date('2024-01-01T00:02:12.000Z'));
      const cleaned = manager.fullCleanup();
      expect(cleaned).toBeGreaterThanOrEqual(0);

      manager.clear();
      expect(manager.size()).toBe(0);

      manager.scheduleCleanup();
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      manager.destroy();
      expect(manager.size()).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
