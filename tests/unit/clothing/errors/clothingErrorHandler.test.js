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

    errorHandler = new ClothingErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus
    });
  });

  describe('Error Recovery', () => {
    it('should recover from accessibility service failures', () => {
      const serviceError = new ClothingServiceError(
        'Service unavailable',
        'ClothingAccessibilityService',
        'getAccessibleItems',
        { entityId: 'test_entity' }
      );

      const recovery = errorHandler.handleError(serviceError, {
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

    it('should handle coverage analysis failures gracefully', () => {
      const coverageError = new CoverageAnalysisError(
        'Coverage calculation failed',
        { torso_lower: { base: 'item1' } },
        { entityId: 'test_entity' }
      );

      const recovery = errorHandler.handleError(coverageError);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData.mode).toBe('layer_only');
      expect(recovery.fallbackData.blockingDisabled).toBe(true);
    });

    it('should provide default priorities on calculation failure', () => {
      const priorityError = new PriorityCalculationError(
        'Priority calculation failed',
        'base',
        'removal',
        {}
      );

      const recovery = errorHandler.handleError(priorityError);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData.mode).toBe('default_priorities');
      expect(recovery.fallbackData.priorities).toBeDefined();
      expect(recovery.fallbackData.priorities.outer).toBe(1);
    });

    it('should handle validation errors with sanitization', () => {
      const validationError = new ClothingValidationError(
        'Invalid field value',
        'entityId',
        123,
        'string',
        {}
      );

      const recovery = errorHandler.handleError(validationError);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData.mode).toBe('sanitized');
      expect(recovery.fallbackData.retryable).toBe(true);
    });

    it('should fallback to simple accessibility on accessibility errors', () => {
      const accessibilityError = new ClothingAccessibilityError(
        'Cannot determine accessibility',
        'entity_123',
        'item_456',
        {}
      );

      const recovery = errorHandler.handleError(accessibilityError);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData.mode).toBe('simple_accessibility');
      expect(recovery.fallbackData.allAccessible).toBe(true);
    });

    it('should handle unknown error types without recovery', () => {
      const unknownError = new Error('Unknown error');

      const recovery = errorHandler.handleError(unknownError);
      
      expect(recovery.recovered).toBe(false);
      expect(recovery.fallbackData).toBe(null);
      expect(recovery.recoveryStrategy).toBe('none');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No recovery strategy')
      );
    });
  });

  describe('Error Metrics', () => {
    it('should track error occurrence metrics', () => {
      const error1 = new ClothingServiceError('Test error 1', 'Service1', 'op1');
      const error2 = new ClothingServiceError('Test error 2', 'Service1', 'op2');
      const error3 = new CoverageAnalysisError('Test error 3', {});

      errorHandler.handleError(error1);
      errorHandler.handleError(error2);
      errorHandler.handleError(error3);

      const metrics = errorHandler.getErrorMetrics();
      
      expect(metrics.ClothingServiceError).toBeDefined();
      expect(metrics.ClothingServiceError.count).toBe(2);
      expect(metrics.CoverageAnalysisError).toBeDefined();
      expect(metrics.CoverageAnalysisError.count).toBe(1);
    });

    it('should clear metrics when requested', () => {
      const error = new ClothingServiceError('Test error', 'Service1', 'op1');
      
      errorHandler.handleError(error);
      let metrics = errorHandler.getErrorMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);

      errorHandler.clearMetrics();
      metrics = errorHandler.getErrorMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });
  });

  describe('Error Logging', () => {
    it('should log clothing-specific errors with full context', () => {
      const error = new ClothingServiceError(
        'Service failed',
        'TestService',
        'testOperation',
        { detail: 'test' }
      );

      errorHandler.handleError(error, { additionalContext: 'value' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Clothing system error occurred',
        expect.objectContaining({
          errorType: 'ClothingServiceError',
          errorMessage: 'Service failed',
          handlerContext: { additionalContext: 'value' }
        })
      );
    });

    it('should log unexpected errors differently', () => {
      const error = new Error('Unexpected error');

      errorHandler.handleError(error);

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
    it('should dispatch error events to event bus', () => {
      const error = new ClothingServiceError(
        'Test error',
        'Service',
        'operation'
      );

      const result = errorHandler.handleError(error);

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

    it('should include error context in dispatched event', () => {
      const error = new ClothingAccessibilityError(
        'Access denied',
        'entity_123',
        'item_456',
        { reason: 'blocked' }
      );

      errorHandler.handleError(error);

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
    it('should generate unique error IDs', () => {
      const error = new Error('Test');
      
      const result1 = errorHandler.handleError(error);
      const result2 = errorHandler.handleError(error);

      expect(result1.errorId).toBeDefined();
      expect(result2.errorId).toBeDefined();
      expect(result1.errorId).not.toBe(result2.errorId);
      expect(result1.errorId).toMatch(/^clothing_\d+_[a-z0-9]+$/);
    });
  });

  describe('Recovery Strategy Execution', () => {
    it('should handle unknown error types without recovery', () => {
      // Test with a generic Error that has no recovery strategy
      const error = new Error('Generic error');
      const recovery = errorHandler.handleError(error);

      expect(recovery.recovered).toBe(false);
      expect(recovery.fallbackData).toBe(null);
      expect(recovery.recoveryStrategy).toBe('none');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No recovery strategy')
      );
    });

    it('should handle recovery for service errors', () => {
      const error = new ClothingServiceError(
        'Service failed',
        'ClothingAccessibilityService',
        'operation'
      );
      
      const recovery = errorHandler.handleError(error);
      
      expect(recovery.recovered).toBe(true);
      expect(recovery.fallbackData).toBeDefined();
      expect(recovery.fallbackData.mode).toBe('legacy');
    });
  });
});