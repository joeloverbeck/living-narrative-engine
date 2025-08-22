/**
 * @file Performance benchmark tests for CircuitBreaker
 * @see src/logging/circuitBreaker.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';
import CircuitBreaker, {
  CircuitBreakerState,
} from '../../../src/logging/circuitBreaker.js';

describe('CircuitBreaker Performance', () => {
  let circuitBreaker;
  let performanceTestBed;

  beforeEach(() => {
    performanceTestBed = createPerformanceTestBed();
    jest.useFakeTimers();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 1000,
      halfOpenMaxCalls: 2,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    performanceTestBed?.cleanup();
  });

  describe('timing calculations', () => {
    it('should calculate timeSinceLastFailure correctly', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Record failure
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();

      // Advance time
      jest.advanceTimersByTime(500);

      const stats = circuitBreaker.getStats();
      expect(stats.timeSinceLastFailure).toBeGreaterThanOrEqual(500);
    });

    it('should handle rapid state transitions with timing accuracy', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const successFn = jest.fn().mockResolvedValue('success');

      // Quickly fail to open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      }
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for timeout and execute success
      jest.advanceTimersByTime(1000);
      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

      // Verify the state transitions completed successfully
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitBreakerState.CLOSED);
      expect(stats.successCount).toBe(0); // Reset when transitioning to closed
      expect(stats.failureCount).toBe(0); // Should be reset after transition to closed
    });

    it('should maintain timing accuracy under concurrent load', async () => {
      const mockFn = jest
        .fn()
        .mockImplementation((value) => Promise.resolve(value));

      const startTime = performance.now();

      // Execute concurrent operations
      const promises = Array.from({ length: 100 }, (_, i) =>
        circuitBreaker.execute(() => mockFn(i))
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify all operations completed successfully
      expect(results).toHaveLength(100);
      expect(mockFn).toHaveBeenCalledTimes(100);

      // Performance assertion - concurrent operations should be efficient
      expect(duration).toBeLessThan(50); // Should complete in under 50ms

      // Verify timing statistics remain accurate
      const stats = circuitBreaker.getStats();
      expect(stats.successCount).toBe(100);
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('performance benchmarks', () => {
    it('should handle high-frequency execute calls efficiently', async () => {
      const fastFn = jest.fn().mockResolvedValue('result');
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await circuitBreaker.execute(fastFn);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTime = duration / iterations;

      // Performance assertions
      expect(duration).toBeLessThan(200); // Total time under 200ms
      expect(avgTime).toBeLessThan(0.2); // Average under 0.2ms per call
      expect(fastFn).toHaveBeenCalledTimes(iterations);
    });
  });
});
