import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { ErrorContext } from '../../../src/errors/ErrorContext.js';
import BaseError from '../../../src/errors/baseError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

describe('ErrorContext - Utility Functions', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('extract', () => {
    it('should extract context from BaseError instances', () => {
      const baseError = new BaseError(
        'Test error',
        ErrorCodes.INVALID_DATA_GENERIC,
        {
          field: 'email',
          value: 'invalid@',
        }
      );

      const context = ErrorContext.extract(baseError);

      expect(context).toMatchObject({
        errorType: 'BaseError',
        message: 'Test error',
        code: ErrorCodes.INVALID_DATA_GENERIC,
        severity: 'error',
        recoverable: false,
        timestamp: expect.any(Number),
        originalContext: {
          field: 'email',
          value: 'invalid@',
        },
        correlationId: expect.any(String),
        stack: expect.any(String),
      });
    });

    it('should extract context from regular Error instances', () => {
      const error = new Error('Regular error');

      const context = ErrorContext.extract(error);

      expect(context).toMatchObject({
        errorType: 'Error',
        message: 'Regular error',
        timestamp: expect.any(Number),
        stack: expect.any(String),
      });
    });

    it('should handle errors with cause chains', () => {
      const rootCause = new Error('Root cause');
      const middleError = new Error('Middle error');
      middleError.cause = rootCause;

      const topError = new BaseError(
        'Top error',
        ErrorCodes.INVALID_DATA_GENERIC
      );
      topError.cause = middleError;

      const context = ErrorContext.extract(topError);

      expect(context.cause).toMatchObject({
        errorType: 'Error',
        message: 'Middle error',
      });
      expect(context.cause.cause).toMatchObject({
        errorType: 'Error',
        message: 'Root cause',
      });
    });

    it('should return empty object for null/undefined errors', () => {
      expect(ErrorContext.extract(null)).toEqual({});
      expect(ErrorContext.extract(undefined)).toEqual({});
    });
  });

  describe('enhance', () => {
    it('should enhance BaseError instances using addContext', () => {
      const baseError = new BaseError(
        'Test error',
        ErrorCodes.INVALID_DATA_GENERIC,
        {
          original: 'context',
        }
      );

      const additionalContext = {
        userId: 'user123',
        sessionId: 'session456',
      };

      const enhanced = ErrorContext.enhance(baseError, additionalContext);

      expect(enhanced).toBe(baseError); // Same instance
      expect(enhanced.getContext('userId')).toBe('user123');
      expect(enhanced.getContext('sessionId')).toBe('session456');
      expect(enhanced.getContext('original')).toBe('context');
    });

    it('should enhance regular Error instances by adding properties', () => {
      const error = new Error('Regular error');
      const additionalContext = {
        userId: 'user123',
        operation: 'test',
      };

      const enhanced = ErrorContext.enhance(error, additionalContext);

      expect(enhanced).toBe(error); // Same instance
      expect(enhanced.userId).toBe('user123');
      expect(enhanced.operation).toBe('test');
    });

    it('should handle frozen/sealed error objects gracefully', () => {
      const error = new Error('Sealed error');
      Object.seal(error);

      const additionalContext = { userId: 'user123' };

      // Should not throw
      const enhanced = ErrorContext.enhance(error, additionalContext);
      expect(enhanced).toBe(error);
    });

    it('should require error parameter', () => {
      expect(() => {
        ErrorContext.enhance(null, { test: 'context' });
      }).toThrow('ErrorContext.enhance: error parameter is required');
    });

    it('should handle invalid additional context gracefully', () => {
      const error = new Error('Test error');

      expect(ErrorContext.enhance(error, null)).toBe(error);
      expect(ErrorContext.enhance(error, undefined)).toBe(error);
      expect(ErrorContext.enhance(error, 'invalid')).toBe(error);
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate unique correlation IDs with default prefix', () => {
      const id1 = ErrorContext.generateCorrelationId();
      const id2 = ErrorContext.generateCorrelationId();

      expect(id1).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate correlation IDs with custom prefix', () => {
      const id = ErrorContext.generateCorrelationId('test');

      expect(id).toMatch(/^test_\d+_[a-z0-9]+$/);
    });

    it('should handle invalid prefix by using default', () => {
      expect(ErrorContext.generateCorrelationId('')).toMatch(
        /^err_\d+_[a-z0-9]+$/
      );
      expect(ErrorContext.generateCorrelationId(null)).toMatch(
        /^err_\d+_[a-z0-9]+$/
      );
    });
  });

  describe('sanitize', () => {
    it('should sanitize simple objects', () => {
      const context = {
        message: 'test message',
        timestamp: Date.now(),
        userId: 'user123',
      };

      const sanitized = ErrorContext.sanitize(context);
      expect(sanitized).toEqual(context);
    });

    it('should remove functions and undefined values', () => {
      const context = {
        message: 'test',
        callback: () => {},
        undefinedValue: undefined,
        nullValue: null,
        number: 42,
      };

      const sanitized = ErrorContext.sanitize(context);

      expect(sanitized).toEqual({
        message: 'test',
        nullValue: null,
        number: 42,
      });
    });

    it('should redact sensitive information', () => {
      const context = {
        message: 'test',
        password: 'secret123',
        apiKey: 'key123',
        authToken: 'token123',
        sessionCookie: 'cookie123',
        normalField: 'safe',
      };

      const sanitized = ErrorContext.sanitize(context);

      expect(sanitized).toEqual({
        message: 'test',
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        authToken: '[REDACTED]',
        sessionCookie: '[REDACTED]',
        normalField: 'safe',
      });
    });

    it('should handle nested objects with depth limit', () => {
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: 'too deep',
                },
              },
            },
          },
        },
      };

      const sanitized = ErrorContext.sanitize(deeplyNested, 3);

      expect(sanitized.level1.level2.level3).toBe('[MAX_DEPTH_EXCEEDED]');
    });

    it('should handle circular references', () => {
      const obj = { name: 'test' };
      obj.self = obj;

      const sanitized = ErrorContext.sanitize(obj);

      expect(sanitized.name).toBe('test');
      expect(sanitized.self).toBe('[CIRCULAR_REFERENCE]');
    });

    it('should handle arrays properly', () => {
      const context = {
        items: ['item1', 'item2', { nested: 'value' }],
        numbers: [1, 2, 3],
      };

      const sanitized = ErrorContext.sanitize(context);

      expect(sanitized.items).toEqual(['item1', 'item2', { nested: 'value' }]);
      expect(sanitized.numbers).toEqual([1, 2, 3]);
    });

    it('should handle Date objects', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const context = { timestamp: date };

      const sanitized = ErrorContext.sanitize(context);

      expect(sanitized.timestamp).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error');
      const context = { error };

      const sanitized = ErrorContext.sanitize(context);

      expect(sanitized.error).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String),
      });
    });

    it('should return empty object for invalid input', () => {
      expect(ErrorContext.sanitize(null)).toEqual({});
      expect(ErrorContext.sanitize(undefined)).toEqual({});
      expect(ErrorContext.sanitize('string')).toEqual({});
    });
  });

  describe('merge', () => {
    it('should merge multiple context objects', () => {
      const context1 = { userId: 'user123', operation: 'create' };
      const context2 = { sessionId: 'session456', timestamp: 12345 };
      const context3 = { component: 'validator' };

      const merged = ErrorContext.merge(context1, context2, context3);

      expect(merged).toEqual({
        userId: 'user123',
        operation: 'create',
        sessionId: 'session456',
        timestamp: 12345,
        component: 'validator',
      });
    });

    it('should handle overlapping keys (later values win)', () => {
      const context1 = { key: 'value1', unique1: 'a' };
      const context2 = { key: 'value2', unique2: 'b' };

      const merged = ErrorContext.merge(context1, context2);

      expect(merged).toEqual({
        key: 'value2',
        unique1: 'a',
        unique2: 'b',
      });
    });

    it('should skip invalid context objects', () => {
      const validContext = { valid: 'value' };

      const merged = ErrorContext.merge(
        null,
        undefined,
        'invalid',
        validContext,
        123
      );

      expect(merged).toEqual({ valid: 'value' });
    });

    it('should ignore non-string keys', () => {
      const context = {
        validKey: 'valid',
        '': 'empty key should be ignored', // Empty string should be ignored by isNonBlankString
      };

      const merged = ErrorContext.merge(context);

      expect(merged).toEqual({
        validKey: 'valid',
        // Empty string key should be excluded by isNonBlankString
      });
    });
  });

  describe('createSnapshot', () => {
    it('should create context snapshot with operation', () => {
      const snapshot = ErrorContext.createSnapshot('userLogin', {
        userId: 'user123',
        ip: '192.168.1.1',
      });

      expect(snapshot).toMatchObject({
        operation: 'userLogin',
        userId: 'user123',
        ip: '192.168.1.1',
        snapshotId: expect.stringMatching(/^snapshot_\d+_[a-z0-9]+$/),
        timestamp: expect.any(Number),
        userAgent: expect.any(String), // In jsdom environment, will have a value
        url: expect.any(String), // In jsdom environment, will have a value
      });
    });

    it('should require operation parameter', () => {
      expect(() => {
        ErrorContext.createSnapshot('', {});
      }).toThrow(
        'ErrorContext.createSnapshot: operation parameter is required'
      );

      expect(() => {
        ErrorContext.createSnapshot(null);
      }).toThrow(
        'ErrorContext.createSnapshot: operation parameter is required'
      );
    });

    it('should merge additional context', () => {
      const additionalContext = {
        userId: 'user123',
        sessionId: 'session456',
      };

      const snapshot = ErrorContext.createSnapshot(
        'testOperation',
        additionalContext
      );

      expect(snapshot.operation).toBe('testOperation');
      expect(snapshot.userId).toBe('user123');
      expect(snapshot.sessionId).toBe('session456');
    });
  });
});
