import { describe, test, expect } from '@jest/globals';
import { isNonBlankString } from '../../src/utils/textUtils.js';

describe('isNonBlankString', () => {
  test('returns true for a normal string', () => {
    expect(isNonBlankString('hello')).toBe(true);
  });

  test('returns false for an empty string', () => {
    expect(isNonBlankString('')).toBe(false);
  });

  test('returns false for whitespace only string', () => {
    expect(isNonBlankString('   ')).toBe(false);
  });

  test('returns false for non-string values', () => {
    expect(isNonBlankString(null)).toBe(false);
    // @ts-ignore
    expect(isNonBlankString(123)).toBe(false);
  });
});
