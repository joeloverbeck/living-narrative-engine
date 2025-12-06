/**
 * @file Unit tests for CircuitBreaker
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  CircuitBreaker,
  CircuitBreakerState,
} from '../../../../src/clothing/monitoring/circuitBreaker.js';
import { ClothingServiceError } from '../../../../src/clothing/errors/clothingErrors.js';

describe('CircuitBreaker', () => {
  let circuitBreaker;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      circuitBreaker = new CircuitBreaker('TestService', 3, 60000, mockLogger);

      const state = circuitBreaker.getState();
      expect(state.state).toBe(CircuitBreakerState.CLOSED);
      expect(state.failureCount).toBe(0);
    });

    it('should open circuit after failure threshold', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 3, 60000, mockLogger);

      const failingOperation = () =>
        Promise.reject(new Error('Service failure'));

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe(CircuitBreakerState.OPEN);
      expect(state.failureCount).toBe(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker OPEN')
      );
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 1, 100, mockLogger);

      // Open the circuit
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      expect(circuitBreaker.isOpen()).toBe(true);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next call should transition to HALF_OPEN
      const successOperation = () => Promise.resolve('success');
      await circuitBreaker.execute(successOperation);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('transitioning to HALF_OPEN')
      );
    });

    it('should close circuit after successful operations in HALF_OPEN', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 1, 100, mockLogger, 2);

      // Open the circuit
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Two successful operations should close the circuit
      const successOperation = () => Promise.resolve('success');
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);

      expect(circuitBreaker.isClosed()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker CLOSED')
      );
    });

    it('should reopen circuit on failure in HALF_OPEN state', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 1, 100, mockLogger);

      // Open the circuit
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Failure in HALF_OPEN should reopen
      try {
        await circuitBreaker.execute(() =>
          Promise.reject(new Error('Fail again'))
        );
      } catch (error) {
        // Expected
      }

      expect(circuitBreaker.isOpen()).toBe(true);
    });
  });

  describe('Fallback Execution', () => {
    it('should use fallback when circuit is open', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 1, 60000, mockLogger);

      // Open the circuit
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      // Should use fallback
      const fallback = jest.fn(() => 'fallback_result');
      const result = await circuitBreaker.execute(
        () => Promise.reject(new Error('Still failing')),
        fallback
      );

      expect(result).toBe('fallback_result');
      expect(fallback).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('using fallback')
      );
    });

    it('should throw error when circuit is open and no fallback provided', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 1, 60000, mockLogger);

      // Open the circuit
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      // Should throw ClothingServiceError
      await expect(
        circuitBreaker.execute(() => Promise.resolve('should not execute'))
      ).rejects.toThrow(ClothingServiceError);
    });

    it('should use fallback on operation failure with circuit closed', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 5, 60000, mockLogger);

      const fallback = jest.fn(() => 'fallback_result');
      const result = await circuitBreaker.execute(
        () => Promise.reject(new Error('Operation failed')),
        fallback
      );

      expect(result).toBe('fallback_result');
      expect(fallback).toHaveBeenCalled();
    });
  });

  describe('Success Handling', () => {
    it('should reset failure count on success in CLOSED state', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 3, 60000, mockLogger);

      // Add some failures
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      let state = circuitBreaker.getState();
      expect(state.failureCount).toBe(1);

      // Success should reset count
      await circuitBreaker.execute(() => Promise.resolve('success'));

      state = circuitBreaker.getState();
      expect(state.failureCount).toBe(0);
    });

    it('should track success count in HALF_OPEN state', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 1, 100, mockLogger, 3);

      // Open the circuit
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // First success in HALF_OPEN
      await circuitBreaker.execute(() => Promise.resolve('success'));

      let state = circuitBreaker.getState();
      expect(state.successCount).toBe(1);
      expect(state.state).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });

  describe('Manual State Control', () => {
    it('should allow forcing circuit open', () => {
      circuitBreaker = new CircuitBreaker('TestService', 5, 60000, mockLogger);

      expect(circuitBreaker.isClosed()).toBe(true);

      circuitBreaker.forceOpen();

      expect(circuitBreaker.isOpen()).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker OPEN')
      );
    });

    it('should allow forcing circuit closed', () => {
      circuitBreaker = new CircuitBreaker('TestService', 1, 60000, mockLogger);

      circuitBreaker.forceOpen();
      expect(circuitBreaker.isOpen()).toBe(true);

      circuitBreaker.forceClosed();

      expect(circuitBreaker.isClosed()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker CLOSED')
      );
    });

    it('should reset circuit to initial state', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 2, 60000, mockLogger);

      // Add some failures
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      let state = circuitBreaker.getState();
      expect(state.failureCount).toBe(1);

      circuitBreaker.reset();

      state = circuitBreaker.getState();
      expect(state.state).toBe(CircuitBreakerState.CLOSED);
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
      expect(state.lastFailureTime).toBe(null);
    });
  });

  describe('State Checking Methods', () => {
    it('should correctly report open state', () => {
      circuitBreaker = new CircuitBreaker('TestService', 5, 60000, mockLogger);

      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.isClosed()).toBe(true);
      expect(circuitBreaker.isHalfOpen()).toBe(false);

      circuitBreaker.forceOpen();

      expect(circuitBreaker.isOpen()).toBe(true);
      expect(circuitBreaker.isClosed()).toBe(false);
      expect(circuitBreaker.isHalfOpen()).toBe(false);
    });
  });

  describe('Error Details in Open State', () => {
    it('should include state details in thrown error', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 1, 60000, mockLogger);

      // Open the circuit
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      try {
        await circuitBreaker.execute(() =>
          Promise.resolve('should not execute')
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ClothingServiceError);
        expect(error.serviceName).toBe('TestService');
        expect(error.operation).toBe('circuit_breaker');
        expect(error.context.state).toBe(CircuitBreakerState.OPEN);
        expect(error.context.failureCount).toBe(1);
      }
    });
  });

  describe('Logging', () => {
    it('should log failure count on each failure', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 3, 60000, mockLogger);

      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('Fail')));
      } catch (error) {
        // Expected
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker failure 1/3'),
        expect.objectContaining({
          error: 'Fail',
        })
      );
    });

    it('should log when using fallback', async () => {
      circuitBreaker = new CircuitBreaker('TestService', 5, 60000, mockLogger);

      await circuitBreaker.execute(
        () => Promise.reject(new Error('Fail')),
        () => 'fallback'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('using fallback for TestService')
      );
    });
  });
});
