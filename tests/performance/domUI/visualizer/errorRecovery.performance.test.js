/**
 * @file Performance tests for ErrorRecovery.js
 * @see src/domUI/visualizer/ErrorRecovery.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ErrorRecovery } from '../../../../src/domUI/visualizer/ErrorRecovery.js';

describe('ErrorRecovery - Performance Tests', () => {
  let errorRecovery;
  let mockLogger;
  let mockEventDispatcher;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };
  });

  afterEach(() => {
    if (errorRecovery && !errorRecovery.isDisposed()) {
      errorRecovery.dispose();
    }
  });

  describe('Retry Delay Performance', () => {
    it('should calculate exponential backoff delay within performance thresholds', () => {
      // Mock Math.random() to eliminate non-deterministic timing variations
      // Jitter calculation uses Math.random() * 0.3, so 0.15 gives consistent 15% jitter
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.15);

      const iterations = 1000;

      errorRecovery = new ErrorRecovery(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          maxRetryAttempts: 3,
          retryDelayMs: 500,
          useExponentialBackoff: true,
        }
      );

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Test delay calculation for operation with no previous attempts
        const delay = errorRecovery.getRetryDelay(`test-operation-${i}`);
        // With mocked Math.random(0.15), delay should be: 500 * (1 + 0.15 * 0.3) = 522.5 -> floor = 522
        expect(delay).toBe(522);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance expectation: should average less than 0.5ms per calculation
      // With mocked randomness, this should be much more consistent
      expect(avgTime).toBeLessThan(0.5);

      // Restore Math.random()
      mockRandom.mockRestore();
    });

    it('should calculate linear backoff delay within performance thresholds', () => {
      const iterations = 1000;

      errorRecovery = new ErrorRecovery(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          maxRetryAttempts: 3,
          retryDelayMs: 1000,
          useExponentialBackoff: false,
        }
      );

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        expect(errorRecovery.getRetryDelay('test-operation')).toBe(1000);

        // Even with multiple attempts, should remain constant
        errorRecovery.clearRetryAttempts('test-operation');
        errorRecovery._retryAttempts =
          errorRecovery._retryAttempts || new Map();
        errorRecovery._retryAttempts.set('test-operation', 2);

        expect(errorRecovery.getRetryDelay('test-operation')).toBe(1000);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance expectation: should average less than 2ms per iteration
      // Note: Each iteration includes 2x getRetryDelay() calls, 2x Jest assertions,
      // clearRetryAttempts(), Map creation/access, and Map.set() operations
      // Linear backoff itself is O(1), but test overhead requires realistic threshold
      expect(avgTime).toBeLessThan(2.0);
    });

    it('should handle default configuration delay calculation within performance thresholds', () => {
      // Mock Math.random() for consistent timing measurements
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.15);

      const iterations = 1000;

      // Create instance outside timing loop to test method performance, not object lifecycle
      errorRecovery = new ErrorRecovery({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Default uses exponential backoff with jitter
        const delay = errorRecovery.getRetryDelay('test-operation');
        expect(delay).toBe(1045); // 1000 * (1 + 0.15 * 0.3) = 1045, Math.floor() = 1045
        expect(errorRecovery.canRetry('test-operation')).toBe(true);

        // Clear retry attempts to reset state for next iteration
        errorRecovery.clearRetryAttempts('test-operation');
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance expectation: should average less than 1ms per calculation
      // Note: Includes exponential backoff with jitter calculation and multiple assertions
      // With mocked randomness, this should be much more consistent
      expect(avgTime).toBeLessThan(1.0);

      // Restore Math.random()
      mockRandom.mockRestore();
    });

    it('should validate jitter behavior works correctly with real randomness', () => {
      // This test validates the jitter functionality without mocking Math.random()
      // to ensure the production code's randomness logic is working correctly

      errorRecovery = new ErrorRecovery(
        {
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        },
        {
          maxRetryAttempts: 3,
          retryDelayMs: 1000,
          useExponentialBackoff: true,
        }
      );

      const delays = [];
      const iterations = 100; // Smaller number for randomness validation

      // Collect delays to validate jitter distribution
      for (let i = 0; i < iterations; i++) {
        const delay = errorRecovery.getRetryDelay('test-operation-jitter');
        delays.push(delay);
        errorRecovery.clearRetryAttempts('test-operation-jitter');
      }

      // Validate jitter ranges: should be >= base and < base * 1.3
      const baseDelay = 1000;
      const maxJitteredDelay = baseDelay * 1.3;

      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(baseDelay);
        expect(delay).toBeLessThan(maxJitteredDelay);
      });

      // Validate we actually get different values (not all the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(10); // Should have variation with real randomness

      // Validate average is within expected range (base + ~15% on average)
      const avgDelay =
        delays.reduce((sum, delay) => sum + delay, 0) / delays.length;
      expect(avgDelay).toBeGreaterThan(baseDelay * 1.05); // More than 5% jitter on average
      expect(avgDelay).toBeLessThan(baseDelay * 1.25); // Less than 25% jitter on average
    });
  });

  describe('Retry State Management Performance', () => {
    beforeEach(() => {
      errorRecovery = new ErrorRecovery({
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });
    });

    it('should perform retry state operations within performance thresholds', () => {
      const iterations = 1000;
      const operations = ['op1', 'op2', 'op3', 'op4', 'op5'];

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const operation = operations[i % operations.length];

        // Test canRetry performance
        errorRecovery.canRetry(operation);

        // Test clearRetryAttempts performance
        errorRecovery.clearRetryAttempts(operation);

        // Simulate setting retry attempts
        errorRecovery._retryAttempts =
          errorRecovery._retryAttempts || new Map();
        errorRecovery._retryAttempts.set(
          operation,
          Math.floor(Math.random() * 3)
        );
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance expectation: should average less than 0.01ms per operation
      expect(avgTime).toBeLessThan(0.01);
    });
  });
});
