import { describe, it, expect } from '@jest/globals';
import {
  validationSucceeded,
  formatValidationErrors,
} from '../../../src/utils/entitiesValidationHelpers.js';

describe('validationHelpers', () => {
  describe('validationSucceeded', () => {
    it('returns true for undefined or null', () => {
      expect(validationSucceeded(undefined)).toBe(true);
      expect(validationSucceeded(null)).toBe(true);
    });

    it('returns the boolean value if passed a boolean', () => {
      expect(validationSucceeded(true)).toBe(true);
      expect(validationSucceeded(false)).toBe(false);
    });

    it('returns true or false based on the isValid property of objects', () => {
      expect(validationSucceeded({ isValid: true })).toBe(true);
      expect(validationSucceeded({ isValid: false })).toBe(false);
    });

    it('returns false for objects without isValid property', () => {
      expect(validationSucceeded({})).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    it('stringifies the errors property when present', () => {
      const errors = { foo: 'bar' };
      const result = formatValidationErrors({ isValid: false, errors });
      expect(result).toBe(JSON.stringify(errors, null, 2));
    });

    it('returns fallback message when no errors are provided', () => {
      expect(formatValidationErrors(false)).toBe('(validator returned false)');
      expect(formatValidationErrors({})).toBe('(validator returned false)');
    });
  });
});
