/**
 * @file Unit tests for ScopeDslErrorHandler
 */

import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ScopeDslErrorHandler, {
  ErrorCategories,
} from '../../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';
import { ScopeDslError } from '../../../../src/scopeDsl/errors/scopeDslError.js';

describe('ScopeDslErrorHandler', () => {
  let mockLogger;
  let errorHandler;
  let validDependencies;
  let mockContext;

  beforeEach(() => {
    // Create mock logger with all required methods
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    // Create valid dependencies
    validDependencies = {
      logger: mockLogger,
    };

    // Create mock context
    mockContext = {
      actorEntity: { id: 'actor123' },
      runtimeCtx: { location: { id: 'location1' } },
      dispatcher: { resolve: jest.fn() },
      depth: 2,
    };
  });

  // Restore original NODE_ENV after each test
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const handler = new ScopeDslErrorHandler(validDependencies);
      expect(handler).toBeInstanceOf(ScopeDslErrorHandler);
    });

    it('should throw error for missing logger', () => {
      const invalidDeps = { ...validDependencies, logger: null };
      expect(() => new ScopeDslErrorHandler(invalidDeps)).toThrow(
        'Missing required dependency: ILogger'
      );
    });

    it('should throw error for logger missing required methods', () => {
      const invalidLogger = { error: jest.fn() }; // Missing warn, debug, info
      const invalidDeps = { ...validDependencies, logger: invalidLogger };
      expect(() => new ScopeDslErrorHandler(invalidDeps)).toThrow(
        'Invalid or missing method'
      );
    });

    it('should use default config values when not provided', () => {
      process.env.NODE_ENV = 'production';
      const handler = new ScopeDslErrorHandler(validDependencies);
      // Test by checking behavior - production mode should log minimal errors
      expect(handler).toBeInstanceOf(ScopeDslErrorHandler);
    });

    it('should accept custom config values', () => {
      const config = {
        isDevelopment: true,
        maxBufferSize: 50,
      };
      const handler = new ScopeDslErrorHandler({
        ...validDependencies,
        config,
      });
      expect(handler).toBeInstanceOf(ScopeDslErrorHandler);
    });
  });

  describe('environment detection', () => {
    it('should detect production environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      errorHandler = new ScopeDslErrorHandler(validDependencies);

      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      // Production logging should be minimal (no detailed context)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[ScopeDSL:testResolver\] SCOPE_\d+: test error$/
        )
      );
    });

    it('should detect development environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'development';
      errorHandler = new ScopeDslErrorHandler(validDependencies);

      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      // Development logging should include detailed context
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[ScopeDSL:testResolver\] test error$/),
        expect.objectContaining({
          code: expect.any(String),
          category: expect.any(String),
          context: expect.any(Object),
          timestamp: expect.any(String),
        })
      );
    });

    it('should allow config override of environment detection', () => {
      process.env.NODE_ENV = 'production';
      const config = { isDevelopment: true };
      errorHandler = new ScopeDslErrorHandler({ ...validDependencies, config });

      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      // Should behave as development despite NODE_ENV=production
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[ScopeDSL:testResolver\] test error$/),
        expect.objectContaining({
          context: expect.any(Object),
        })
      );
    });

    it('should fallback to console logging when logger fails', () => {
      process.env.NODE_ENV = 'production';
      mockLogger.error = jest.fn(() => {
        throw new Error('logger failure');
      });
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        errorHandler = new ScopeDslErrorHandler(validDependencies);

        expect(() =>
          errorHandler.handleError('log failure', mockContext, 'logResolver')
        ).toThrow(ScopeDslError);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[ScopeDSL:logResolver] Logging failed:',
          'logger failure'
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('handleError', () => {
    beforeEach(() => {
      errorHandler = new ScopeDslErrorHandler(validDependencies);
    });

    it('should handle string error messages', () => {
      const errorMessage = 'Test error message';

      expect(() =>
        errorHandler.handleError(errorMessage, mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error object');

      expect(() =>
        errorHandler.handleError(error, mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should always throw ScopeDslError', () => {
      expect(() =>
        errorHandler.handleError('test', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);
    });

    it('should include error code in thrown error message', () => {
      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/^\[SCOPE_\d+\]/),
        })
      );
    });

    it('should accept custom error code', () => {
      const customCode = 'CUSTOM_ERROR_001';

      expect(() =>
        errorHandler.handleError(
          'test error',
          mockContext,
          'testResolver',
          customCode
        )
      ).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/^\[CUSTOM_ERROR_001\]/),
        })
      );
    });

    it('should fallback when error info creation fails', () => {
      const problematicContext = {};
      Object.defineProperty(problematicContext, 'constructor', {
        get() {
          throw new Error('constructor access failed');
        },
      });

      expect(() =>
        errorHandler.handleError(
          'fallback path triggered',
          problematicContext,
          'fallbackResolver'
        )
      ).toThrow(ScopeDslError);

      const [bufferedError] = errorHandler.getErrorBuffer();
      expect(bufferedError).toEqual(
        expect.objectContaining({
          message: 'fallback path triggered',
          resolverName: 'fallbackResolver',
          category: ErrorCategories.UNKNOWN,
          code: ErrorCodes.UNKNOWN_ERROR,
        })
      );
      expect(bufferedError.sanitizedContext).toEqual({
        error: 'Context sanitization failed',
      });
      expect(bufferedError.originalError).toContain(
        'constructor access failed'
      );
    });

    it('should handle null context gracefully', () => {
      expect(() =>
        errorHandler.handleError('test', null, 'testResolver')
      ).toThrow(ScopeDslError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle undefined context gracefully', () => {
      expect(() =>
        errorHandler.handleError('test', undefined, 'testResolver')
      ).toThrow(ScopeDslError);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('error categorization', () => {
    beforeEach(() => {
      errorHandler = new ScopeDslErrorHandler(validDependencies);
    });

    it('should categorize missing context errors', () => {
      expect(() =>
        errorHandler.handleError('missing actorEntity', {}, 'testResolver')
      ).toThrow(ScopeDslError);
      // We can verify categorization worked by checking the buffer
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.MISSING_CONTEXT);
    });

    it('should categorize cycle detection errors', () => {
      expect(() =>
        errorHandler.handleError(
          'circular reference detected',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.CYCLE_DETECTED);
    });

    it('should categorize depth exceeded errors', () => {
      expect(() =>
        errorHandler.handleError(
          'maximum depth exceeded',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.DEPTH_EXCEEDED);
    });

    it('should categorize parse errors', () => {
      expect(() =>
        errorHandler.handleError(
          'syntax error in expression',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.PARSE_ERROR);
    });

    it('should categorize invalid data errors', () => {
      expect(() =>
        errorHandler.handleError(
          'invalid data format',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.INVALID_DATA);
    });

    it('should categorize configuration errors', () => {
      expect(() =>
        errorHandler.handleError(
          'configuration setting invalid',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.CONFIGURATION);
    });

    it('should categorize resolution failure errors', () => {
      expect(() =>
        errorHandler.handleError('scope not found', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.RESOLUTION_FAILURE);
    });

    it('should categorize unknown errors as unknown', () => {
      expect(() =>
        errorHandler.handleError(
          'some random error',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.UNKNOWN);
    });

    it('should clear category cache when threshold exceeded', () => {
      const clearSpy = jest.spyOn(Map.prototype, 'clear');
      errorHandler = new ScopeDslErrorHandler({
        ...validDependencies,
        config: { isDevelopment: false },
      });

      try {
        for (let i = 0; i < 105; i++) {
          try {
            errorHandler.handleError(
              `unique invalid error ${i}`,
              mockContext,
              'testResolver'
            );
          } catch (error) {
            expect(error).toBeInstanceOf(ScopeDslError);
          }
        }
        expect(clearSpy).toHaveBeenCalled();
      } finally {
        clearSpy.mockRestore();
      }
    });

    it('should classify general invalid messages as invalid data', () => {
      expect(() =>
        errorHandler.handleError(
          'The provided scope is invalid',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].category).toBe(ErrorCategories.INVALID_DATA);
    });
  });

  describe('context sanitization', () => {
    beforeEach(() => {
      errorHandler = new ScopeDslErrorHandler(validDependencies);
    });

    it('should sanitize circular references', () => {
      const circularContext = { name: 'test' };
      circularContext.self = circularContext; // Create circular reference

      expect(() =>
        errorHandler.handleError('test', circularContext, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext).toEqual({
        name: 'test',
        self: '[Circular Reference]',
      });
    });

    it('should handle functions in context', () => {
      const contextWithFunction = {
        data: 'test',
        fn: () => 'function',
      };

      expect(() =>
        errorHandler.handleError('test', contextWithFunction, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext.fn).toBe('[Function]');
    });

    it('should handle Error objects in context', () => {
      const contextWithError = {
        data: 'test',
        error: new Error('nested error'),
      };

      expect(() =>
        errorHandler.handleError('test', contextWithError, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext.error).toBe('nested error');
    });

    it('should limit array size in sanitization', () => {
      const contextWithLargeArray = {
        items: Array(10)
          .fill(0)
          .map((_, i) => ({ id: i })),
      };

      expect(() =>
        errorHandler.handleError('test', contextWithLargeArray, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext.items).toHaveLength(5); // Limited to 5 items
    });

    it('should limit object keys in sanitization', () => {
      const contextWithManyKeys = {};
      for (let i = 0; i < 15; i++) {
        contextWithManyKeys[`key${i}`] = `value${i}`;
      }

      expect(() =>
        errorHandler.handleError('test', contextWithManyKeys, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(Object.keys(buffer[0].sanitizedContext)).toHaveLength(10); // Limited to 10 keys
    });

    it('should handle null and undefined values', () => {
      const contextWithNulls = {
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'test',
      };

      expect(() =>
        errorHandler.handleError('test', contextWithNulls, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext.nullValue).toBe(null);
      expect(buffer[0].sanitizedContext.undefinedValue).toBe(undefined);
      expect(buffer[0].sanitizedContext.validValue).toBe('test');
    });

    it('should prevent deep recursion', () => {
      const deepContext = { level: 1 };
      let current = deepContext;
      for (let i = 2; i <= 10; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      expect(() =>
        errorHandler.handleError('test', deepContext, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      // Should be truncated at depth 3 (depth > 3 condition in code)
      const sanitized = buffer[0].sanitizedContext;
      expect(sanitized.nested.nested.nested.nested).toBe(
        '[Max Depth Exceeded]'
      );
    });

    it('should retain null and undefined within complex arrays', () => {
      const contextWithNullArray = {
        items: [null, undefined, 'value'],
      };

      expect(() =>
        errorHandler.handleError(
          'array with nulls',
          contextWithNullArray,
          'testResolver'
        )
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext.items).toEqual([
        null,
        undefined,
        'value',
      ]);
    });

    it('should capture inner sanitization failures', () => {
      const originalKeys = Object.keys;
      const problematic = new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('keys override trigger');
          },
        }
      );

      const contextWithProxy = { problematic };

      try {
        Object.keys = function keysOverride(target) {
          if (target === problematic) {
            throw new Error('keys override trigger');
          }
          return originalKeys(target);
        };

        expect(() =>
          errorHandler.handleError(
            'proxy sanitization failure',
            contextWithProxy,
            'testResolver'
          )
        ).toThrow(ScopeDslError);

        const buffer = errorHandler.getErrorBuffer();
        expect(buffer[0].sanitizedContext.problematic).toBe(
          '[Inner Sanitization Error: keys override trigger]'
        );
      } finally {
        Object.keys = originalKeys;
      }
    });

    it('should mark complex objects by constructor name', () => {
      class CustomClass {
        constructor() {
          this.value = 1;
        }
      }
      const complexContext = {
        element: new CustomClass(),
      };

      expect(() =>
        errorHandler.handleError('complex object', complexContext, 'resolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext.element).toBe('[CustomClass]');
    });

    it('should provide outer fallback when sanitization setup fails', () => {
      const OriginalWeakSet = globalThis.WeakSet;
      globalThis.WeakSet = class WeakSetFails {
        constructor() {
          throw new Error('weakset failure');
        }
      };

      try {
        expect(() =>
          errorHandler.handleError(
            'outer fallback',
            { nested: { value: 'test' } },
            'fallbackResolver'
          )
        ).toThrow(ScopeDslError);

        const buffer = errorHandler.getErrorBuffer();
        expect(buffer[0].sanitizedContext).toEqual(
          expect.objectContaining({
            error: 'Context sanitization completely failed',
            reason: 'weakset failure',
            type: 'object',
            hasKeys: true,
          })
        );
      } finally {
        globalThis.WeakSet = OriginalWeakSet;
      }
    });

    it('should treat array contexts as non-simple objects', () => {
      expect(() =>
        errorHandler.handleError('array context', [1, 2, 3], 'resolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext).toEqual([1, 2, 3]);
    });

    it('should treat non-plain objects as complex', () => {
      class Wrapper {}
      const wrappedContext = new Wrapper();
      wrappedContext.value = 'test';

      expect(() =>
        errorHandler.handleError('wrapped context', wrappedContext, 'resolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext).toEqual({ value: 'test' });
    });
  });

  describe('error buffer management', () => {
    beforeEach(() => {
      errorHandler = new ScopeDslErrorHandler(validDependencies);
    });

    it('should buffer errors', () => {
      expect(() =>
        errorHandler.handleError('first error', mockContext, 'resolver1')
      ).toThrow(ScopeDslError);
      expect(() =>
        errorHandler.handleError('second error', mockContext, 'resolver2')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer).toHaveLength(2);
      expect(buffer[0].message).toBe('first error');
      expect(buffer[1].message).toBe('second error');
    });

    it('should include timestamps in buffered errors', () => {
      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      ); // ISO format
    });

    it('should enforce buffer size limit', () => {
      const config = { maxBufferSize: 3 };
      errorHandler = new ScopeDslErrorHandler({ ...validDependencies, config });

      // Add 5 errors
      for (let i = 1; i <= 5; i++) {
        try {
          errorHandler.handleError(`error ${i}`, mockContext, 'testResolver');
        } catch {
          // Expected
        }
      }

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer).toHaveLength(3); // Should be limited to 3
      expect(buffer[0].message).toBe('error 4'); // Overwrote position 0 (was error 1)
      expect(buffer[1].message).toBe('error 5'); // Overwrote position 1 (was error 2)
      expect(buffer[2].message).toBe('error 3'); // Original position 2
    });

    it('should clear buffer when requested', () => {
      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      expect(errorHandler.getErrorBuffer()).toHaveLength(1);

      errorHandler.clearErrorBuffer();

      expect(errorHandler.getErrorBuffer()).toHaveLength(0);
    });

    it('should return copy of buffer, not reference', () => {
      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer1 = errorHandler.getErrorBuffer();
      const buffer2 = errorHandler.getErrorBuffer();

      expect(buffer1).toEqual(buffer2);
      expect(buffer1).not.toBe(buffer2); // Different object references
    });

    it('should warn when buffering fails and recover gracefully', () => {
      errorHandler = new ScopeDslErrorHandler({
        ...validDependencies,
        config: { isDevelopment: true },
      });

      const originalPush = Array.prototype.push;
      Array.prototype.push = function failingPush() {
        throw new Error('push failure');
      };

      try {
        expect(() =>
          errorHandler.handleError(
            'buffer failure',
            mockContext,
            'bufferResolver'
          )
        ).toThrow(ScopeDslError);
      } finally {
        Array.prototype.push = originalPush;
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error buffering failed:',
        'Buffer operation failed: push failure'
      );
      expect(errorHandler.getErrorBuffer()).toEqual([]);
    });
  });

  describe('error code generation', () => {
    beforeEach(() => {
      errorHandler = new ScopeDslErrorHandler(validDependencies);
    });

    it('should generate appropriate code for missing context', () => {
      expect(() =>
        errorHandler.handleError('missing context', {}, 'testResolver')
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe('SCOPE_1000');
    });

    it('should generate appropriate code for invalid data', () => {
      expect(() =>
        errorHandler.handleError(
          'invalid data format',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe('SCOPE_2000');
    });

    it('should generate appropriate code for resolution failure', () => {
      expect(() =>
        errorHandler.handleError(
          'resolution failed',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe('SCOPE_3000');
    });

    it('should generate appropriate code for cycle detected', () => {
      expect(() =>
        errorHandler.handleError('cycle detected', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe('SCOPE_4001');
    });

    it('should generate appropriate code for depth exceeded', () => {
      expect(() =>
        errorHandler.handleError('depth exceeded', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe('SCOPE_4002');
    });

    it('should generate appropriate code for parse error', () => {
      expect(() =>
        errorHandler.handleError('parse error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe('SCOPE_5000');
    });

    it('should generate appropriate code for configuration error', () => {
      expect(() =>
        errorHandler.handleError(
          'configuration error',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe('SCOPE_6000');
    });

    it('should generate unknown code for unrecognized errors', () => {
      expect(() =>
        errorHandler.handleError(
          'weird random error',
          mockContext,
          'testResolver'
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe('SCOPE_9000');
    });

    it('should use custom error code when provided', () => {
      const customCode = 'CUSTOM_123';
      expect(() =>
        errorHandler.handleError(
          'test',
          mockContext,
          'testResolver',
          customCode
        )
      ).toThrow(ScopeDslError);
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].code).toBe(customCode);
    });
  });

  describe('logging behavior', () => {
    it('should log detailed information in development mode', () => {
      const config = { isDevelopment: true };
      errorHandler = new ScopeDslErrorHandler({ ...validDependencies, config });

      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ScopeDSL:testResolver] test error',
        expect.objectContaining({
          code: expect.any(String),
          category: expect.any(String),
          context: expect.any(Object),
          timestamp: expect.any(String),
          stack: null, // String error has no stack
        })
      );
    });

    it('should log minimal information in production mode', () => {
      const config = { isDevelopment: false };
      errorHandler = new ScopeDslErrorHandler({ ...validDependencies, config });

      expect(() =>
        errorHandler.handleError('test error', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[ScopeDSL:testResolver\] SCOPE_\d+: test error$/
        )
      );
    });

    it('should include stack trace for Error objects in development', () => {
      const config = { isDevelopment: true };
      errorHandler = new ScopeDslErrorHandler({ ...validDependencies, config });
      const error = new Error('test error');

      expect(() =>
        errorHandler.handleError(error, mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ScopeDSL:testResolver] test error',
        expect.objectContaining({
          stack: expect.stringContaining('Error: test error'),
        })
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      errorHandler = new ScopeDslErrorHandler(validDependencies);
    });

    it('should handle non-string, non-Error error input', () => {
      const numberError = 12345;
      expect(() =>
        errorHandler.handleError(numberError, mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].message).toBe('12345');
    });

    it('should handle empty string error', () => {
      expect(() =>
        errorHandler.handleError('', mockContext, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].message).toBe('');
    });

    it('should handle resolver name with special characters', () => {
      const resolverName = 'my-special_resolver.v2';
      expect(() =>
        errorHandler.handleError('test', mockContext, resolverName)
      ).toThrow(ScopeDslError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(resolverName),
        expect.any(Object)
      );
    });

    it('should handle context sanitization errors gracefully', () => {
      const problematicContext = {
        get badProperty() {
          throw new Error('Property access error');
        },
      };

      expect(() =>
        errorHandler.handleError('test', problematicContext, 'testResolver')
      ).toThrow(ScopeDslError);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer[0].sanitizedContext.badProperty).toContain(
        '[Sanitization Error:'
      );
    });
  });
});
