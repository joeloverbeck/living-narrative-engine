// tests/prompting/elementConditionEvaluator.test.js

import { test, describe, expect } from '@jest/globals';
import { isElementConditionMet } from '../../../src/prompting/elementConditionEvaluator.js';

describe('isElementConditionMet', () => {
  test('returns true when no condition is provided', () => {
    expect(isElementConditionMet(null, {})).toBe(true);
    expect(isElementConditionMet(undefined, { anyFlag: true })).toBe(true);
  });

  test('returns false for invalid promptDataFlag types or empty strings', () => {
    expect(
      isElementConditionMet(
        { promptDataFlag: '', expectedValue: true },
        { '': true }
      )
    ).toBe(false);
    expect(
      isElementConditionMet({ promptDataFlag: '   ' }, { '   ': true })
    ).toBe(false);
    expect(isElementConditionMet({ promptDataFlag: 123 }, { 123: true })).toBe(
      false
    );
  });

  test('checks truthiness when no expectedValue is provided', () => {
    expect(
      isElementConditionMet({ promptDataFlag: 'flag' }, { flag: true })
    ).toBe(true);
    expect(
      isElementConditionMet({ promptDataFlag: 'flag' }, { flag: 'non-empty' })
    ).toBe(true);
    expect(isElementConditionMet({ promptDataFlag: 'flag' }, { flag: 0 })).toBe(
      false
    );
    expect(isElementConditionMet({ promptDataFlag: 'flag' }, {})).toBe(false);
  });

  test('checks strict equality when expectedValue is provided', () => {
    expect(
      isElementConditionMet(
        { promptDataFlag: 'flag', expectedValue: 42 },
        { flag: 42 }
      )
    ).toBe(true);
    expect(
      isElementConditionMet(
        { promptDataFlag: 'flag', expectedValue: 'hello' },
        { flag: 'hello' }
      )
    ).toBe(true);
    expect(
      isElementConditionMet(
        { promptDataFlag: 'flag', expectedValue: false },
        { flag: false }
      )
    ).toBe(true);

    expect(
      isElementConditionMet(
        { promptDataFlag: 'flag', expectedValue: 42 },
        { flag: '42' }
      )
    ).toBe(false);
    expect(
      isElementConditionMet(
        { promptDataFlag: 'flag', expectedValue: 'hello' },
        { flag: 'Hello' }
      )
    ).toBe(false);
    expect(
      isElementConditionMet(
        { promptDataFlag: 'flag', expectedValue: undefined },
        { flag: undefined }
      )
    ).toBe(true);
  });
});
