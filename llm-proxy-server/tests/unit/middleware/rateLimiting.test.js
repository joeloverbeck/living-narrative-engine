import { describe, test, beforeEach, expect, jest } from '@jest/globals';
import {
  createApiRateLimiter,
  createLlmRateLimiter,
  createAuthRateLimiter,
  createAdaptiveRateLimiter,
} from '../../../src/middleware/rateLimiting.js';
import {
  RATE_LIMIT_GENERAL_WINDOW_MS,
  RATE_LIMIT_GENERAL_MAX_REQUESTS,
  RATE_LIMIT_LLM_WINDOW_MS,
  RATE_LIMIT_LLM_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX_REQUESTS,
} from '../../../src/config/constants.js';

// Mock express-rate-limit to capture configuration and test internal logic
jest.mock('express-rate-limit', () => {
  return jest.fn((config) => {
    const middleware = (req, res, next) => {
      middleware.config = config;

      // Test the keyGenerator and handler functions
      if (config.keyGenerator) {
        middleware.generatedKey = config.keyGenerator(req);
      }
      if (config.handler) {
        middleware.handlerCalled = true;
        config.handler(req, res);
      }
      if (typeof config.max === 'function') {
        middleware.dynamicMax = config.max(req);
      }

      next();
    };
    middleware.config = config;
    return middleware;
  });
});

