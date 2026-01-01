/**
 * @file Unit tests for error normalization utilities.
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeError,
  safeAugmentError,
} from '../../../src/utils/errorNormalization.js';

describe('normalizeError', () => {
  describe('Error pass-through', () => {
    it('should return the same Error instance unchanged', () => {
      const originalError = new Error('original message');
      const result = normalizeError(originalError);
      expect(result).toBe(originalError);
    });

    it('should preserve error message on pass-through', () => {
      const originalError = new Error('original message');
      const result = normalizeError(originalError);
      expect(result.message).toBe('original message');
    });

    it('should preserve error stack on pass-through', () => {
      const originalError = new Error('original message');
      const result = normalizeError(originalError);
      expect(result.stack).toBe(originalError.stack);
    });

    it('should not double-wrap already normalized errors', () => {
      const firstPass = normalizeError('string error');
      const secondPass = normalizeError(firstPass);
      expect(secondPass).toBe(firstPass);
    });
  });

  describe('String conversion', () => {
    it('should convert string to Error with string as message', () => {
      const result = normalizeError('error message');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('error message');
    });

    it('should handle empty string', () => {
      const result = normalizeError('');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('');
    });

    it('should handle multiline strings', () => {
      const multiline = 'line 1\nline 2\nline 3';
      const result = normalizeError(multiline);
      expect(result.message).toBe(multiline);
    });
  });

  describe('Number conversion', () => {
    it('should convert number to Error with stringified message', () => {
      const result = normalizeError(42);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('42');
    });

    it('should handle zero', () => {
      const result = normalizeError(0);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('0');
    });

    it('should handle negative numbers', () => {
      const result = normalizeError(-100);
      expect(result.message).toBe('-100');
    });

    it('should handle NaN', () => {
      const result = normalizeError(NaN);
      expect(result.message).toBe('NaN');
    });

    it('should handle Infinity', () => {
      const result = normalizeError(Infinity);
      expect(result.message).toBe('Infinity');
    });
  });

  describe('Object conversion', () => {
    it('should convert plain object to Error with [object Object] message', () => {
      const result = normalizeError({ foo: 'bar' });
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('[object Object]');
    });

    it('should use custom toString if available', () => {
      const objWithToString = {
        toString() {
          return 'custom error message';
        },
      };
      const result = normalizeError(objWithToString);
      expect(result.message).toBe('custom error message');
    });

    it('should handle arrays', () => {
      const result = normalizeError([1, 2, 3]);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('1,2,3');
    });
  });

  describe('Null and undefined handling', () => {
    it('should convert null to Error with "null" message', () => {
      const result = normalizeError(null);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('null');
    });

    it('should convert undefined to Error with "undefined" message', () => {
      const result = normalizeError(undefined);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('undefined');
    });
  });

  describe('Boolean handling', () => {
    it('should convert true to Error with "true" message', () => {
      const result = normalizeError(true);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('true');
    });

    it('should convert false to Error with "false" message', () => {
      const result = normalizeError(false);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('false');
    });
  });

  describe('Symbol handling', () => {
    it('should convert Symbol to Error', () => {
      const sym = Symbol('test');
      const result = normalizeError(sym);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Symbol(test)');
    });
  });

  describe('Context attachment', () => {
    it('should attach context property when provided', () => {
      const result = normalizeError('error', 'contextValue');
      expect(result.context).toBe('contextValue');
    });

    it('should not attach context property when empty string', () => {
      const result = normalizeError('error', '');
      expect(result.context).toBeUndefined();
    });

    it('should not attach context property when not provided', () => {
      const result = normalizeError('error');
      expect(result.context).toBeUndefined();
    });

    it('should not modify original Error when context provided', () => {
      const originalError = new Error('original');
      const result = normalizeError(originalError, 'context');
      expect(result).toBe(originalError);
      // Context is not attached to pre-existing Error instances
      // This preserves the original behavior of pass-through
    });
  });

  describe('Never throws invariant', () => {
    it('should never throw regardless of input', () => {
      const testCases = [
        null,
        undefined,
        '',
        0,
        NaN,
        Infinity,
        -Infinity,
        {},
        [],
        () => {},
        Symbol('test'),
        new Error('test'),
        BigInt(9007199254740991),
      ];

      testCases.forEach((input) => {
        expect(() => normalizeError(input)).not.toThrow();
      });
    });

    it('should handle object that throws in toString', () => {
      const badObject = {
        toString() {
          throw new Error('toString exploded');
        },
      };
      // String() will catch the toString error and return a default representation
      expect(() => normalizeError(badObject)).not.toThrow();
    });
  });

  describe('Always returns Error invariant', () => {
    it('should always return an Error instance', () => {
      const testCases = [
        null,
        undefined,
        '',
        'message',
        0,
        42,
        true,
        false,
        {},
        [],
        new Error('test'),
      ];

      testCases.forEach((input) => {
        const result = normalizeError(input);
        expect(result).toBeInstanceOf(Error);
      });
    });
  });
});

describe('safeAugmentError', () => {
  describe('Normal augmentation', () => {
    it('should successfully add property to Error', () => {
      const error = new Error('test');
      const result = safeAugmentError(error, 'customProp', 'customValue');
      expect(result).toBe(true);
      expect(error.customProp).toBe('customValue');
    });

    it('should handle various value types', () => {
      const error = new Error('test');

      expect(safeAugmentError(error, 'stringProp', 'string')).toBe(true);
      expect(safeAugmentError(error, 'numberProp', 42)).toBe(true);
      expect(safeAugmentError(error, 'boolProp', true)).toBe(true);
      expect(safeAugmentError(error, 'objectProp', { key: 'value' })).toBe(
        true
      );
      expect(safeAugmentError(error, 'arrayProp', [1, 2, 3])).toBe(true);
      expect(safeAugmentError(error, 'nullProp', null)).toBe(true);
      expect(safeAugmentError(error, 'undefinedProp', undefined)).toBe(true);

      expect(error.stringProp).toBe('string');
      expect(error.numberProp).toBe(42);
      expect(error.boolProp).toBe(true);
      expect(error.objectProp).toEqual({ key: 'value' });
      expect(error.arrayProp).toEqual([1, 2, 3]);
      expect(error.nullProp).toBe(null);
      expect(error.undefinedProp).toBe(undefined);
    });
  });

  describe('Frozen object handling', () => {
    it('should return false for frozen Error', () => {
      const error = Object.freeze(new Error('frozen'));
      const result = safeAugmentError(error, 'prop', 'value');
      expect(result).toBe(false);
    });

    it('should not throw for frozen Error', () => {
      const error = Object.freeze(new Error('frozen'));
      expect(() => safeAugmentError(error, 'prop', 'value')).not.toThrow();
    });
  });

  describe('Sealed object handling', () => {
    it('should return false when adding new property to sealed Error', () => {
      const error = Object.seal(new Error('sealed'));
      const result = safeAugmentError(error, 'newProp', 'value');
      expect(result).toBe(false);
    });

    it('should return true when modifying existing property on sealed Error', () => {
      const error = new Error('sealed');
      error.existingProp = 'initial';
      Object.seal(error);
      const result = safeAugmentError(error, 'existingProp', 'modified');
      expect(result).toBe(true);
      expect(error.existingProp).toBe('modified');
    });
  });

  describe('Non-writable property handling', () => {
    it('should return false for non-writable property', () => {
      const error = new Error('test');
      Object.defineProperty(error, 'readOnly', {
        value: 'immutable',
        writable: false,
        configurable: false,
      });
      const result = safeAugmentError(error, 'readOnly', 'newValue');
      expect(result).toBe(false);
    });

    it('should not modify non-writable property', () => {
      const error = new Error('test');
      Object.defineProperty(error, 'readOnly', {
        value: 'immutable',
        writable: false,
        configurable: false,
      });
      safeAugmentError(error, 'readOnly', 'newValue');
      expect(error.readOnly).toBe('immutable');
    });
  });

  describe('Never throws invariant', () => {
    it('should never throw on any input combination', () => {
      const testCases = [
        [new Error('test'), 'prop', 'value'],
        [Object.freeze(new Error('frozen')), 'prop', 'value'],
        [Object.seal(new Error('sealed')), 'newProp', 'value'],
        [new Error('test'), '', 'value'],
        [new Error('test'), 'prop', null],
        [new Error('test'), 'prop', undefined],
        [new Error('test'), 'prop', Symbol('sym')],
      ];

      testCases.forEach(([error, propName, value]) => {
        expect(() => safeAugmentError(error, propName, value)).not.toThrow();
      });
    });

    it('should handle getter that throws', () => {
      const error = new Error('test');
      Object.defineProperty(error, 'throwingGetter', {
        get() {
          throw new Error('getter exploded');
        },
        set() {
          throw new Error('setter exploded');
        },
        configurable: false,
      });
      expect(() =>
        safeAugmentError(error, 'throwingGetter', 'value')
      ).not.toThrow();
      expect(safeAugmentError(error, 'throwingGetter', 'value')).toBe(false);
    });
  });
});
