import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import BaseError from '../../../src/errors/baseError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

describe('BaseError - Foundation Class', () => {
  let testBed;
  let originalCaptureStackTrace;

  beforeEach(() => {
    testBed = createTestBed();
    originalCaptureStackTrace = Error.captureStackTrace;
  });

  afterEach(() => {
    testBed.cleanup();
    Error.captureStackTrace = originalCaptureStackTrace;
  });

  describe('Constructor', () => {
    it('should create error with required parameters', () => {
      const error = new BaseError(
        'Test message',
        ErrorCodes.INVALID_DATA_GENERIC,
        { field: 'test' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.name).toBe('BaseError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe(ErrorCodes.INVALID_DATA_GENERIC);
      expect(error.context).toEqual({ field: 'test' });
      expect(error.severity).toBe('error');
      expect(error.recoverable).toBe(false);
      expect(error.correlationId).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });

    it('should throw error for missing message', () => {
      expect(() => {
        new BaseError('', ErrorCodes.INVALID_DATA_GENERIC, {});
      }).toThrow(Error);

      expect(() => {
        new BaseError(null, ErrorCodes.INVALID_DATA_GENERIC, {});
      }).toThrow(Error);

      expect(() => {
        new BaseError(undefined, ErrorCodes.INVALID_DATA_GENERIC, {});
      }).toThrow(Error);
    });

    it('should throw error for missing code', () => {
      expect(() => {
        new BaseError('Test message', '', {});
      }).toThrow(Error);

      expect(() => {
        new BaseError('Test message', null, {});
      }).toThrow(Error);

      expect(() => {
        new BaseError('Test message', undefined, {});
      }).toThrow(Error);
    });

    it('should accept null or undefined context defaulting to empty object', () => {
      const error1 = new BaseError(
        'Test message',
        ErrorCodes.INVALID_DATA_GENERIC,
        null
      );
      expect(error1.context).toEqual({});

      const error2 = new BaseError(
        'Test message',
        ErrorCodes.INVALID_DATA_GENERIC,
        undefined
      );
      expect(error2.context).toEqual({});

      const error3 = new BaseError(
        'Test message',
        ErrorCodes.INVALID_DATA_GENERIC
      );
      expect(error3.context).toEqual({});
    });

    it('should use existing error codes from ErrorCodes', () => {
      const error = new BaseError(
        'Connection failed',
        ErrorCodes.CONNECTION_FAILED,
        { service: 'database' }
      );

      expect(error.code).toBe(ErrorCodes.CONNECTION_FAILED);
      expect(error.code).toBe('SCOPE_3010');
    });

    it('should generate UUID correlation ID', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});
      const correlationId = error.correlationId;

      // Check UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(correlationId).toMatch(uuidRegex);
    });

    it('should accept custom correlation ID in options', () => {
      const customId = 'custom-correlation-id-123';
      const error = new BaseError(
        'Test',
        ErrorCodes.INVALID_DATA_GENERIC,
        {},
        { correlationId: customId }
      );

      expect(error.correlationId).toBe(customId);
    });

    it('should create different correlation IDs for different errors', () => {
      const error1 = new BaseError(
        'Test 1',
        ErrorCodes.INVALID_DATA_GENERIC,
        {}
      );
      const error2 = new BaseError(
        'Test 2',
        ErrorCodes.INVALID_DATA_GENERIC,
        {}
      );

      expect(error1.correlationId).not.toBe(error2.correlationId);
    });

    it('should capture stack trace in V8 environments', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BaseError');
    });

    it('should handle missing captureStackTrace gracefully', () => {
      Error.captureStackTrace = undefined;
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});

      expect(error).toBeInstanceOf(BaseError);
      expect(error.stack).toBeDefined(); // Stack should still exist from Error constructor
    });
  });

  describe('Serialization (ModValidationError pattern)', () => {
    it('should serialize to JSON correctly with all properties', () => {
      const context = { field: 'username', value: 'test' };
      const error = new BaseError(
        'Test error',
        ErrorCodes.INVALID_DATA_GENERIC,
        context
      );
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'BaseError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('code', ErrorCodes.INVALID_DATA_GENERIC);
      expect(json).toHaveProperty('context', context);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'error');
      expect(json).toHaveProperty('recoverable', false);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');

      // Verify timestamp is ISO format
      expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
    });

    it('should format toString with enhanced pattern', () => {
      const error = new BaseError(
        'Test error',
        ErrorCodes.INVALID_DATA_GENERIC,
        { field: 'test' }
      );
      const str = error.toString();

      expect(str).toBe(
        'BaseError[SCOPE_2000]: Test error (severity: error, recoverable: false)'
      );
    });

    it('should include correlation ID in serialization', () => {
      const customId = 'test-correlation-123';
      const error = new BaseError(
        'Test',
        ErrorCodes.INVALID_DATA_GENERIC,
        {},
        { correlationId: customId }
      );
      const json = error.toJSON();

      expect(json.correlationId).toBe(customId);
    });
  });

  describe('Context Management', () => {
    it('should allow context addition with validation', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});

      error.addContext('userId', '12345');
      error.addContext('operation', 'save');

      expect(error.context.userId).toBe('12345');
      expect(error.context.operation).toBe('save');
    });

    it('should return defensive copy of context', () => {
      const originalContext = { field: 'test' };
      const error = new BaseError(
        'Test',
        ErrorCodes.INVALID_DATA_GENERIC,
        originalContext
      );

      const context1 = error.context;
      const context2 = error.context;

      expect(context1).toEqual(originalContext);
      expect(context2).toEqual(originalContext);
      expect(context1).not.toBe(context2); // Different object references
      expect(context1).not.toBe(originalContext); // Not the original object

      // Modifying returned context should not affect error's context
      context1.newField = 'modified';
      expect(error.context.newField).toBeUndefined();
    });

    it('should support fluent interface for context addition', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});

      const result = error
        .addContext('step1', 'value1')
        .addContext('step2', 'value2')
        .addContext('step3', 'value3');

      expect(result).toBe(error); // Same instance
      expect(error.context).toEqual({
        step1: 'value1',
        step2: 'value2',
        step3: 'value3',
      });
    });

    it('should throw error for invalid context key', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});

      expect(() => error.addContext('', 'value')).toThrow(Error);
      expect(() => error.addContext(null, 'value')).toThrow(Error);
      expect(() => error.addContext(undefined, 'value')).toThrow(Error);
    });

    it('should get specific context value', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {
        field: 'username',
        action: 'validate',
      });

      expect(error.getContext('field')).toBe('username');
      expect(error.getContext('action')).toBe('validate');
      expect(error.getContext('nonexistent')).toBeUndefined();
    });

    it('should get entire context when key is null', () => {
      const originalContext = { field: 'username', action: 'validate' };
      const error = new BaseError(
        'Test',
        ErrorCodes.INVALID_DATA_GENERIC,
        originalContext
      );

      const context = error.getContext();
      expect(context).toEqual(originalContext);
      expect(context).not.toBe(originalContext); // Defensive copy

      // Modifying returned context should not affect error's context
      context.modified = true;
      expect(error.getContext().modified).toBeUndefined();
    });
  });

  describe('Abstract Methods', () => {
    it('should allow severity override in subclass', () => {
      class CustomError extends BaseError {
        getSeverity() {
          return 'warning';
        }
      }

      const error = new CustomError(
        'Test',
        ErrorCodes.INVALID_DATA_GENERIC,
        {}
      );
      expect(error.severity).toBe('warning');
    });

    it('should allow recoverability override in subclass', () => {
      class RecoverableError extends BaseError {
        isRecoverable() {
          return true;
        }
      }

      const error = new RecoverableError(
        'Test',
        ErrorCodes.INVALID_DATA_GENERIC,
        {}
      );
      expect(error.recoverable).toBe(true);
    });

    it('should call abstract methods in constructor', () => {
      let severityCalled = false;
      let recoverableCalled = false;

      class TestError extends BaseError {
        getSeverity() {
          severityCalled = true;
          return 'critical';
        }

        isRecoverable() {
          recoverableCalled = true;
          return false;
        }
      }

      const error = new TestError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});

      expect(severityCalled).toBe(true);
      expect(recoverableCalled).toBe(true);
      expect(error.severity).toBe('critical');
      expect(error.recoverable).toBe(false);
    });
  });

  describe('Integration with Existing Infrastructure', () => {
    it('should work with existing ErrorCodes', () => {
      // Test various error code categories
      const errors = [
        new BaseError(
          'Context missing',
          ErrorCodes.MISSING_CONTEXT_GENERIC,
          {}
        ),
        new BaseError('Invalid data', ErrorCodes.INVALID_DATA_GENERIC, {}),
        new BaseError(
          'Resolution failed',
          ErrorCodes.RESOLUTION_FAILED_GENERIC,
          {}
        ),
        new BaseError('Cycle detected', ErrorCodes.CYCLE_DETECTED, {}),
        new BaseError('Parse error', ErrorCodes.PARSE_ERROR_GENERIC, {}),
        new BaseError('Config error', ErrorCodes.CONFIGURATION_GENERIC, {}),
        new BaseError('Unknown error', ErrorCodes.UNKNOWN_GENERIC, {}),
      ];

      expect(errors[0].code).toBe('SCOPE_1000');
      expect(errors[1].code).toBe('SCOPE_2000');
      expect(errors[2].code).toBe('SCOPE_3000');
      expect(errors[3].code).toBe('SCOPE_4001');
      expect(errors[4].code).toBe('SCOPE_5000');
      expect(errors[5].code).toBe('SCOPE_6000');
      expect(errors[6].code).toBe('SCOPE_9000');
    });

    it('should follow ModValidationError timestamp pattern', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});
      const timestamp = error.timestamp;

      // Verify ISO format
      expect(timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );

      // Verify it's a valid date
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);

      // Verify it's recent (within last second)
      const now = Date.now();
      const errorTime = date.getTime();
      expect(now - errorTime).toBeLessThan(1000);
    });

    it('should capture stack trace like existing errors', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BaseError');
      expect(error.stack).toContain('Test');

      // Stack should not include constructor internals
      const json = error.toJSON();
      expect(json.stack).toBe(error.stack);
    });
  });

  describe('Edge Cases and Advanced Scenarios', () => {
    it('should handle empty context object', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});
      expect(error.context).toEqual({});
    });

    it('should generate unique correlation ID for each instance', () => {
      const error1 = new BaseError('Error 1', ErrorCodes.INVALID_DATA_GENERIC);
      const error2 = new BaseError('Error 2', ErrorCodes.INVALID_DATA_GENERIC);

      expect(error1.correlationId).toBeDefined();
      expect(error2.correlationId).toBeDefined();
      expect(error1.correlationId).not.toBe(error2.correlationId);

      // Both should be valid UUIDs
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(error1.correlationId).toMatch(uuidRegex);
      expect(error2.correlationId).toMatch(uuidRegex);
    });

    it('should capture timestamp at creation time', () => {
      const beforeTime = new Date().toISOString();
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC);
      const afterTime = new Date().toISOString();

      expect(new Date(error.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
      expect(new Date(error.timestamp).getTime()).toBeLessThanOrEqual(
        new Date(afterTime).getTime()
      );
    });

    it('should set default severity and recoverability', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC);

      expect(error.severity).toBe('error');
      expect(error.recoverable).toBe(false);
    });

    it('should capture stack trace in V8 environments with proper filtering', () => {
      const error = new BaseError(
        'Test message',
        ErrorCodes.INVALID_DATA_GENERIC
      );

      if (Error.captureStackTrace) {
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('Test message');
        expect(error.stack).not.toContain('captureStackTrace');
      }
    });

    it('should handle complex context objects', () => {
      const complexContext = {
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
        nullValue: null,
        undefinedValue: undefined,
        boolValue: false,
        numberValue: 0,
      };

      const error = new BaseError(
        'Test',
        ErrorCodes.INVALID_DATA_GENERIC,
        complexContext
      );
      expect(error.context).toEqual(complexContext);

      // Verify defensive copy works for nested objects
      const context = error.context;
      context.nested.deep.value = 'modified';
      expect(error.context.nested.deep.value).toBe('test');
    });

    it('should maintain error name when extended', () => {
      class ValidationError extends BaseError {
        constructor(message, context = {}) {
          super(message, ErrorCodes.INVALID_DATA_GENERIC, context);
        }
      }

      const error = new ValidationError('Validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.toString()).toContain('ValidationError');
    });

    it('should handle concurrent error creation', () => {
      const errors = [];
      for (let i = 0; i < 100; i++) {
        errors.push(
          new BaseError(`Error ${i}`, ErrorCodes.INVALID_DATA_GENERIC, {
            index: i,
          })
        );
      }

      // All errors should have unique correlation IDs
      const correlationIds = errors.map((e) => e.correlationId);
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(100);

      // All errors should have proper context
      errors.forEach((error, index) => {
        expect(error.context.index).toBe(index);
      });
    });

    it('should preserve error prototype chain', () => {
      const error = new BaseError('Test', ErrorCodes.INVALID_DATA_GENERIC, {});

      expect(error instanceof BaseError).toBe(true);
      expect(error instanceof Error).toBe(true);
      expect(Object.getPrototypeOf(error)).toBe(BaseError.prototype);
      expect(Object.getPrototypeOf(BaseError.prototype)).toBe(Error.prototype);
    });
  });

  describe('Inheritance Patterns', () => {
    it('should maintain instanceof relationships in subclasses', () => {
      class CustomError extends BaseError {
        constructor(message) {
          super(message, 'CUSTOM_ERROR');
          this.name = 'CustomError';
        }
        getSeverity() {
          return 'warning';
        }
        isRecoverable() {
          return true;
        }
      }

      const error = new CustomError('Custom message');

      expect(error instanceof CustomError).toBe(true);
      expect(error instanceof BaseError).toBe(true);
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('CustomError');
      expect(error.severity).toBe('warning');
      expect(error.recoverable).toBe(true);
    });

    it('should allow severity override in subclass', () => {
      class CriticalError extends BaseError {
        getSeverity() {
          return 'critical';
        }
      }

      class WarningError extends BaseError {
        getSeverity() {
          return 'warning';
        }
      }

      const critical = new CriticalError(
        'Critical',
        ErrorCodes.INVALID_DATA_GENERIC
      );
      const warning = new WarningError(
        'Warning',
        ErrorCodes.INVALID_DATA_GENERIC
      );

      expect(critical.severity).toBe('critical');
      expect(warning.severity).toBe('warning');
    });

    it('should allow recoverability override in subclass', () => {
      class RecoverableError extends BaseError {
        isRecoverable() {
          return true;
        }
      }

      class NonRecoverableError extends BaseError {
        isRecoverable() {
          return false;
        }
      }

      const recoverable = new RecoverableError(
        'Recoverable',
        ErrorCodes.INVALID_DATA_GENERIC
      );
      const nonRecoverable = new NonRecoverableError(
        'NonRecoverable',
        ErrorCodes.INVALID_DATA_GENERIC
      );

      expect(recoverable.recoverable).toBe(true);
      expect(nonRecoverable.recoverable).toBe(false);
    });
  });
});
