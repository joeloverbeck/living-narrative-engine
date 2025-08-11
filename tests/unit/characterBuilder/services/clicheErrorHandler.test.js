/**
 * @file Unit tests for cliché error handler service
 *
 * Tests comprehensive error handling functionality including:
 * - Error categorization and recovery strategy selection
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern implementation
 * - User message generation and formatting
 * - EventBus integration and error monitoring
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClicheErrorHandler } from '../../../../src/characterBuilder/services/clicheErrorHandler.js';
import {
  ClicheError,
  ClicheLLMError,
  ClicheStorageError,
  ClicheValidationError,
  ClicheDataIntegrityError,
  ClicheGenerationError,
  ClichePrerequisiteError,
} from '../../../../src/errors/clicheErrors.js';

describe('ClicheErrorHandler', () => {
  let errorHandler;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // Create error handler instance
    errorHandler = new ClicheErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus,
      retryConfig: {
        maxRetries: 3,
        baseDelay: 100, // Shorter delays for testing
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitterFactor: 0.1, // Reduced jitter for more predictable testing
      },
    });

    // Clear mock calls between tests
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create error handler with valid dependencies', () => {
      expect(errorHandler).toBeDefined();
      expect(errorHandler).toBeInstanceOf(ClicheErrorHandler);
    });

    it('should throw error for missing logger', () => {
      expect(() => {
        new ClicheErrorHandler({
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error for missing eventBus', () => {
      expect(() => {
        new ClicheErrorHandler({
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error for invalid logger', () => {
      expect(() => {
        new ClicheErrorHandler({
          logger: { invalidMethod: jest.fn() },
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should accept custom retry configuration', () => {
      const customConfig = {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 20000,
      };

      const handler = new ClicheErrorHandler({
        logger: mockLogger,
        eventBus: mockEventBus,
        retryConfig: customConfig,
      });

      expect(handler).toBeDefined();
    });
  });

  describe('handleError - General Functionality', () => {
    it('should handle basic error with logging and event dispatch', async () => {
      const error = new ClicheError('Test error');
      const context = { operation: 'test_operation' };

      const result = await errorHandler.handleError(error, context);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CLICHE_ERROR_OCCURRED',
        payload: expect.objectContaining({
          error: expect.objectContaining({
            name: 'ClicheError',
            message: 'Test error',
          }),
          context: expect.objectContaining({
            operation: 'test_operation',
            timestamp: expect.any(String),
          }),
        }),
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should enrich context with metadata', async () => {
      const error = new ClicheError('Test error');
      const context = { operation: 'test' };

      await errorHandler.handleError(error, context);

      const dispatchCall = mockEventBus.dispatch.mock.calls[0][0];
      expect(dispatchCall.payload.context).toMatchObject({
        operation: 'test',
        timestamp: expect.any(String),
        errorType: 'ClicheError',
        errorCode: 'CLICHE_ERROR',
        sessionId: expect.any(String),
      });
    });

    it('should handle errors when event dispatch fails', async () => {
      mockEventBus.dispatch.mockRejectedValue(
        new Error('Event dispatch failed')
      );

      const error = new ClicheError('Test error');
      const result = await errorHandler.handleError(error);

      expect(mockLogger.error).toHaveBeenCalledTimes(2); // Original error + dispatch error
      expect(result).toBeDefined();
    });
  });

  describe('handleError - LLM Errors', () => {
    it('should handle retryable LLM error with retry strategy', async () => {
      const error = new ClicheLLMError('Service temporarily unavailable', 503);
      const context = { operation: 'generate', attempt: 1 };

      const result = await errorHandler.handleError(error, context);

      expect(result.shouldRetry).toBe(true);
      expect(result.delay).toBeGreaterThan(0);
      expect(result.nextAttempt).toBe(2);
      expect(result.userMessage).toContain('Retrying');
      expect(result.errorCategory).toBe('retryable');
    });

    it('should handle non-retryable LLM error', async () => {
      const error = new ClicheLLMError('API key invalid', 401);
      const context = { operation: 'generate', attempt: 3 };

      const result = await errorHandler.handleError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.fallbackOptions).toBeDefined();
      expect(result.fallbackOptions.length).toBeGreaterThan(0);
      expect(result.errorCategory).toBe('non_retryable');
    });

    it('should stop retrying after maximum attempts', async () => {
      const error = new ClicheLLMError('Temporary failure', 503);
      const context = { operation: 'generate', attempt: 3, maxRetries: 3 };

      const result = await errorHandler.handleError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('Unable');
    });

    it('should calculate exponential backoff correctly', async () => {
      const error = new ClicheLLMError('Retry needed', 503);

      const result1 = await errorHandler.handleError(error, { attempt: 1 });
      const result2 = await errorHandler.handleError(error, { attempt: 2 });

      // Should have delay properties for retryable attempts
      expect(result1.delay).toBeDefined();
      expect(result2.delay).toBeDefined();

      // Each delay should be larger (within jitter tolerance)
      expect(result2.delay).toBeGreaterThan(result1.delay * 0.9);

      // Should not exceed maximum delay
      expect(result1.delay).toBeLessThanOrEqual(1000);
      expect(result2.delay).toBeLessThanOrEqual(1000);

      // Test non-retryable case (at max retries)
      const result3 = await errorHandler.handleError(error, { attempt: 3 });
      expect(result3.shouldRetry).toBe(false);
      expect(result3.delay).toBeUndefined();
    });
  });

  describe('handleError - Storage Errors', () => {
    it('should handle storage error with fallback strategy', async () => {
      const error = new ClicheStorageError(
        'Database connection failed',
        'save'
      );
      const context = { operation: 'save_cliches' };

      const result = await errorHandler.handleError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.canContinue).toBe(true);
      expect(result.fallbackAction).toBeDefined();
      expect(result.userMessage).toContain('session only');
      expect(result.errorCategory).toBe('degradation_possible');
    });

    it('should log storage fallback warning', async () => {
      const error = new ClicheStorageError('Disk full', 'save');

      await errorHandler.handleError(error);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Storage failed'),
        expect.any(Object)
      );
    });
  });

  describe('handleError - Validation Errors', () => {
    it('should handle validation error with user guidance', async () => {
      const validationErrors = ['Field is required', 'Invalid format'];
      const error = new ClicheValidationError(
        'Validation failed',
        validationErrors
      );
      const context = { operation: 'validate_input' };

      const result = await errorHandler.handleError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.canContinue).toBe(false);
      expect(result.validationErrors).toEqual(validationErrors);
      expect(result.actionableSteps).toBeDefined();
      expect(result.errorCategory).toBe('user_action_required');
    });

    it('should handle prerequisite error', async () => {
      const missingPrereqs = ['direction', 'concept'];
      const error = new ClichePrerequisiteError(
        'Missing prerequisites',
        missingPrereqs
      );

      const result = await errorHandler.handleError(error);

      expect(result.userMessage).toContain('required information');
      expect(result.errorCategory).toBe('user_action_required');
    });
  });

  describe('handleError - Data Integrity Errors', () => {
    it('should handle data integrity error with refresh requirement', async () => {
      const error = new ClicheDataIntegrityError(
        'Data corruption detected',
        'cliches'
      );
      const context = { operation: 'load_data' };

      const result = await errorHandler.handleError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.requiresRefresh).toBe(true);
      expect(result.recoveryOptions).toBeDefined();
      expect(result.userMessage).toContain('refresh');
      expect(result.errorCategory).toBe('user_action_required');
    });
  });

  describe('handleError - Unknown Errors', () => {
    it('should handle unknown error with conservative approach', async () => {
      const error = new Error('Unknown error type');
      const context = { operation: 'unknown_operation' };

      const result = await errorHandler.handleError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.requiresRefresh).toBe(true);
      expect(result.userMessage).toContain('unexpected error');
      expect(result.errorCategory).toBe('non_retryable');
      expect(result.recommendation).toBe('FULL_REFRESH');
    });
  });

  describe('Circuit Breaker Functionality', () => {
    it('should open circuit breaker after failure threshold', async () => {
      const error = new ClicheLLMError('Service failure', 500);
      const context = { operation: 'test_operation' };

      // Simulate multiple failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(error, context);
      }

      // Next call should be blocked by circuit breaker
      const result = await errorHandler.handleError(error, context);

      expect(result.circuitBreakerOpen).toBe(true);
      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('temporarily unavailable');
    });

    it('should reset circuit breaker manually', async () => {
      const error = new ClicheLLMError('Service failure', 500);
      const operation = 'test_operation';

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(error, { operation });
      }

      // Reset circuit breaker
      errorHandler.resetCircuitBreaker(operation);

      // Should work normally after reset
      const result = await errorHandler.handleError(error, { operation });
      expect(result.circuitBreakerOpen).toBeUndefined();
    });
  });

  describe('formatUserMessage', () => {
    it('should format ClicheError messages based on error code', () => {
      const generationError = new ClicheGenerationError('Generation failed');
      const message = errorHandler.formatUserMessage(generationError);

      expect(message).toContain('Unable to generate clichés');
    });

    it('should format validation error messages', () => {
      const validationError = new ClicheValidationError('Validation failed');
      const message = errorHandler.formatUserMessage(validationError);

      expect(message).toContain('check your input');
    });

    it('should handle unknown error types with fallback message', () => {
      const unknownError = new Error('Unknown error');
      const message = errorHandler.formatUserMessage(unknownError);

      expect(message).toContain('error occurred');
    });

    it('should handle different error codes', () => {
      const storageError = new ClicheStorageError('Save failed', 'save');
      const message = errorHandler.formatUserMessage(storageError);

      expect(message).toContain('save');
      expect(message).toContain('session only');
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics', async () => {
      const error1 = new ClicheLLMError('Service error', 500);
      const error2 = new ClicheValidationError('Invalid input');

      await errorHandler.handleError(error1, { operation: 'generate' });
      await errorHandler.handleError(error2, { operation: 'validate' });
      await errorHandler.handleError(error1, { operation: 'generate' });

      const stats = errorHandler.getErrorStatistics();

      expect(stats).toHaveProperty('ClicheLLMError:generate');
      expect(stats).toHaveProperty('ClicheValidationError:validate');
      expect(stats['ClicheLLMError:generate'].count).toBe(2);
      expect(stats['ClicheValidationError:validate'].count).toBe(1);
    });

    it('should include timing information in statistics', async () => {
      const error = new ClicheLLMError('Test error', 500);

      await errorHandler.handleError(error, { operation: 'test' });

      const stats = errorHandler.getErrorStatistics();
      const errorStats = stats['ClicheLLMError:test'];

      expect(errorStats).toHaveProperty('count');
      expect(errorStats).toHaveProperty('lastOccurrence');
      expect(errorStats).toHaveProperty('averageResolution');
      expect(typeof errorStats.lastOccurrence).toBe('string');
      expect(typeof errorStats.averageResolution).toBe('number');
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle null context gracefully', async () => {
      const error = new ClicheError('Test error');

      const result = await errorHandler.handleError(error, null);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should handle undefined context gracefully', async () => {
      const error = new ClicheError('Test error');

      const result = await errorHandler.handleError(error);

      expect(result).toBeDefined();
      expect(mockEventBus.dispatch).toHaveBeenCalled();
    });

    it('should handle errors with circular references in context', async () => {
      const error = new ClicheError('Test error');
      const circularContext = { operation: 'test' };
      circularContext.self = circularContext; // Create circular reference

      const result = await errorHandler.handleError(error, circularContext);

      expect(result).toBeDefined();
      expect(mockEventBus.dispatch).toHaveBeenCalled();
    });

    it('should handle very long error messages', async () => {
      const longMessage = 'x'.repeat(10000);
      const error = new ClicheError(longMessage);

      const result = await errorHandler.handleError(error);

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle errors with undefined properties', async () => {
      const error = new ClicheLLMError('Test', undefined); // undefined statusCode

      const result = await errorHandler.handleError(error);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe('Recovery Strategy Selection', () => {
    it('should select appropriate recovery for different error types', async () => {
      const testCases = [
        {
          error: new ClicheLLMError('Temporary failure', 503),
          expectedCategory: 'retryable',
        },
        {
          error: new ClicheStorageError('Disk full', 'save'),
          expectedCategory: 'degradation_possible',
        },
        {
          error: new ClicheValidationError('Invalid input'),
          expectedCategory: 'user_action_required',
        },
        {
          error: new ClicheDataIntegrityError('Corrupted', 'data'),
          expectedCategory: 'user_action_required',
        },
      ];

      for (const testCase of testCases) {
        const result = await errorHandler.handleError(testCase.error);
        expect(result.errorCategory).toBe(testCase.expectedCategory);
      }
    });

    it('should provide different recommendations based on error type', async () => {
      const llmError = new ClicheLLMError('Service down', 503);
      const storageError = new ClicheStorageError('Save failed', 'save');

      const llmResult = await errorHandler.handleError(llmError, {
        attempt: 1,
      });
      const storageResult = await errorHandler.handleError(storageError);

      expect(llmResult.recommendation).toBe('RETRY_WITH_BACKOFF');
      expect(storageResult.recommendation).toBe('USE_FALLBACK_STORAGE');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle high volume of errors without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many errors
      for (let i = 0; i < 1000; i++) {
        const error = new ClicheError(`Error ${i}`);
        await errorHandler.handleError(error, {
          operation: `operation_${i % 10}`,
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 15MB)
      expect(memoryIncrease).toBeLessThan(15 * 1024 * 1024);
    });

    it('should process errors quickly', async () => {
      const startTime = Date.now();

      // Process batch of errors
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const error = new ClicheError(`Error ${i}`);
        promises.push(errorHandler.handleError(error));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 100 errors in less than 1 second
      expect(processingTime).toBeLessThan(1000);
    });
  });
});
