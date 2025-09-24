import { describe, it, expect, jest } from '@jest/globals';
import {
  isEmptyCondition,
  warnOnBracketPaths,
} from '../../../src/utils/jsonLogicUtils.js';

describe('isEmptyCondition', () => {
  it('returns true for plain empty objects', () => {
    expect(isEmptyCondition({})).toBe(true);
  });

  it('returns false for non-object values and non-empty objects', () => {
    expect(isEmptyCondition(null)).toBe(false);
    expect(isEmptyCondition([])).toBe(false);
    expect(isEmptyCondition({ key: 'value' })).toBe(false);
    expect(isEmptyCondition('not-an-object')).toBe(false);
  });
});

describe('warnOnBracketPaths', () => {
  it('warns when a var expression uses bracket notation in string form', () => {
    const logger = { warn: jest.fn() };

    warnOnBracketPaths({ var: 'characters[0].name' }, logger);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid var path "characters[0].name" contains unsupported brackets.'
    );
  });

  it('recursively warns for bracket notation in array form and nested rules', () => {
    const logger = { warn: jest.fn() };
    const rule = [
      { var: 'safe.path' },
      [
        { var: ['inventory[1].item', 'fallback'] },
        { nested: { var: 'story[0]' } },
      ],
      { op: { var: [{}, 'default'] } },
    ];

    warnOnBracketPaths(rule, logger);

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenNthCalledWith(
      1,
      'Invalid var path "inventory[1].item" contains unsupported brackets.'
    );
    expect(logger.warn).toHaveBeenNthCalledWith(
      2,
      'Invalid var path "story[0]" contains unsupported brackets.'
    );
  });

  it('does not warn when no bracket notation is present', () => {
    const logger = { warn: jest.fn() };
    const rule = {
      var: ['plain.path', 'default'],
      nested: [{ other: { var: 42 } }],
    };

    warnOnBracketPaths(rule, logger);

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
