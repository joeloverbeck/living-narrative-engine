import { describe, test, expect } from '@jest/globals';
import {
  assertValidActor,
  assertMatchingActor,
  validateContextMethods,
  validateActorInContext,
  retrieveStrategyFromContext,
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

  test('validateActorInContext returns actor from context', () => {
    const actor = makeActor('a1');
    const ctx = { getActor: () => actor };
    expect(validateActorInContext(ctx, null, 'State')).toBe(actor);
  });

  test('validateActorInContext throws when context missing', () => {
    expect(() => validateActorInContext(null, null, 'State')).toThrow(
      /missing or invalid/
    );
  });

  test('retrieveStrategyFromContext returns strategy', () => {
    const actor = makeActor('a1');
    const strategy = { decideAction: () => {} };
    const ctx = { getStrategy: () => strategy };
    expect(retrieveStrategyFromContext(ctx, actor, 'State')).toBe(strategy);
  });

  test('retrieveStrategyFromContext throws when strategy invalid', () => {
    const actor = makeActor('a1');
    const ctx = { getStrategy: () => null };
    expect(() => retrieveStrategyFromContext(ctx, actor, 'State')).toThrow(
      /No valid IActorTurnStrategy/
    );
  });
});
