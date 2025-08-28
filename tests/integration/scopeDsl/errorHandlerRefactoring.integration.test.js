/**
 * @file Integration tests for ScopeDslErrorHandler refactoring
 * @description Tests to verify that the refactoring to use external constants
 * maintains full backward compatibility and functionality
 */

import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach } from '@jest/globals';
import ScopeDslErrorHandler, {
  ErrorCategories,
} from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ErrorCategories as ExternalErrorCategories } from '../../../src/scopeDsl/constants/errorCategories.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';

describe('ScopeDslErrorHandler - Integration Tests After Refactoring', () => {
  let mockLogger;
  let errorHandler;
  let mockContext;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    errorHandler = new ScopeDslErrorHandler({ logger: mockLogger });

    mockContext = {
      actorEntity: { id: 'actor123' },
      runtimeCtx: { location: { id: 'location1' } },
      dispatcher: { resolve: jest.fn() },
      depth: 2,
    };
  });

  describe('Constants Integration', () => {
    it('should use external ErrorCategories correctly', () => {
      // The exported ErrorCategories should be the same as the external ones
      expect(ErrorCategories).toBe(ExternalErrorCategories);
    });

    it('should have access to external constants', () => {
      expect(ExternalErrorCategories).toBeDefined();
      expect(ErrorCodes).toBeDefined();
      expect(typeof ExternalErrorCategories).toBe('object');
      expect(typeof ErrorCodes).toBe('object');
    });

    it('should maintain constant immutability after refactoring', () => {
      expect(Object.isFrozen(ErrorCategories)).toBe(true);
      expect(Object.isFrozen(ErrorCodes)).toBe(true);
    });
  });

  describe('Error Code Generation Integration', () => {
    it('should generate specific error codes instead of generic base codes', () => {
      const testCases = [
        {
          error: 'Context is missing',
          context: {}, // Empty context to trigger MISSING_CONTEXT
          expectedCategory: ExternalErrorCategories.MISSING_CONTEXT,
          expectedCode: ErrorCodes.MISSING_CONTEXT_GENERIC, // Should be SCOPE_1000
        },
        {
          error: 'Data format is malformed',
          context: mockContext,
          expectedCategory: ExternalErrorCategories.INVALID_DATA,
          expectedCode: ErrorCodes.INVALID_DATA_GENERIC, // Should be SCOPE_2000
        },
        {
          error: 'Failed to resolve scope reference',
          context: mockContext,
          expectedCategory: ExternalErrorCategories.RESOLUTION_FAILURE,
          expectedCode: ErrorCodes.RESOLUTION_FAILED_GENERIC, // Should be SCOPE_3000
        },
        {
          error: 'Circular dependency detected in scope chain',
          context: mockContext,
          expectedCategory: ExternalErrorCategories.CYCLE_DETECTED,
          expectedCode: ErrorCodes.CYCLE_DETECTED, // Should be SCOPE_4001
        },
        {
          error: 'Maximum depth exceeded during resolution',
          context: mockContext,
          expectedCategory: ExternalErrorCategories.DEPTH_EXCEEDED,
          expectedCode: ErrorCodes.MAX_DEPTH_EXCEEDED, // Should be SCOPE_4002
        },
        {
          error: 'Parse error in scope expression',
          context: mockContext,
          expectedCategory: ExternalErrorCategories.PARSE_ERROR,
          expectedCode: ErrorCodes.PARSE_ERROR_GENERIC, // Should be SCOPE_5000
        },
        {
          error: 'Configuration setting is invalid',
          context: mockContext,
          expectedCategory: ExternalErrorCategories.CONFIGURATION,
          expectedCode: ErrorCodes.CONFIGURATION_GENERIC, // Should be SCOPE_6000
        },
      ];

      testCases.forEach(({ error, context, expectedCode }) => {
        expect(() => {
          errorHandler.handleError(error, context, 'TestResolver');
        }).toThrow(ScopeDslError);

        // Get the last error from buffer to check the code
        const errorBuffer = errorHandler.getErrorBuffer();
        const lastError = errorBuffer[errorBuffer.length - 1];
        expect(lastError.code).toBe(expectedCode);

        // Clear buffer for next test
        errorHandler.clearErrorBuffer();
      });
    });

    it('should handle unknown errors with fallback code', () => {
      const unknownError = 'Some completely unrecognized error message';

      expect(() => {
        errorHandler.handleError(unknownError, mockContext, 'TestResolver');
      }).toThrow(ScopeDslError);

      const errorBuffer = errorHandler.getErrorBuffer();
      const lastError = errorBuffer[errorBuffer.length - 1];
      expect(lastError.category).toBe(ExternalErrorCategories.UNKNOWN);
      expect(lastError.code).toBe(ErrorCodes.UNKNOWN_GENERIC); // Should be SCOPE_9000
    });

    it('should use fallback code when category is not mapped', () => {
      // Create a scenario where the category mapping might fail
      const customError = new Error('Custom error with no clear category');

      expect(() => {
        errorHandler.handleError(customError, {}, 'TestResolver');
      }).toThrow(ScopeDslError);

      const errorBuffer = errorHandler.getErrorBuffer();
      const lastError = errorBuffer[errorBuffer.length - 1];

      // Should fallback to UNKNOWN category and corresponding code
      expect(Object.values(ErrorCodes)).toContain(lastError.code);
    });
  });

  describe('Backward Compatibility Verification', () => {
    it('should preserve existing error codes for cycle detection', () => {
      const cycleError = 'Circular dependency detected';

      expect(() => {
        errorHandler.handleError(cycleError, mockContext, 'CycleResolver');
      }).toThrow(ScopeDslError);

      const errorBuffer = errorHandler.getErrorBuffer();
      const lastError = errorBuffer[errorBuffer.length - 1];
      expect(lastError.code).toBe('SCOPE_4001'); // Must preserve existing code
    });

    it('should preserve existing error codes for depth exceeded', () => {
      const depthError = 'Maximum depth limit exceeded';

      expect(() => {
        errorHandler.handleError(depthError, mockContext, 'DepthResolver');
      }).toThrow(ScopeDslError);

      const errorBuffer = errorHandler.getErrorBuffer();
      const lastError = errorBuffer[errorBuffer.length - 1];
      expect(lastError.code).toBe('SCOPE_4002'); // Must preserve existing code
    });

    it('should preserve fallback error code', () => {
      // Mock a scenario where category mapping returns undefined
      const strangeError = 'Completely unidentifiable error type';

      expect(() => {
        errorHandler.handleError(strangeError, null, 'TestResolver');
      }).toThrow(ScopeDslError);

      const errorBuffer = errorHandler.getErrorBuffer();
      const lastError = errorBuffer[errorBuffer.length - 1];

      // Should use one of the defined codes, not undefined
      expect(Object.values(ErrorCodes)).toContain(lastError.code);
    });
  });

  describe('Error Message Formatting', () => {
    it('should format error messages with new error codes', () => {
      const testError = 'Test error message';

      let thrownError;
      try {
        errorHandler.handleError(testError, mockContext, 'TestResolver');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeDslError);
      expect(thrownError.message).toMatch(/^\[SCOPE_\d{4}\]/); // Should start with error code in brackets
      expect(thrownError.message).toContain(testError);
    });

    it('should include correct error codes in formatted messages', () => {
      const contextError = 'Missing required context data';

      let thrownError;
      try {
        errorHandler.handleError(contextError, {}, 'ContextResolver');
      } catch (error) {
        thrownError = error;
      }

      // Should include the specific missing context code
      expect(thrownError.message).toContain('[SCOPE_1000]');
    });
  });

  describe('Logging Integration', () => {
    beforeEach(() => {
      // Set development environment for detailed logging
      process.env.NODE_ENV = 'development';
      errorHandler = new ScopeDslErrorHandler({
        logger: mockLogger,
        config: { isDevelopment: true },
      });
    });

    it('should log errors with new error codes in development', () => {
      const testError = 'Development test error';

      expect(() => {
        errorHandler.handleError(testError, mockContext, 'DevTestResolver');
      }).toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
      const logCall = mockLogger.error.mock.calls[0];
      expect(logCall[0]).toContain('[ScopeDSL:DevTestResolver]');
      expect(logCall[1]).toHaveProperty('code');
      expect(logCall[1].code).toMatch(/^SCOPE_\d{4}$/);
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });
  });

  describe('Error Buffer Integration', () => {
    it('should store errors with new code format in buffer', () => {
      const errors = [
        'Context error test',
        'Data validation error test',
        'Resolution failure test',
      ];

      errors.forEach((error) => {
        try {
          errorHandler.handleError(error, mockContext, 'BufferTestResolver');
        } catch {
          // Expected to throw
        }
      });

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer).toHaveLength(3);

      buffer.forEach((errorInfo) => {
        expect(errorInfo.code).toMatch(/^SCOPE_\d{4}$/);
        expect(errorInfo.category).toMatch(/^[a-z_]+$/);
        expect(errorInfo.resolverName).toBe('BufferTestResolver');
        expect(typeof errorInfo.timestamp).toBe('string');
      });
    });

    it('should maintain error buffer functionality after refactoring', () => {
      const testError = 'Buffer functionality test';

      // Clear buffer first
      errorHandler.clearErrorBuffer();
      expect(errorHandler.getErrorBuffer()).toHaveLength(0);

      try {
        errorHandler.handleError(testError, mockContext, 'BufferResolver');
      } catch {
        // Expected to throw
      }

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toHaveProperty('code');
      expect(buffer[0]).toHaveProperty('category');
      expect(buffer[0]).toHaveProperty('message', testError);
    });
  });

  describe('Import and Export Verification', () => {
    it('should properly export ErrorCategories for backward compatibility', () => {
      // This import should work and provide the same constant
      expect(ErrorCategories).toBe(ExternalErrorCategories);
      expect(Object.keys(ErrorCategories)).toHaveLength(8);
    });

    it('should have access to all required constants', () => {
      // Verify all required imports are available
      expect(ExternalErrorCategories).toBeDefined();
      expect(ErrorCodes).toBeDefined();
      expect(ScopeDslError).toBeDefined();
      expect(ScopeDslErrorHandler).toBeDefined();
    });
  });
});
