/**
 * @file Additional coverage tests for MultiTargetActionFormatter edge cases.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

class ArrayLikeTargets {
  constructor(items) {
    this.items = items;
    this.length = items.length;
    for (let index = 0; index < items.length; index += 1) {
      this[index] = items[index];
    }
  }

  some(callback) {
    return this.items.some((value, index) =>
      value ? callback(value, index, this.items) : false
    );
  }

  every(callback) {
    return this.items.every((value, index) =>
      value ? callback(value, index, this.items) : false
    );
  }

  filter(callback) {
    return new ArrayLikeTargets(this.items.filter(callback));
  }

  map(callback) {
    return this.items.map(callback);
  }

  slice(...args) {
    return this.items.slice(...args);
  }

  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  }
}

describe('MultiTargetActionFormatter uncovered branches', () => {
  let formatter;
  let mockLogger;
  let mockBaseFormatter;

  beforeEach(() => {
    mockBaseFormatter = { format: jest.fn() };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    formatter = new MultiTargetActionFormatter(mockBaseFormatter, mockLogger);
  });

  it('warns when the leading resolved target is missing and reports unresolved placeholders', () => {
    const actionDef = {
      id: 'test:missing-primary',
      template: 'use {item} on {target}',
    };

    const resolvedTargets = {
      primary: new ArrayLikeTargets([undefined]),
      secondary: [{ id: 'enemy-1', displayName: 'Goblin' }],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      {},
      {},
      {
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
        },
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('unresolved placeholders');

    const warnCalls = mockLogger.warn.mock.calls;
    expect(warnCalls[0][0]).toContain('No target found in non-empty array for key: primary');

    const placeholderWarning = warnCalls.find(
      ([message]) => message === 'Template still contains placeholders after formatting:'
    );
    expect(placeholderWarning).toBeDefined();
    expect(placeholderWarning[1].remainingPlaceholders).toContain('item');
  });

  it('returns an error when combination generation filters out every variant', () => {
    const actionDef = {
      id: 'test:empty-combinations',
      template: 'use {item} on {target}',
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [{ id: 'item-1', displayName: 'Item 1' }],
      secondary: new ArrayLikeTargets([undefined]),
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      {},
      {},
      {
        targetDefinitions: {
          primary: { placeholder: 'item' },
          secondary: { placeholder: 'target' },
        },
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('No valid target combinations could be generated');
  });

  it('surfaced context-dependent errors when no primary targets exist', () => {
    const actionDef = {
      id: 'test:no-primary',
      template: 'adjust {secondary} with {tertiary}',
      generateCombinations: true,
    };

    const resolvedTargets = {
      secondary: [
        {
          id: 'garment-1',
          displayName: 'Jacket',
          contextFromId: 'actor-1',
        },
      ],
      tertiary: [
        {
          id: 'sash-1',
          displayName: 'Sash',
          contextFromId: 'actor-1',
        },
      ],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      {},
      {},
      {
        targetDefinitions: {
          secondary: { placeholder: 'secondary' },
          tertiary: { placeholder: 'tertiary' },
        },
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('No valid target combinations could be generated');
  });

  it('logs a warning when independent targets are provided via array-like collections', () => {
    const actionDef = {
      id: 'test:array-like',
      template: 'coordinate {primary} with {dependent} at {location}',
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [{ id: 'actor-1', displayName: 'Actor' }],
      dependent: [
        {
          id: 'tool-1',
          displayName: 'Tool',
          contextFromId: 'actor-1',
        },
      ],
      location: new ArrayLikeTargets([
        { id: 'loc-1', displayName: 'Location 1' },
        { id: 'loc-2', displayName: 'Location 2' },
      ]),
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      {},
      {},
      {
        targetDefinitions: {
          primary: { placeholder: 'primary' },
          dependent: { placeholder: 'dependent', contextFrom: 'primary' },
          location: { placeholder: 'location' },
        },
      }
    );

    const arrayGuardWarning = mockLogger.warn.mock.calls.find(([message]) =>
      message.includes("targets for key 'location' is not an array")
    );

    expect(arrayGuardWarning).toBeDefined();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No valid target combinations could be generated');
  });
});
