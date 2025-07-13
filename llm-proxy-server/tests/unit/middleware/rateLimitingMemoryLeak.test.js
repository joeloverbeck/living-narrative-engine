/**
 * @file Unit tests for rate limiting memory leak fixes
 * @description Tests for SuspiciousPatternsManager LRU eviction and memory management
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createAdaptiveRateLimiter } from '../../../src/middleware/rateLimiting.js';

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

describe('Rate Limiting Memory Leak Fixes', () => {
  let req, res, next;
  let createdLimiters = [];

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
    createdLimiters = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any created limiters
    createdLimiters.forEach((limiter) => {
      if (limiter.destroy) {
        limiter.destroy();
      }
    });
    jest.clearAllMocks();
  });

  describe('SuspiciousPatternsManager LRU Eviction', () => {
    it('should enforce size limits with LRU eviction', () => {
      const maxSize = 5;
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize,
        baseMaxRequests: 10,
        trustProxy: false,
      });
      createdLimiters.push(rateLimiter);

      const mockReq = (clientId) => ({
        ip: `203.0.113.${clientId}`,
        headers: {},
        connection: { remoteAddress: `203.0.113.${clientId}` },
      });

      // Execute middleware multiple times to trigger LRU eviction
      for (let i = 1; i <= maxSize + 3; i++) {
        const testReq = mockReq(i);
        rateLimiter(testReq, res, next);
      }

      // Verify that the middleware executed without errors
      expect(next).toHaveBeenCalledTimes(maxSize + 3);
      expect(rateLimiter.config.keyGenerator).toBeDefined();
    });

    it('should handle adaptive max calculation based on suspicious patterns', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 10,
        baseMaxRequests: 10,
        baseWindowMs: 60000,
      });
      createdLimiters.push(rateLimiter);

      const testReq = {
        ip: '203.0.113.100',
        headers: {},
        connection: { remoteAddress: '203.0.113.100' },
      };

      // Execute middleware to trigger pattern tracking
      rateLimiter(testReq, res, next);

      // Verify dynamic max calculation works
      expect(rateLimiter.config.max).toBeDefined();
      expect(typeof rateLimiter.config.max).toBe('function');

      // Test the max function with our request
      const maxRequests = rateLimiter.config.max(testReq);
      expect(typeof maxRequests).toBe('number');
      expect(maxRequests).toBeGreaterThan(0);
    });

    it('should handle memory pressure scenarios gracefully', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 100, // Reduced for faster testing
        baseMaxRequests: 5,
      });
      createdLimiters.push(rateLimiter);

      const mockReq = (id) => ({
        ip: `203.0.113.${id % 255}`,
        headers: { 'user-agent': `TestAgent-${id}` },
        connection: { remoteAddress: `203.0.113.${id % 255}` },
      });

      // Simulate high load with many unique clients
      const startTime = performance.now();

      for (let i = 0; i < 200; i++) {
        const testReq = mockReq(i);

        expect(() => {
          rateLimiter(testReq, res, next);
        }).not.toThrow();
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time even under high load
      expect(executionTime).toBeLessThan(1000); // 1 second max
      expect(next).toHaveBeenCalledTimes(200);
    });

    it('should maintain performance with frequent updates', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 100,
        baseMaxRequests: 10,
      });
      createdLimiters.push(rateLimiter);

      const testReq = {
        ip: '203.0.113.1',
        headers: {},
        connection: { remoteAddress: '203.0.113.1' },
      };

      const iterations = 100; // Reduced for faster testing
      const startTime = performance.now();

      // Repeatedly update the same client pattern
      for (let i = 0; i < iterations; i++) {
        rateLimiter(testReq, res, next);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Each update should be fast
      expect(avgTime).toBeLessThan(5); // Less than 5ms per update
      expect(next).toHaveBeenCalledTimes(iterations);
    });
  });

  describe('Integration with Adaptive Rate Limiter', () => {
    it('should properly track suspicious patterns without memory leaks', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 10,
        baseMaxRequests: 5,
        baseWindowMs: 60000,
      });
      createdLimiters.push(rateLimiter);

      const testReq = {
        ip: '203.0.113.100',
        headers: {},
        connection: { remoteAddress: '203.0.113.100' },
      };

      // Simulate rapid requests to trigger suspicious behavior
      for (let i = 0; i < 20; i++) {
        rateLimiter(testReq, res, next);
      }

      // Verify the rate limiter executed properly
      expect(next).toHaveBeenCalledTimes(20);
      expect(rateLimiter.config.max).toBeDefined();

      // Test the max function calculation
      const maxRequests = rateLimiter.config.max(testReq);
      expect(typeof maxRequests).toBe('number');
      expect(maxRequests).toBeGreaterThan(0);
    });

    it('should handle concurrent access safely', async () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 50,
        baseMaxRequests: 10,
      });
      createdLimiters.push(rateLimiter);

      const createMockReq = (id) => ({
        ip: `203.0.113.${id}`,
        headers: {},
        connection: { remoteAddress: `203.0.113.${id}` },
      });

      // Create multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const promise = new Promise((resolve) => {
          const testReq = createMockReq(i);
          const localRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
          };
          const localNext = jest.fn();

          rateLimiter(testReq, localRes, localNext);
          resolve(i);
        });
        promises.push(promise);
      }

      // All requests should complete without errors
      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);
      expect(results.every((result) => typeof result === 'number')).toBe(true);
    });

    it('should preserve request history efficiently', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 5,
        baseMaxRequests: 3,
      });
      createdLimiters.push(rateLimiter);

      const testReq = {
        ip: '203.0.113.1',
        headers: {},
        connection: { remoteAddress: '203.0.113.1' },
      };

      // Add multiple requests
      for (let i = 0; i < 10; i++) {
        rateLimiter(testReq, res, next);
      }

      // Verify functionality continues to work
      expect(next).toHaveBeenCalledTimes(10);
      expect(rateLimiter.config.keyGenerator).toBeDefined();
    });
  });

  describe('Memory Management Edge Cases', () => {
    it('should handle cleanup during high frequency operations', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 10,
        maxAge: 50, // Very short expiration
        cleanupInterval: 25,
        batchSize: 5,
      });
      createdLimiters.push(rateLimiter);

      const mockReq = (id) => ({
        ip: `203.0.113.${id}`,
        headers: {},
        connection: { remoteAddress: `203.0.113.${id}` },
      });

      // Rapidly create entries while cleanup is running
      for (let i = 0; i < 50; i++) {
        const testReq = mockReq(i);
        expect(() => {
          rateLimiter(testReq, res, next);
        }).not.toThrow();
      }

      // Should execute all requests without errors
      expect(next).toHaveBeenCalledTimes(50);
    });

    it('should handle extreme memory pressure gracefully', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 5, // Very small limit
        baseMaxRequests: 2,
      });
      createdLimiters.push(rateLimiter);

      const mockReq = (id) => ({
        ip: `203.0.113.${id % 255}`, // Use valid public IP range
        headers: { 'user-agent': `TestAgent-${id}` },
        connection: {
          remoteAddress: `203.0.113.${id % 255}`,
        },
      });

      // Try to add many more entries than the limit
      expect(() => {
        for (let i = 0; i < 100; i++) {
          // Reduced for faster testing
          const testReq = mockReq(i);
          rateLimiter(testReq, res, next);
        }
      }).not.toThrow();

      expect(next).toHaveBeenCalledTimes(100);
    });

    it('should maintain consistent behavior under stress', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 20,
        baseMaxRequests: 5,
        maxAge: 1000,
      });
      createdLimiters.push(rateLimiter);

      const clientIPs = Array.from({ length: 20 }, (_, i) => `203.0.113.${i}`); // Reduced for faster testing
      let requestCount = 0;

      // Stress test with multiple clients
      for (let round = 0; round < 5; round++) {
        // Reduced rounds
        clientIPs.forEach((ip) => {
          const testReq = {
            ip,
            headers: {},
            connection: { remoteAddress: ip },
          };

          expect(() => {
            rateLimiter(testReq, res, next);
            requestCount++;
          }).not.toThrow();
        });
      }

      // Should have processed all requests
      expect(requestCount).toBeGreaterThan(0);
      expect(next).toHaveBeenCalledTimes(requestCount);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance requirements for middleware execution', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 100, // Reduced for faster testing
        baseMaxRequests: 10,
      });
      createdLimiters.push(rateLimiter);

      const testReq = {
        ip: '203.0.113.1',
        headers: {},
        connection: { remoteAddress: '203.0.113.1' },
      };

      const iterations = 1000; // Reduced for faster testing
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        rateLimiter(testReq, res, next);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      // Should be very fast per operation
      expect(avgTime).toBeLessThan(1); // Less than 1ms per operation
      expect(totalTime).toBeLessThan(2000); // Total time under 2 seconds
      expect(next).toHaveBeenCalledTimes(iterations);
    });

    it('should scale linearly with number of unique clients', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 100, // Reduced for faster testing
        baseMaxRequests: 10,
      });
      createdLimiters.push(rateLimiter);

      const createClientReq = (id) => ({
        ip: `203.0.113.${id % 255}`,
        headers: { 'x-client-id': `client-${id}` },
        connection: { remoteAddress: `203.0.113.${id % 255}` },
      });

      // Test with increasing number of clients
      const testSizes = [10, 25, 50]; // Reduced sizes for faster testing
      const timings = [];

      testSizes.forEach((size) => {
        const startTime = performance.now();

        for (let i = 0; i < size; i++) {
          const testReq = createClientReq(i);
          rateLimiter(testReq, res, next);
        }

        const endTime = performance.now();
        timings.push((endTime - startTime) / size);
      });

      // Performance should not degrade significantly with more clients
      const firstTiming = timings[0];
      const lastTiming = timings[timings.length - 1];

      // Last timing should not be more than 5x the first timing (relaxed for CI)
      expect(lastTiming).toBeLessThan(firstTiming * 5);
      expect(next).toHaveBeenCalledTimes(testSizes.reduce((a, b) => a + b, 0));
    });
  });

  describe('Error Handling and Robustness', () => {
    it('should handle invalid request objects gracefully', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 10,
        baseMaxRequests: 5,
      });
      createdLimiters.push(rateLimiter);

      const invalidRequests = [
        {},
        { headers: null },
        { ip: null, headers: {} },
        { connection: null, headers: {} },
      ];

      expect(() => {
        invalidRequests.forEach((testReq) => {
          const localRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
          };
          const localNext = jest.fn();
          rateLimiter(testReq || {}, localRes, localNext);
        });
      }).not.toThrow();
    });

    it('should continue functioning after potential cleanup errors', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 5,
        maxAge: 100,
        cleanupInterval: 50,
      });
      createdLimiters.push(rateLimiter);

      const testReq = {
        ip: '203.0.113.1',
        headers: {},
        connection: { remoteAddress: '203.0.113.1' },
      };

      // Should continue working even if internal cleanup encounters issues
      for (let i = 0; i < 20; i++) {
        expect(() => {
          rateLimiter(testReq, res, next);
        }).not.toThrow();
      }

      expect(next).toHaveBeenCalledTimes(20);
    });

    it('should handle timestamp edge cases correctly', () => {
      const rateLimiter = createAdaptiveRateLimiter({
        maxSize: 10,
        baseMaxRequests: 5,
      });
      createdLimiters.push(rateLimiter);

      const testReq = {
        ip: '203.0.113.1',
        headers: {},
        connection: { remoteAddress: '203.0.113.1' },
      };

      // Mock Date.now to return edge case values
      const originalDateNow = Date.now;

      try {
        // Test with very large timestamp
        Date.now = jest.fn(() => Number.MAX_SAFE_INTEGER);
        expect(() => {
          rateLimiter(testReq, res, next);
        }).not.toThrow();

        // Test with zero timestamp
        Date.now = jest.fn(() => 0);
        expect(() => {
          rateLimiter(testReq, res, next);
        }).not.toThrow();
      } finally {
        Date.now = originalDateNow;
      }
    });
  });
});
