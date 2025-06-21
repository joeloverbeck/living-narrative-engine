// tests/logic/jsonLogicUtils.test.js

import { describe, it, expect } from '@jest/globals';
import { isEmptyCondition } from '../../../src/utils/jsonLogicUtils.js';

describe('isEmptyCondition', () => {
  it('returns true for empty object', () => {
    expect(isEmptyCondition({})).toBe(true);
  });

  it('returns false for object with keys', () => {
    expect(isEmptyCondition({ a: 1 })).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isEmptyCondition([])).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isEmptyCondition(null)).toBe(false);
    expect(isEmptyCondition(undefined)).toBe(false);
    expect(isEmptyCondition(0)).toBe(false);
    expect(isEmptyCondition('')).toBe(false);
  });
});
