/**
 * @file Comprehensive unit tests for ActionResult
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('ActionResult', () => {
  describe('Construction and Basic Properties', () => {
    it('should create a successful result with value', () => {
      const result = ActionResult.success('test value');

      expect(result.success).toBe(true);
      expect(result.value).toBe('test value');
      expect(result.errors).toEqual([]);
    });

    it('should create a failed result with single error', () => {
      const error = new Error('test error');
      const result = ActionResult.failure(error);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe(error);
    });

    it('should create a failed result with multiple errors', () => {
      const errors = [new Error('error 1'), new Error('error 2')];
      const result = ActionResult.failure(errors);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toEqual(errors);
    });

    it('should convert string errors to Error objects', () => {
      const result = ActionResult.failure('string error');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect(result.errors[0].message).toBe('string error');
    });

    it('should handle array of string errors', () => {
      const result = ActionResult.failure(['error 1', 'error 2']);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect(result.errors[0].message).toBe('error 1');
      expect(result.errors[1]).toBeInstanceOf(Error);
      expect(result.errors[1].message).toBe('error 2');
    });

    it('should be immutable', () => {
      const result = ActionResult.success('test');

      expect(() => {
        result.success = false;
      }).toThrow();

      expect(() => {
        result.value = 'new value';
      }).toThrow();

      expect(() => {
        result.errors = ['error'];
      }).toThrow();
    });

    it('should handle null and undefined values', () => {
      const nullResult = ActionResult.success(null);
      expect(nullResult.success).toBe(true);
      expect(nullResult.value).toBeNull();

      const undefinedResult = ActionResult.success(undefined);
      expect(undefinedResult.success).toBe(true);
      expect(undefinedResult.value).toBeNull(); // Default value is null
    });

    it('should handle complex value types', () => {
      const complexValue = {
        id: '123',
        data: { nested: true },
        array: [1, 2, 3],
      };
      const result = ActionResult.success(complexValue);

      expect(result.value).toEqual(complexValue);
      expect(result.value).toBe(complexValue); // Same reference
    });
  });

  describe('map function', () => {
    it('should transform successful result value', () => {
      const result = ActionResult.success(5);
      const mapped = result.map((x) => x * 2);

      expect(mapped.success).toBe(true);
      expect(mapped.value).toBe(10);
    });

    it('should not transform failed result', () => {
      const error = new Error('failed');
      const result = ActionResult.failure(error);
      const mapped = result.map((x) => x * 2);

      expect(mapped).toBe(result); // Same instance
      expect(mapped.success).toBe(false);
      expect(mapped.errors).toEqual([error]);
    });

    it('should handle transformation errors', () => {
      const result = ActionResult.success(5);
      const mapped = result.map(() => {
        throw new Error('transform error');
      });

      expect(mapped.success).toBe(false);
      expect(mapped.errors).toHaveLength(1);
      expect(mapped.errors[0].message).toBe('transform error');
    });

    it('should chain multiple map operations', () => {
      const result = ActionResult.success(2)
        .map((x) => x * 3)
        .map((x) => x + 1)
        .map((x) => `Result: ${x}`);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Result: 7');
    });

    it('should stop chain on first error', () => {
      const result = ActionResult.success(2)
        .map((x) => x * 3)
        .map(() => {
          throw new Error('chain error');
        })
        .map((x) => x + 1); // This should not execute

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('chain error');
    });
  });

  describe('flatMap function', () => {
    it('should chain successful operations', () => {
      const divide = (a, b) => {
        if (b === 0) {
          return ActionResult.failure('Division by zero');
        }
        return ActionResult.success(a / b);
      };

      const result = ActionResult.success(10)
        .flatMap((x) => divide(x, 2))
        .flatMap((x) => ActionResult.success(x + 1));

      expect(result.success).toBe(true);
      expect(result.value).toBe(6); // (10/2) + 1
    });

    it('should propagate failures in chain', () => {
      const divide = (a, b) => {
        if (b === 0) {
          return ActionResult.failure('Division by zero');
        }
        return ActionResult.success(a / b);
      };

      const result = ActionResult.success(10)
        .flatMap((x) => divide(x, 0))
        .flatMap((x) => ActionResult.success(x + 1)); // Should not execute

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('Division by zero');
    });

    it('should not execute on failed result', () => {
      let executed = false;
      const result = ActionResult.failure('initial error').flatMap(() => {
        executed = true;
        return ActionResult.success('should not happen');
      });

      expect(executed).toBe(false);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('initial error');
    });

    it('should handle non-ActionResult return values', () => {
      const result = ActionResult.success(5).flatMap((x) => x * 2); // Returns number, not ActionResult

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('must return an ActionResult');
    });

    it('should handle exceptions in flatMap function', () => {
      const result = ActionResult.success(5).flatMap(() => {
        throw new Error('flatMap error');
      });

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('flatMap error');
    });
  });

  describe('combine function', () => {
    it('should combine all successful results', () => {
      const results = [
        ActionResult.success(1),
        ActionResult.success(2),
        ActionResult.success(3),
      ];

      const combined = ActionResult.combine(results);

      expect(combined.success).toBe(true);
      expect(combined.value).toEqual([1, 2, 3]);
    });

    it('should fail if any result fails', () => {
      const results = [
        ActionResult.success(1),
        ActionResult.failure('error 2'),
        ActionResult.success(3),
      ];

      const combined = ActionResult.combine(results);

      expect(combined.success).toBe(false);
      expect(combined.errors).toHaveLength(1);
      expect(combined.errors[0].message).toBe('error 2');
    });

    it('should accumulate all errors', () => {
      const results = [
        ActionResult.failure('error 1'),
        ActionResult.success(2),
        ActionResult.failure(['error 3a', 'error 3b']),
      ];

      const combined = ActionResult.combine(results);

      expect(combined.success).toBe(false);
      expect(combined.errors).toHaveLength(3);
      expect(combined.errors[0].message).toBe('error 1');
      expect(combined.errors[1].message).toBe('error 3a');
      expect(combined.errors[2].message).toBe('error 3b');
    });

    it('should handle empty array', () => {
      const combined = ActionResult.combine([]);

      expect(combined.success).toBe(true);
      expect(combined.value).toEqual([]);
    });
  });

  describe('getOrThrow function', () => {
    it('should return value for successful result', () => {
      const result = ActionResult.success('test value');
      expect(result.getOrThrow()).toBe('test value');
    });

    it('should throw for failed result with single error', () => {
      const result = ActionResult.failure('test error');

      expect(() => result.getOrThrow()).toThrow(
        'ActionResult failure: test error'
      );
    });

    it('should throw with combined error messages', () => {
      const result = ActionResult.failure(['error 1', 'error 2']);

      expect(() => result.getOrThrow()).toThrow(
        'ActionResult failure: error 1; error 2'
      );
    });

    it('should handle errors without messages', () => {
      const error = { toString: () => 'custom error' };
      const result = ActionResult.failure(error);

      expect(() => result.getOrThrow()).toThrow(
        'ActionResult failure: custom error'
      );
    });
  });

  describe('getOrDefault function', () => {
    it('should return value for successful result', () => {
      const result = ActionResult.success('test value');
      expect(result.getOrDefault('default')).toBe('test value');
    });

    it('should return default for failed result', () => {
      const result = ActionResult.failure('error');
      expect(result.getOrDefault('default')).toBe('default');
    });

    it('should handle null and undefined defaults', () => {
      const result = ActionResult.failure('error');
      expect(result.getOrDefault(null)).toBeNull();
      expect(result.getOrDefault(undefined)).toBeUndefined();
    });

    it('should handle complex default values', () => {
      const defaultValue = { complex: true };
      const result = ActionResult.failure('error');
      expect(result.getOrDefault(defaultValue)).toBe(defaultValue);
    });
  });

  describe('ifSuccess and ifFailure functions', () => {
    it('should execute ifSuccess for successful result', () => {
      let executed = false;
      let receivedValue = null;

      const result = ActionResult.success('test');
      const chained = result.ifSuccess((value) => {
        executed = true;
        receivedValue = value;
      });

      expect(executed).toBe(true);
      expect(receivedValue).toBe('test');
      expect(chained).toBe(result); // Returns same instance for chaining
    });

    it('should not execute ifSuccess for failed result', () => {
      let executed = false;

      const result = ActionResult.failure('error');
      result.ifSuccess(() => {
        executed = true;
      });

      expect(executed).toBe(false);
    });

    it('should execute ifFailure for failed result', () => {
      let executed = false;
      let receivedErrors = null;

      const result = ActionResult.failure(['error 1', 'error 2']);
      const chained = result.ifFailure((errors) => {
        executed = true;
        receivedErrors = errors;
      });

      expect(executed).toBe(true);
      expect(receivedErrors).toHaveLength(2);
      expect(receivedErrors[0].message).toBe('error 1');
      expect(chained).toBe(result); // Returns same instance for chaining
    });

    it('should not execute ifFailure for successful result', () => {
      let executed = false;

      const result = ActionResult.success('value');
      result.ifFailure(() => {
        executed = true;
      });

      expect(executed).toBe(false);
    });

    it('should allow chaining ifSuccess and ifFailure', () => {
      let successLog = '';
      let failureLog = '';

      ActionResult.success('test')
        .ifSuccess((v) => (successLog = `Success: ${v}`))
        .ifFailure(() => (failureLog = 'Failed'));

      expect(successLog).toBe('Success: test');
      expect(failureLog).toBe('');

      ActionResult.failure('error')
        .ifSuccess(() => (successLog = 'Should not happen'))
        .ifFailure((errors) => (failureLog = `Failed: ${errors[0].message}`));

      expect(successLog).toBe('Success: test'); // Unchanged
      expect(failureLog).toBe('Failed: error');
    });
  });

  describe('JSON serialization', () => {
    it('should serialize successful result', () => {
      const result = ActionResult.success({ id: 123, name: 'test' });
      const json = result.toJSON();

      expect(json).toEqual({
        success: true,
        value: { id: 123, name: 'test' },
        errors: [],
      });
    });

    it('should serialize failed result with error details', () => {
      const error = new Error('test error');
      error.code = 'TEST_ERROR';
      error.context = { detail: 'additional info' };

      const result = ActionResult.failure(error);
      const json = result.toJSON();

      expect(json.success).toBe(false);
      expect(json.value).toBeNull();
      expect(json.errors).toHaveLength(1);
      expect(json.errors[0]).toMatchObject({
        message: 'test error',
        name: 'Error',
        code: 'TEST_ERROR',
        context: { detail: 'additional info' },
      });
      expect(json.errors[0].stack).toBeDefined();
    });

    it('should deserialize from JSON', () => {
      const json = {
        success: false,
        value: null,
        errors: [
          {
            message: 'test error',
            name: 'CustomError',
            code: 'ERR_001',
            context: { foo: 'bar' },
          },
        ],
      };

      const result = ActionResult.fromJSON(json);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('test error');
      expect(result.errors[0].name).toBe('CustomError');
      expect(result.errors[0].code).toBe('ERR_001');
      expect(result.errors[0].context).toEqual({ foo: 'bar' });
    });

    it('should handle round-trip serialization', () => {
      const original = ActionResult.failure([
        'error 1',
        (() => {
          const e = new Error('error 2');
          e.code = 'E2';
          return e;
        })(),
      ]);

      const json = original.toJSON();
      const restored = ActionResult.fromJSON(json);

      expect(restored.success).toBe(original.success);
      expect(restored.errors).toHaveLength(original.errors.length);
      expect(restored.errors[0].message).toBe('error 1');
      expect(restored.errors[1].message).toBe('error 2');
      expect(restored.errors[1].code).toBe('E2');
    });

    it('should handle missing optional fields in fromJSON', () => {
      const minimal = { success: true, value: 'test' };
      const result = ActionResult.fromJSON(minimal);

      expect(result.success).toBe(true);
      expect(result.value).toBe('test');
      expect(result.errors).toEqual([]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle circular references in values', () => {
      const circular = { name: 'test' };
      circular.self = circular;

      const result = ActionResult.success(circular);
      expect(result.value).toBe(circular);

      // JSON serialization should be handled by caller
      expect(() => JSON.stringify(result.toJSON())).toThrow();
    });

    it('should handle very large error arrays', () => {
      const manyErrors = Array(1000)
        .fill(null)
        .map((_, i) => `Error ${i}`);
      const result = ActionResult.failure(manyErrors);

      expect(result.errors).toHaveLength(1000);
      expect(result.errors[0].message).toBe('Error 0');
      expect(result.errors[999].message).toBe('Error 999');
    });

    it('should preserve error instance types when possible', () => {
      class CustomError extends Error {
        constructor(message, code) {
          super(message);
          this.name = 'CustomError';
          this.code = code;
        }
      }

      const error = new CustomError('custom', 'CUST_001');
      const result = ActionResult.failure(error);

      expect(result.errors[0]).toBe(error); // Same instance
      expect(result.errors[0]).toBeInstanceOf(CustomError);
      expect(result.errors[0].code).toBe('CUST_001');
    });
  });

  describe('Type Safety and Validation', () => {
    it('should handle mixed error types', () => {
      const mixedErrors = [
        'string error',
        new Error('Error object'),
        { message: 'plain object', custom: true },
        null,
        undefined,
        123,
      ];

      const result = ActionResult.failure(mixedErrors);

      expect(result.errors).toHaveLength(6);
      expect(result.errors[0].message).toBe('string error');
      expect(result.errors[1].message).toBe('Error object');
      expect(result.errors[2].message).toBe('plain object');
      expect(result.errors[2].custom).toBe(true); // Additional properties preserved
      expect(result.errors[3].message).toBe('null');
      expect(result.errors[4].message).toBe('undefined');
      expect(result.errors[5].message).toBe('123');
    });

    it('should provide consistent interfaces for method chaining', () => {
      const pipeline = ActionResult.success(1)
        .map((x) => x + 1)
        .flatMap((x) => ActionResult.success(x * 2))
        .map((x) => x.toString())
        .ifSuccess((v) => expect(v).toBe('4'))
        .ifFailure(() => fail('Should not fail'));

      expect(pipeline).toBeInstanceOf(ActionResult);
    });
  });
});
