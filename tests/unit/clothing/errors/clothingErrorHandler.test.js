/**
 * @file Unit tests for ClothingErrorHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingErrorHandler } from '../../../../src/clothing/errors/clothingErrorHandler.js';
import {
  ClothingServiceError,
  CoverageAnalysisError,
  PriorityCalculationError,
  ClothingValidationError,
  ClothingAccessibilityError
} from '../../../../src/clothing/errors/clothingErrors.js';

describe('ClothingErrorHandler', () => {
  let errorHandler;
  let mockLogger;
  let mockEventBus;
  let mockCentralErrorHandler;
  let mockRecoveryStrategyManager;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };

    mockEventBus = {
      dispatch: jest.fn()
    };

    // Create handler without central integration for backward compatibility tests
    errorHandler = new ClothingErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus
    });
  });

  describe('Error Recovery', () => {
    it('should recover from accessibility service failures', async () => {
      const serviceError = new ClothingServiceError(
        'Service unavailable',
        'ClothingAccessibilityService',
        'getAccessibleItems',
        { entityId: 'test_entity' }
      );

      const recovery = await errorHandler.handleError(serviceError, {
        entityId: 'test_entity',
        options: { mode: 'topmost' }
      });

      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData).toBeDefined();
      expect(recovery.fallbackData.mode).toBe('legacy');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Falling back to legacy clothing logic'
      );
    });

    it('should handle coverage analysis failures gracefully', async () => {
      const coverageError = new CoverageAnalysisError(
        'Coverage calculation failed',
        { torso_lower: { base: 'item1' } },
        { entityId: 'test_entity' }
      );

      const recovery = await errorHandler.handleError(coverageError);

      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData.mode).toBe('layer_only');
      expect(recovery.fallbackData.blockingDisabled).toBe(true);
    });

    it('should provide default priorities on calculation failure', async () => {
      const priorityError = new PriorityCalculationError(
        'Priority calculation failed',
        'base',
        'removal',
        {}
      );

      const recovery = await errorHandler.handleError(priorityError);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData.mode).toBe('default_priorities');
      expect(recovery.fallbackData.priorities).toBeDefined();
      expect(recovery.fallbackData.priorities.outer).toBe(1);
    });

    it('should handle validation errors with sanitization', async () => {
      const validationError = new ClothingValidationError(
        'Invalid field value',
        'entityId',
        123,
        'string',
        {}
      );

      const recovery = await errorHandler.handleError(validationError);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData.mode).toBe('sanitized');
      expect(recovery.fallbackData.retryable).toBe(true);
    });

    it('should fallback to simple accessibility on accessibility errors', async () => {
      const accessibilityError = new ClothingAccessibilityError(
        'Cannot determine accessibility',
        'entity_123',
        'item_456',
        {}
      );

      const recovery = await errorHandler.handleError(accessibilityError);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData.mode).toBe('simple_accessibility');
      expect(recovery.fallbackData.allAccessible).toBe(true);
    });

    it('should handle unknown error types without recovery', async () => {
      const unknownError = new Error('Unknown error');

      const recovery = await errorHandler.handleError(unknownError);
      
      expect(recovery.recovered).toBe(false);
      expect(recovery.fallbackData).toBe(null);
      expect(recovery.recoveryStrategy).toBe('none');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No recovery strategy')
      );
    });
  });

  describe('Error Metrics', () => {
    it('should track error occurrence metrics', async () => {
      const error1 = new ClothingServiceError('Test error 1', 'Service1', 'op1');
      const error2 = new ClothingServiceError('Test error 2', 'Service1', 'op2');
      const error3 = new CoverageAnalysisError('Test error 3', {});

      await errorHandler.handleError(error1);
      await errorHandler.handleError(error2);
      await errorHandler.handleError(error3);

      const metrics = errorHandler.getErrorMetrics();
      
      expect(metrics.ClothingServiceError).toBeDefined();
      expect(metrics.ClothingServiceError.count).toBe(2);
      expect(metrics.CoverageAnalysisError).toBeDefined();
      expect(metrics.CoverageAnalysisError.count).toBe(1);
    });

    it('should clear metrics when requested', async () => {
      const error = new ClothingServiceError('Test error', 'Service1', 'op1');

      await errorHandler.handleError(error);
      let metrics = errorHandler.getErrorMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);

      errorHandler.clearMetrics();
      metrics = errorHandler.getErrorMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });
  });

  describe('Error Logging', () => {
    it('should log clothing-specific errors with full context', async () => {
      const error = new ClothingServiceError(
        'Service failed',
        'TestService',
        'testOperation',
        { detail: 'test' }
      );

      await errorHandler.handleError(error, { additionalContext: 'value' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Clothing system error occurred',
        expect.objectContaining({
          errorType: 'ClothingServiceError',
          errorMessage: 'Service failed',
          handlerContext: { additionalContext: 'value' }
        })
      );
    });

    it('should log unexpected errors differently', async () => {
      const error = new Error('Unexpected error');

      await errorHandler.handleError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in clothing system',
        expect.objectContaining({
          errorType: 'Error',
          errorMessage: 'Unexpected error'
        })
      );
    });
  });

  describe('Event Dispatching', () => {
    it('should dispatch error events to event bus', async () => {
      const error = new ClothingServiceError(
        'Test error',
        'Service',
        'operation'
      );

      const result = await errorHandler.handleError(error);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CLOTHING_ERROR_OCCURRED',
        payload: expect.objectContaining({
          errorId: result.errorId,
          errorType: 'ClothingServiceError',
          message: 'Test error',
          timestamp: expect.any(String)
        })
      });
    });

    it('should include error context in dispatched event', async () => {
      const error = new ClothingAccessibilityError(
        'Access denied',
        'entity_123',
        'item_456',
        { reason: 'blocked' }
      );

      await errorHandler.handleError(error);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CLOTHING_ERROR_OCCURRED',
        payload: expect.objectContaining({
          context: expect.objectContaining({
            reason: 'blocked'
          })
        })
      });
    });
  });

  describe('Error ID Generation', () => {
    it('should generate unique error IDs', async () => {
      const error = new Error('Test');
      
      const result1 = await errorHandler.handleError(error);
      const result2 = await errorHandler.handleError(error);

      expect(result1.errorId).toBeDefined();
      expect(result2.errorId).toBeDefined();
      expect(result1.errorId).not.toBe(result2.errorId);
      expect(result1.errorId).toMatch(/^clothing_\d+_[a-z0-9]+$/);
    });
  });

  describe('Central Error Handler Integration', () => {
    let errorHandlerWithCentral;

    beforeEach(() => {
      mockCentralErrorHandler = {
        handle: jest.fn(),
        handleSync: jest.fn()
      };

      mockRecoveryStrategyManager = {
        executeWithRecovery: jest.fn(),
        registerStrategy: jest.fn()
      };

      errorHandlerWithCentral = new ClothingErrorHandler({
        logger: mockLogger,
        eventBus: mockEventBus,
        centralErrorHandler: mockCentralErrorHandler,
        recoveryStrategyManager: mockRecoveryStrategyManager
      });
    });

    it('should delegate to central error handler when available', async () => {
      const error = new ClothingServiceError('Test error', 'Service', 'op');
      const expectedResult = { errorId: 'central_123', recovered: true };

      mockCentralErrorHandler.handle.mockResolvedValue(expectedResult);

      const result = await errorHandlerWithCentral.handleError(error, { test: 'context' });

      expect(mockCentralErrorHandler.handle).toHaveBeenCalledWith(error, {
        test: 'context',
        domain: 'clothing'
      });
      expect(result).toBe(expectedResult);
    });

    it('should fall back to local handling if central handler fails', async () => {
      const error = new ClothingServiceError(
        'Test error',
        'ClothingAccessibilityService',
        'op'
      );

      mockCentralErrorHandler.handle.mockRejectedValue(new Error('Central failed'));

      const result = await errorHandlerWithCentral.handleError(error);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Central error handler failed, using local handling',
        expect.objectContaining({ error: 'Central failed' })
      );
      expect(result).toHaveProperty('errorId');
      expect(result.recovered).toBe(true);
    });

    it('should register recovery strategies with central system', () => {
      expect(mockRecoveryStrategyManager.registerStrategy).toHaveBeenCalledWith(
        'ClothingServiceError',
        expect.objectContaining({
          retry: { maxRetries: 3, backoff: 'exponential' },
          circuitBreaker: { failureThreshold: 5, resetTimeout: 60000 }
        })
      );

      expect(mockRecoveryStrategyManager.registerStrategy).toHaveBeenCalledWith(
        'CoverageAnalysisError',
        expect.objectContaining({
          retry: { maxRetries: 2, backoff: 'linear' }
        })
      );

      expect(mockRecoveryStrategyManager.registerStrategy).toHaveBeenCalledWith(
        'ClothingValidationError',
        expect.objectContaining({
          retry: { maxRetries: 2, backoff: 'exponential' }
        })
      );
    });

    it('should execute registered fallback strategies using local helpers', () => {
      const strategies = Object.fromEntries(
        mockRecoveryStrategyManager.registerStrategy.mock.calls.map(([errorType, config]) => [
          errorType,
          config
        ])
      );

      mockLogger.warn.mockClear();

      const serviceFallbackResult = strategies.ClothingServiceError.fallback(
        new ClothingServiceError('Service down', 'ClothingAccessibilityService', 'op'),
        { name: 'operation' }
      );
      expect(serviceFallbackResult).toEqual({ mode: 'legacy', items: [], accessible: true });

      const coverageFallbackResult = strategies.CoverageAnalysisError.fallback(
        new CoverageAnalysisError('Coverage failed', {}),
        { name: 'operation' }
      );
      expect(coverageFallbackResult).toEqual({ mode: 'layer_only', blockingDisabled: true });

      const priorityFallbackResult = strategies.PriorityCalculationError.fallback(
        new PriorityCalculationError('Priority failed', 'layer', 'op', {}),
        { name: 'operation' }
      );
      expect(priorityFallbackResult).toEqual({
        mode: 'default_priorities',
        priorities: {
          outer: 1,
          base: 2,
          underwear: 3,
          accessories: 4
        }
      });

      const validationFallbackResult = strategies.ClothingValidationError.fallback(
        new ClothingValidationError('Validation failed', 'field', 'value', 'string', {}),
        { name: 'operation' }
      );
      expect(validationFallbackResult).toEqual({
        mode: 'sanitized',
        retryable: true,
        sanitizedField: 'field',
        sanitizedValue: null
      });

      const accessibilityFallbackResult = strategies.ClothingAccessibilityError.fallback(
        new ClothingAccessibilityError('Accessibility failed', 'entity', 'item', {}),
        { name: 'operation' }
      );
      expect(accessibilityFallbackResult).toEqual({
        mode: 'simple_accessibility',
        allAccessible: true
      });

      expect(mockLogger.warn).toHaveBeenCalledWith('Falling back to legacy clothing logic');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Coverage analysis failed, using layer priority only'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Priority calculation failed, using default priorities'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Validation error, attempting data sanitization'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Accessibility check failed, using simple fallback'
      );
    });

    it('should handle sync errors through central handler', () => {
      const error = new ClothingServiceError('Test error', 'Service', 'op');
      const expectedResult = { errorId: 'sync_123', recovered: true };

      mockCentralErrorHandler.handleSync.mockReturnValue(expectedResult);

      const result = errorHandlerWithCentral.handleErrorSync(error, { test: 'context' });

      expect(mockCentralErrorHandler.handleSync).toHaveBeenCalledWith(error, {
        test: 'context',
        domain: 'clothing'
      });
      expect(result).toBe(expectedResult);
    });

    it('should fall back to local sync handling if central fails', () => {
      const error = new ClothingServiceError(
        'Test error',
        'ClothingAccessibilityService',
        'op'
      );

      mockCentralErrorHandler.handleSync.mockImplementation(() => {
        throw new Error('Central sync failed');
      });

      const result = errorHandlerWithCentral.handleErrorSync(error);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Central error handler failed, using local handling',
        expect.objectContaining({ error: 'Central sync failed' })
      );
      expect(result).toHaveProperty('errorId');
    });
  });

  describe('Recovery Strategy Execution', () => {
    it('should log recovery failure when strategy throws', async () => {
      mockLogger.warn.mockImplementation(() => {
        throw new Error('warn failure');
      });

      const error = new ClothingServiceError(
        'Service failed',
        'ClothingAccessibilityService',
        'operation'
      );

      const recovery = await errorHandler.handleError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recovery failed',
        expect.objectContaining({
          originalError: 'Service failed',
          recoveryError: 'warn failure',
          strategy: ''
        })
      );
      expect(recovery.recovered).toBe(false);
      expect(recovery.fallbackData).toBeNull();
      expect(recovery.recoveryStrategy).toBe('');
    });

    it('should handle unknown error types without recovery', async () => {
      // Test with a generic Error that has no recovery strategy
      const error = new Error('Generic error');
      const recovery = await errorHandler.handleError(error);

      expect(recovery.recovered).toBe(false);
      expect(recovery.fallbackData).toBe(null);
      expect(recovery.recoveryStrategy).toBe('none');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No recovery strategy')
      );
    });

    it('should handle recovery for service errors', async () => {
      const error = new ClothingServiceError(
        'Service failed',
        'ClothingAccessibilityService',
        'operation'
      );
      const recovery = await errorHandler.handleError(error);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData).toBeDefined();
      expect(recovery.fallbackData.mode).toBe('legacy');
    });
  });
});