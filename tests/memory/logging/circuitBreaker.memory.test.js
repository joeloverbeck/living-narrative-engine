/**
 * @file Memory usage tests for CircuitBreaker
 * @see src/logging/circuitBreaker.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import CircuitBreaker, {
  CircuitBreakerState,
} from '../../../src/logging/circuitBreaker.js';

describe('CircuitBreaker Memory Usage', () => {
  let circuitBreaker;

  beforeEach(() => {
    jest.useFakeTimers();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 1000,
      halfOpenMaxCalls: 2,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('memory management', () => {
    it('should efficiently manage memory with frequent state changes', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many state changes
      for (let cycle = 0; cycle < 100; cycle++) {
        // Reset to clean state
        circuitBreaker.reset();

        // Force state changes
        circuitBreaker.forceOpen();
        circuitBreaker.forceClosed();

        // Get stats (which creates objects)
        const stats = circuitBreaker.getStats();
        expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should not grow significantly (under 1MB increase)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });
});
