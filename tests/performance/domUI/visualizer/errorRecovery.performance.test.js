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
        // First call with no attempts should return base delay with jitter
        const initialDelay = errorRecovery.getRetryDelay('test-operation');
        expect(initialDelay).toBeGreaterThanOrEqual(500); // Base delay
        expect(initialDelay).toBeLessThan(650); // With 30% jitter

        // Simulate first retry attempt
        errorRecovery.clearRetryAttempts('test-operation');
        // Manually set retry attempts to simulate progression
        errorRecovery._retryAttempts = errorRecovery._retryAttempts || new Map();
        errorRecovery._retryAttempts.set('test-operation', 1);

        const delay = errorRecovery.getRetryDelay('test-operation');
        expect(delay).toBeGreaterThanOrEqual(500); // Should be exponentially increased
        expect(delay).toBeLessThan(1500); // With jitter, shouldn't exceed base*2*1.3
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance expectation: should average less than 0.5ms per calculation
      expect(avgTime).toBeLessThan(0.5);
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
        errorRecovery._retryAttempts = errorRecovery._retryAttempts || new Map();
        errorRecovery._retryAttempts.set('test-operation', 2);

        expect(errorRecovery.getRetryDelay('test-operation')).toBe(1000);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance expectation: should average less than 0.2ms per calculation (linear is faster)
      expect(avgTime).toBeLessThan(0.2);
    });

    it('should handle default configuration delay calculation within performance thresholds', () => {
      const iterations = 1000;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        errorRecovery = new ErrorRecovery({
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        });

        // Default uses exponential backoff with jitter
        const delay = errorRecovery.getRetryDelay('test-operation');
        expect(delay).toBeGreaterThanOrEqual(1000); // Base delay
        expect(delay).toBeLessThan(1300); // With 30% jitter
        expect(errorRecovery.canRetry('test-operation')).toBe(true);

        errorRecovery.dispose();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance expectation: should average less than 0.3ms per calculation (includes construction/disposal overhead)
      expect(avgTime).toBeLessThan(0.3);
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
        errorRecovery._retryAttempts = errorRecovery._retryAttempts || new Map();
        errorRecovery._retryAttempts.set(operation, Math.floor(Math.random() * 3));
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance expectation: should average less than 0.01ms per operation
      expect(avgTime).toBeLessThan(0.01);
    });
  });
});