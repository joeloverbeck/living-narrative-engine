import { describe, test, beforeEach, expect, jest } from '@jest/globals';
import {
  createApiRateLimiter,
  createLlmRateLimiter,
  createAuthRateLimiter,
} from '../../../src/middleware/rateLimiting.js';
import {
  RATE_LIMIT_GENERAL_WINDOW_MS,
  RATE_LIMIT_GENERAL_MAX_REQUESTS,
  RATE_LIMIT_LLM_WINDOW_MS,
  RATE_LIMIT_LLM_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX_REQUESTS,
} from '../../../src/config/constants.js';

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn((config) => {
    // Return a middleware function that captures the config
    const middleware = (req, res, next) => {
      middleware.config = config;
      next();
    };
    middleware.config = config;
    return middleware;
  });
});

describe('Rate Limiting Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      ip: '192.168.1.1',
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('createApiRateLimiter', () => {
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
          message: 'Too many requests from this IP, please try again later.',
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
          message: 'Too many requests from this IP, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: 15 * 60,
          },
        },
      });
    });
  });

  describe('createLlmRateLimiter', () => {
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

      expect(key).toBe('test-api-key');
    });

    test('keyGenerator falls back to IP when no API key', () => {
      const rateLimiter = createLlmRateLimiter();
      const keyGenerator = rateLimiter.config.keyGenerator;

      const key = keyGenerator(req);

      expect(key).toBe('192.168.1.1');
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
          },
        },
      });
    });
  });

  describe('createAuthRateLimiter', () => {
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
  });

  describe('Integration tests', () => {
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
  });
});