describe('Rate Limiting Middleware - Comprehensive Tests', () => {
  let req, res, next;
  let createdAdaptiveRateLimiters = [];

  beforeEach(() => {
    req = {
      ip: '203.0.113.1', // Use public IP for testing
      headers: {},
      connection: { remoteAddress: '203.0.113.1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    createdAdaptiveRateLimiters = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any adaptive rate limiters to prevent memory leaks
    createdAdaptiveRateLimiters.forEach((limiter) => {
      if (limiter && typeof limiter.destroy === 'function') {
        limiter.destroy();
      }
    });
    createdAdaptiveRateLimiters = [];
  });

  describe('createApiRateLimiter - Core Functionality', () => {
    test('creates rate limiter with correct configuration', () => {
      const rateLimiter = createApiRateLimiter();

      expect(rateLimiter.config).toMatchObject({
        windowMs: RATE_LIMIT_GENERAL_WINDOW_MS, // 15 minutes
        max: RATE_LIMIT_GENERAL_MAX_REQUESTS,
        standardHeaders: true,
        legacyHeaders: false,
      });
    });

    test('includes correct error message configuration', () => {
      const rateLimiter = createApiRateLimiter();

      expect(rateLimiter.config.message).toEqual({
        error: {
          message:
            'Too many requests from this client, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: 15 * 60,
          },
        },
      });
    });

    test('handler sends proper 429 response', () => {
      const rateLimiter = createApiRateLimiter();
      const handler = rateLimiter.config.handler;

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message:
            'Too many requests from this client, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: 15 * 60,
            clientId: expect.any(String),
          },
        },
      });
    });

    test('uses correct key generation', () => {
      req.headers['x-forwarded-for'] = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });
  });

  describe('createLlmRateLimiter - Core Functionality', () => {
    test('creates rate limiter with stricter configuration', () => {
      const rateLimiter = createLlmRateLimiter();

      expect(rateLimiter.config).toMatchObject({
        windowMs: RATE_LIMIT_LLM_WINDOW_MS, // 1 minute
        max: RATE_LIMIT_LLM_MAX_REQUESTS,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
      });
    });

    test('includes correct LLM-specific error message', () => {
      const rateLimiter = createLlmRateLimiter();

      expect(rateLimiter.config.message).toEqual({
        error: {
          message: 'Too many LLM requests, please try again later.',
          code: 'LLM_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: 60,
          },
        },
      });
    });

    test('keyGenerator uses API key when available', () => {
      const rateLimiter = createLlmRateLimiter();
      const keyGenerator = rateLimiter.config.keyGenerator;

      req.headers['x-api-key'] = 'test-api-key';
      const key = keyGenerator(req);

      expect(key).toBe('api:test-api...');
    });

    test('keyGenerator falls back to IP when no API key', () => {
      const rateLimiter = createLlmRateLimiter();
      const keyGenerator = rateLimiter.config.keyGenerator;

      req.ip = '192.168.1.1';
      const key = keyGenerator(req);

      expect(key).toBe('ip:192.168.1.1');
    });

    test('handler sends proper 429 response for LLM limits', () => {
      const rateLimiter = createLlmRateLimiter();
      const handler = rateLimiter.config.handler;

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Too many LLM requests, please try again later.',
          code: 'LLM_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: 60,
            clientType: expect.any(String),
            rateLimitType: 'llm',
          },
        },
      });
    });

    test('uses API key when available', () => {
      req.headers['x-api-key'] = 'test-key-123';
      req.headers['x-forwarded-for'] = '203.0.113.1';

      const rateLimiter = createLlmRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('api:test-key...');
    });
  });

  describe('createAuthRateLimiter - Core Functionality', () => {
    test('creates rate limiter with very strict configuration', () => {
      const rateLimiter = createAuthRateLimiter();

      expect(rateLimiter.config).toMatchObject({
        windowMs: RATE_LIMIT_GENERAL_WINDOW_MS, // 15 minutes
        max: RATE_LIMIT_AUTH_MAX_REQUESTS,
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false,
      });
    });

    test('includes correct auth-specific error message', () => {
      const rateLimiter = createAuthRateLimiter();

      expect(rateLimiter.config.message).toEqual({
        error: {
          message: 'Too many authentication attempts, please try again later.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: 15 * 60,
          },
        },
      });
    });

    test('skipSuccessfulRequests is enabled for auth limiter', () => {
      const rateLimiter = createAuthRateLimiter();

      expect(rateLimiter.config.skipSuccessfulRequests).toBe(true);
    });

    test('ignores API key', () => {
      req.headers['x-api-key'] = 'test-key-123';
      req.headers['x-forwarded-for'] = '203.0.113.1';

      const rateLimiter = createAuthRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });
  });

  describe('extractRealClientIP - Advanced IP Extraction', () => {
    test('extracts IP from X-Forwarded-For header with single IP', () => {
      req.headers['x-forwarded-for'] = '203.0.113.50';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.50');
    });

    test('extracts first IP from X-Forwarded-For header with multiple IPs', () => {
      req.headers['x-forwarded-for'] = '203.0.113.100, 10.0.0.1, 192.168.1.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.100');
    });

    test('rejects private IP in X-Forwarded-For and falls back to next header', () => {
      req.headers['x-forwarded-for'] = '192.168.1.100, 10.0.0.1';
      req.headers['x-real-ip'] = '203.0.113.75';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.75');
    });

    test('ignores blank entries in proxy headers before falling back', () => {
      req.headers['x-forwarded-for'] = '   , 203.0.113.90';
      req.headers['x-real-ip'] = '203.0.113.90';
      req.ip = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.90');
    });

    test('tests all proxy header fallbacks in order', () => {
      req.headers['x-forwarded-for'] = '192.168.1.1'; // Private, should be rejected
      req.headers['x-real-ip'] = '10.0.0.1'; // Private, should be rejected
      req.headers['x-client-ip'] = '172.16.0.1'; // Private, should be rejected
      req.headers['x-forwarded'] = '203.0.113.200';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.200');
    });

    test('tests forwarded-for and forwarded headers', () => {
      req.headers['x-forwarded-for'] = '127.0.0.1'; // Loopback, should be rejected
      req.headers['forwarded-for'] = '203.0.113.150';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.150');
    });

    test('handles array values in proxy headers', () => {
      req.headers['x-forwarded-for'] = '10.0.0.1'; // Private
      req.headers['x-real-ip'] = ['203.0.113.175', '203.0.113.180']; // Array

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.175');
    });

    test('falls back to req.ip when no valid proxy headers', () => {
      req.headers['x-forwarded-for'] = '192.168.1.1'; // Private
      req.ip = '203.0.113.225';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.225');
    });

    test('falls back to connection.remoteAddress when req.ip unavailable', () => {
      req.headers['x-forwarded-for'] = '127.0.0.1'; // Loopback
      req.ip = undefined;
      req.connection.remoteAddress = '203.0.113.250';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.250');
    });

    test('handles unknown IP fallback', () => {
      req.headers['x-forwarded-for'] = '169.254.1.1'; // Link-local
      req.ip = undefined;
      req.connection.remoteAddress = undefined;

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('global:unknown');
    });

    test('returns global key when request object is not provided', () => {
      const rateLimiter = createApiRateLimiter();
      const generatedKey = rateLimiter.config.keyGenerator(undefined);

      expect(generatedKey).toBe('global:unknown');
    });
  });

  describe('isValidPublicIP - IP Validation', () => {
    test('rejects null and undefined IPs', () => {
      req.headers['x-forwarded-for'] = null;
      req.ip = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('accepts public IPv4 addresses from proxy headers', () => {
      req.headers['x-forwarded-for'] = '8.8.8.8'; // Google's public DNS

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:8.8.8.8');
    });

    test('rejects malformed IPv4 addresses', () => {
      req.headers['x-forwarded-for'] = '256.1.1.1'; // Invalid octet
      req.ip = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('rejects all private IP ranges - 10.x.x.x', () => {
      req.headers['x-forwarded-for'] = '10.255.255.255';
      req.ip = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('rejects private IP ranges - 172.16-31.x.x', () => {
      const testIPs = ['172.16.0.1', '172.20.1.1', '172.31.255.255'];

      testIPs.forEach((ip) => {
        req.headers['x-forwarded-for'] = ip;
        req.ip = '203.0.113.1';

        const rateLimiter = createApiRateLimiter();
        rateLimiter(req, res, next);

        expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
      });
    });

    test('rejects private IP ranges - 192.168.x.x', () => {
      req.headers['x-forwarded-for'] = '192.168.255.255';
      req.ip = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('rejects loopback IPs - 127.x.x.x', () => {
      req.headers['x-forwarded-for'] = '127.255.255.255';
      req.ip = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('rejects link-local IPs - 169.254.x.x', () => {
      req.headers['x-forwarded-for'] = '169.254.169.254';
      req.ip = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('rejects multicast IPs - 224+', () => {
      req.headers['x-forwarded-for'] = '239.255.255.255';
      req.ip = '203.0.113.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('accepts public IPv4 addresses', () => {
      const publicIPs = ['8.8.8.8', '1.1.1.1', '93.184.216.34'];

      publicIPs.forEach((ip) => {
        req.headers['x-forwarded-for'] = ip;

        const rateLimiter = createApiRateLimiter();
        rateLimiter(req, res, next);

        expect(rateLimiter.generatedKey).toBe(`ip:${ip}`);
      });
    });
  });

  describe('generateRateLimitKey - Key Generation Logic', () => {
    test('prioritizes API key when useApiKey is true', () => {
      req.headers['x-api-key'] = 'sk-test1234567890abcdef';
      req.headers['x-forwarded-for'] = '203.0.113.1';

      const rateLimiter = createLlmRateLimiter({ useApiKey: true });
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('api:sk-test1...');
    });

    test('handles short API keys', () => {
      req.headers['x-api-key'] = '1234567';

      const rateLimiter = createLlmRateLimiter({ useApiKey: true });
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('api:1234567...');
    });

    test('ignores empty API key', () => {
      req.headers['x-api-key'] = '';
      req.headers['x-forwarded-for'] = '203.0.113.1';

      const rateLimiter = createLlmRateLimiter({ useApiKey: true });
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('ignores non-string API key', () => {
      req.headers['x-api-key'] = 12345;
      req.headers['x-forwarded-for'] = '203.0.113.1';

      const rateLimiter = createLlmRateLimiter({ useApiKey: true });
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.1');
    });

    test('falls back to direct IP when trustProxy is false', () => {
      req.headers['x-forwarded-for'] = '203.0.113.50';
      req.ip = '203.0.113.100';

      const rateLimiter = createApiRateLimiter({ trustProxy: false });
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('direct:203.0.113.100');
    });

    test('falls back to User-Agent hash when no IP available', () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (Test Browser)';
      req.ip = undefined;
      req.connection.remoteAddress = undefined;

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toMatch(/^ua:[a-z0-9]+$/);
    });

    test('falls back to global key when nothing available', () => {
      req.ip = undefined;
      req.connection.remoteAddress = undefined;
      req.headers = {};

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('global:unknown');
    });

    test('handles invalid request objects gracefully', () => {
      const rateLimiter = createApiRateLimiter();

      rateLimiter(null, res, next);

      expect(rateLimiter.generatedKey).toBe('global:unknown');
    });

    test('accepts valid public IPv6 addresses', () => {
      req.headers['x-forwarded-for'] = '[2606:4700:4700::1111]';
      req.ip = '198.51.100.1';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:[2606:4700:4700::1111]');
    });

    test('rejects malformed IP addresses', () => {
      req.headers['x-forwarded-for'] = 'not-an-ip';
      req.ip = '198.51.100.50';
      req.connection.remoteAddress = '198.51.100.50';

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('ip:198.51.100.50');
    });
  });

  describe('hashString - User-Agent Hashing', () => {
    test('generates consistent hash for same input', () => {
      req.headers['user-agent'] = 'Consistent Test String';
      req.ip = undefined;
      req.connection.remoteAddress = undefined;

      const rateLimiter1 = createApiRateLimiter();
      rateLimiter1(req, res, next);
      const key1 = rateLimiter1.generatedKey;

      const rateLimiter2 = createApiRateLimiter();
      rateLimiter2(req, res, next);
      const key2 = rateLimiter2.generatedKey;

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^ua:[a-z0-9]+$/);
    });

    test('generates different hashes for different inputs', () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Chrome/91.0.4472.124',
      ];

      const keys = [];
      userAgents.forEach((ua) => {
        req.headers['user-agent'] = ua;
        req.ip = undefined;
        req.connection.remoteAddress = undefined;

        const rateLimiter = createApiRateLimiter();
        rateLimiter(req, res, next);
        keys.push(rateLimiter.generatedKey);
      });

      // All keys should be different
      expect(new Set(keys).size).toBe(keys.length);
    });

    test('handles empty string', () => {
      req.headers['user-agent'] = '';
      req.ip = undefined;
      req.connection.remoteAddress = undefined;

      const rateLimiter = createApiRateLimiter();
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('global:unknown');
    });
  });

  describe('createAdaptiveRateLimiter - Adaptive Rate Limiting', () => {
    test('creates adaptive rate limiter with default configuration', () => {
      const rateLimiter = createAdaptiveRateLimiter();
      createdAdaptiveRateLimiters.push(rateLimiter);
      rateLimiter(req, res, next);

      expect(rateLimiter.config).toMatchObject({
        windowMs: expect.any(Number),
        standardHeaders: true,
        legacyHeaders: false,
      });
    });

    test('creates adaptive rate limiter with custom options', () => {
      const options = {
        baseWindowMs: 30000,
        baseMaxRequests: 50,
        trustProxy: false,
        useApiKey: true,
      };

      const rateLimiter = createAdaptiveRateLimiter(options);
      createdAdaptiveRateLimiters.push(rateLimiter);
      rateLimiter(req, res, next);

      expect(rateLimiter.config.windowMs).toBe(30000);
    });

    test('max function returns base limit for new client', () => {
      req.headers['x-forwarded-for'] = '203.0.113.100';

      const rateLimiter = createAdaptiveRateLimiter();
      createdAdaptiveRateLimiters.push(rateLimiter);
      rateLimiter(req, res, next);

      expect(rateLimiter.dynamicMax).toBe(2000); // Default base max requests (test environment value)
    });

    test('keyGenerator tracks request patterns', () => {
      req.headers['x-forwarded-for'] = '203.0.113.200';

      const rateLimiter = createAdaptiveRateLimiter();
      createdAdaptiveRateLimiters.push(rateLimiter);

      // Make multiple requests to build pattern
      for (let i = 0; i < 5; i++) {
        rateLimiter(req, res, next);
      }

      expect(rateLimiter.generatedKey).toBe('ip:203.0.113.200');
    });

    test('suspicious score increases with high request frequency', () => {
      req.headers['x-forwarded-for'] = '203.0.113.300';

      const rateLimiter = createAdaptiveRateLimiter({ baseMaxRequests: 10 });
      createdAdaptiveRateLimiters.push(rateLimiter);

      // Simulate many requests in short time to trigger suspicious behavior
      const originalDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // Make requests that exceed 80% of base limit in short time
      for (let i = 0; i < 9; i++) {
        rateLimiter(req, res, next);
        mockTime += 100; // Small time increment
      }

      // The max should now be reduced due to suspicious activity
      rateLimiter(req, res, next);
      expect(rateLimiter.dynamicMax).toBeLessThanOrEqual(10);

      Date.now = originalDateNow;
    });

    test('handler includes adaptive-specific response format', () => {
      req.headers['x-forwarded-for'] = '203.0.113.600';

      const rateLimiter = createAdaptiveRateLimiter();
      createdAdaptiveRateLimiters.push(rateLimiter);
      rateLimiter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Rate limit exceeded. Please slow down your requests.',
          code: 'ADAPTIVE_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: expect.any(Number),
            rateLimitType: 'adaptive',
            severity: expect.stringMatching(/^(high|normal)$/),
          },
        },
      });
    });

    test('uses API key for identification when enabled', () => {
      req.headers['x-api-key'] = 'adaptive-test-key';
      req.headers['x-forwarded-for'] = '203.0.113.900';

      const rateLimiter = createAdaptiveRateLimiter({ useApiKey: true });
      createdAdaptiveRateLimiters.push(rateLimiter);
      rateLimiter(req, res, next);

      expect(rateLimiter.generatedKey).toBe('api:adaptive...');
    });

    test('minimum limit of 1 is enforced for highly suspicious clients', () => {
      req.headers['x-forwarded-for'] = '203.0.113.999';

      const rateLimiter = createAdaptiveRateLimiter({ baseMaxRequests: 5 });
      createdAdaptiveRateLimiters.push(rateLimiter);

      const originalDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // Build up very high suspicious score
      for (let i = 0; i < 10; i++) {
        rateLimiter(req, res, next);
        mockTime += 10;
      }

      // Max should be at least 1
      rateLimiter(req, res, next);
      expect(rateLimiter.dynamicMax).toBeGreaterThanOrEqual(1);

      Date.now = originalDateNow;
    });
  });

  describe('Integration Tests', () => {
    test('all rate limiters return valid Express middleware functions', () => {
      const apiLimiter = createApiRateLimiter();
      const llmLimiter = createLlmRateLimiter();
      const authLimiter = createAuthRateLimiter();

      // All should be functions (middleware)
      expect(typeof apiLimiter).toBe('function');
      expect(typeof llmLimiter).toBe('function');
      expect(typeof authLimiter).toBe('function');

      // All should work as middleware
      apiLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      llmLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);

      authLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(3);
    });

    test('all rate limiters execute handler correctly', () => {
      const limiters = [
        createApiRateLimiter(),
        createLlmRateLimiter(),
        createAuthRateLimiter(),
      ];

      limiters.forEach((limiter) => {
        limiter(req, res, next);
        expect(limiter.handlerCalled).toBe(true);
        expect(res.status).toHaveBeenCalledWith(429);
      });
    });
  });
});
