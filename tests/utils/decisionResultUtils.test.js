import { describe, test, expect } from '@jest/globals';
import { buildDecisionResult } from '../../src/utils/decisionResultUtils.js';

describe('buildDecisionResult utility', () => {
  test('defaults all extractedData fields to null when meta is empty', () => {
    const result = buildDecisionResult('myAction', {});
    expect(result).toEqual({
      kind: 'success',
      action: 'myAction',
      extractedData: {
        speech: null,
        thoughts: null,
        notes: null,
      },
    });
  });

  test('throws when attempting to mutate the frozen result envelope', () => {
    const result = buildDecisionResult({ foo: 'bar' }, {});
    expect(() => {
      result.kind = 'fail';
    }).toThrow(TypeError);
  });
});
