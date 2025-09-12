/**
 * @file Unit tests for ClothingLogger
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingLogger } from '../../../../src/clothing/logging/clothingLogger.js';

describe('ClothingLogger', () => {
  let mockBaseLogger;
  let clothingLogger;

  beforeEach(() => {
    mockBaseLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    clothingLogger = new ClothingLogger(mockBaseLogger);
  });

  describe('Structured Logging', () => {
    it('should log accessibility queries with proper structure', () => {
      const startTime = performance.now() - 10;
      
      clothingLogger.logAccessibilityQuery(
        'test_entity',
        { mode: 'topmost', layer: 'base' },
        startTime,
        [{ itemId: 'item1' }, { itemId: 'item2' }]
      );

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        'Clothing accessibility query',
        expect.objectContaining({
          operation: 'getAccessibleItems',
          entityId: 'test_entity',
          queryOptions: { mode: 'topmost', layer: 'base' },
          resultCount: 2,
          duration: expect.stringMatching(/\d+\.\d+ms/),
          timestamp: expect.any(String)
        })
      );
    });

    it('should log coverage analysis with item counts', () => {
      const startTime = performance.now() - 15;
      const equipped = {
        torso: { base: 'shirt', outer: 'jacket' },
        legs: { base: 'pants' }
      };
      
      clothingLogger.logCoverageAnalysis(
        equipped,
        'test_entity',
        startTime,
        { blockedCount: 1 }
      );

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        'Coverage analysis performed',
        expect.objectContaining({
          operation: 'analyzeCoverageBlocking',
          entityId: 'test_entity',
          itemCount: 3,
          duration: expect.stringMatching(/\d+\.\d+ms/),
          blockedItems: 1
        })
      );
    });

    it('should log priority calculations with cache status', () => {
      clothingLogger.logPriorityCalculation(
        'outer',
        'removal',
        { boost: 0.1 },
        2.5,
        true
      );

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        'Priority calculation',
        expect.objectContaining({
          operation: 'calculatePriority',
          layer: 'outer',
          context: 'removal',
          modifiers: { boost: 0.1 },
          result: 2.5,
          cached: true
        })
      );
    });
  });

  describe('Service Call Logging', () => {
    it('should log successful service calls', () => {
      const startTime = performance.now() - 5;
      
      clothingLogger.logServiceCall(
        'AccessibilityService',
        'getItems',
        { entityId: 'test' },
        startTime,
        ['item1', 'item2'],
        null
      );

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        'Clothing service call',
        expect.objectContaining({
          serviceName: 'AccessibilityService',
          method: 'getItems',
          success: true,
          resultType: 'object',
          duration: expect.stringMatching(/\d+\.\d+ms/)
        })
      );
    });

    it('should log failed service calls as errors', () => {
      const startTime = performance.now() - 5;
      const error = new Error('Service failed');
      
      clothingLogger.logServiceCall(
        'AccessibilityService',
        'getItems',
        { entityId: 'test' },
        startTime,
        null,
        error
      );

      expect(mockBaseLogger.error).toHaveBeenCalledWith(
        'Clothing service call',
        expect.objectContaining({
          serviceName: 'AccessibilityService',
          method: 'getItems',
          success: false,
          error: 'Service failed'
        })
      );
    });
  });

  describe('Cache Operation Logging', () => {
    it('should log cache hits', () => {
      clothingLogger.logCacheOperation('hit', 'entity_123:topmost', {
        size: 5
      });

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        'Cache operation',
        expect.objectContaining({
          operation: 'cache_hit',
          cacheKey: 'entity_123:topmost',
          size: 5
        })
      );
    });

    it('should log cache misses', () => {
      clothingLogger.logCacheOperation('miss', 'entity_456:all');

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        'Cache operation',
        expect.objectContaining({
          operation: 'cache_miss',
          cacheKey: 'entity_456:all'
        })
      );
    });
  });

  describe('Validation Logging', () => {
    it('should log successful validation as debug', () => {
      clothingLogger.logValidation('entityId', 'test_123', 'string', true);

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        'Validation result',
        expect.objectContaining({
          operation: 'validation',
          field: 'entityId',
          valueType: 'string',
          expectedType: 'string',
          valid: true
        })
      );
    });

    it('should log failed validation as warning', () => {
      clothingLogger.logValidation('entityId', 123, 'string', false);

      expect(mockBaseLogger.warn).toHaveBeenCalledWith(
        'Validation result',
        expect.objectContaining({
          operation: 'validation',
          field: 'entityId',
          valueType: 'number',
          expectedType: 'string',
          valid: false
        })
      );
    });
  });

  describe('Error Recovery Logging', () => {
    it('should log successful recovery as info', () => {
      const error = new Error('Original error');
      
      clothingLogger.logErrorRecovery(
        error,
        'fallback_to_legacy',
        true,
        { mode: 'legacy' }
      );

      expect(mockBaseLogger.info).toHaveBeenCalledWith(
        'Error recovery attempt',
        expect.objectContaining({
          operation: 'error_recovery',
          errorType: 'Error',
          errorMessage: 'Original error',
          strategy: 'fallback_to_legacy',
          success: true,
          hasFallbackData: true
        })
      );
    });

    it('should log failed recovery as warning', () => {
      const error = new Error('Original error');
      
      clothingLogger.logErrorRecovery(
        error,
        'retry_with_sanitization',
        false
      );

      expect(mockBaseLogger.warn).toHaveBeenCalledWith(
        'Error recovery attempt',
        expect.objectContaining({
          operation: 'error_recovery',
          strategy: 'retry_with_sanitization',
          success: false,
          hasFallbackData: false
        })
      );
    });
  });

  describe('Performance Warning', () => {
    it('should log performance warnings when threshold exceeded', () => {
      clothingLogger.logPerformanceWarning(
        'getAccessibleItems',
        150,
        100
      );

      expect(mockBaseLogger.warn).toHaveBeenCalledWith(
        'Performance threshold exceeded',
        expect.objectContaining({
          operation: 'getAccessibleItems',
          duration: '150.00ms',
          threshold: '100ms',
          exceeded: '50.00ms'
        })
      );
    });
  });

  describe('Context Preservation', () => {
    it('should preserve context through child loggers', () => {
      const parentLogger = new ClothingLogger(mockBaseLogger, {
        module: 'clothing',
        version: '1.0'
      });
      
      const childLogger = parentLogger.withContext({
        submodule: 'accessibility',
        operation: 'query'
      });

      childLogger.logAccessibilityQuery('test', {}, performance.now(), []);

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          module: 'clothing',
          version: '1.0',
          submodule: 'accessibility',
          operation: 'query'
        })
      );
    });

    it('should override parent context in child logger', () => {
      const parentLogger = new ClothingLogger(mockBaseLogger, {
        level: 'parent'
      });
      
      const childLogger = parentLogger.withContext({
        level: 'child'
      });

      childLogger.logCacheOperation('hit', 'test');

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          level: 'child'
        })
      );
    });
  });

  describe('Parameter Sanitization', () => {
    it('should sanitize large equipment data', () => {
      const largeEquipped = {};
      for (let i = 0; i < 10; i++) {
        largeEquipped[`slot_${i}`] = { base: `item_${i}` };
      }

      clothingLogger.logServiceCall(
        'TestService',
        'test',
        { equipped: largeEquipped },
        performance.now(),
        null
      );

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          parameters: expect.objectContaining({
            equipped: '[10 slots]'
          })
        })
      );
    });

    it('should redact sensitive fields', () => {
      clothingLogger.logServiceCall(
        'TestService',
        'test',
        { 
          entityId: 'test',
          password: 'secret123',
          apiKey: 'key456',
          normalField: 'visible'
        },
        performance.now(),
        null
      );

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          parameters: expect.objectContaining({
            entityId: 'test',
            password: '[REDACTED]',
            apiKey: '[REDACTED]',
            normalField: 'visible'
          })
        })
      );
    });

    it('should handle non-object parameters', () => {
      clothingLogger.logServiceCall(
        'TestService',
        'test',
        'simple_string',
        performance.now(),
        null
      );

      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          parameters: 'simple_string'
        })
      );
    });
  });
});