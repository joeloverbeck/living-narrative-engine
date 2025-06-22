import { describe, test, expect } from '@jest/globals';
import {
  assertValidActor,
  assertMatchingActor,
  validateContextMethods,
} from '../../../../../src/turns/states/helpers/validationUtils.js';

const makeActor = (id = 'a1') => ({ id });

describe('validationUtils', () => {
  test('assertValidActor returns null for valid actor', () => {
    expect(assertValidActor(makeActor(), 'State')).toBeNull();
  });

  test('assertValidActor returns message for invalid actor', () => {
    expect(assertValidActor(null, 'State')).toMatch(/invalid actorEntity/);
  });

  test('assertMatchingActor returns null for matching actors', () => {
    const a = makeActor('a1');
    expect(assertMatchingActor(a, makeActor('a1'), 'State')).toBeNull();
  });

  test('assertMatchingActor returns message for mismatched actors', () => {
    const expected = makeActor('a1');
    const ctx = makeActor('a2');
    expect(assertMatchingActor(expected, ctx, 'State')).toMatch(
      /does not match/
    );
  });

  test('validateContextMethods detects missing methods', () => {
    const ctx = { a: () => {}, b: 1 };
    expect(validateContextMethods(ctx, ['a', 'b', 'c'])).toEqual(['b', 'c']);
  });

  test('validateContextMethods returns empty array when all present', () => {
    const ctx = { x() {} };
    expect(validateContextMethods(ctx, ['x'])).toEqual([]);
  });
});
