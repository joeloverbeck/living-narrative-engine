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

  it('falls back to the base target value when dot-notation omits a property path', () => {
    const actionDef = {
      id: 'test:dot-path-fallback',
      template: 'greet {primary.}',
      targets: {
        primary: { placeholder: 'person' },
      },
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'actor-1',
          displayName: 'Alex',
        },
      ],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      {},
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe('greet Alex');
  });

  it('keeps dependent targets grouped together when generateCombinations is true', () => {
    const actionDef = {
      id: 'test:multiple-dependent-combos',
      template: 'assign {primary} to guard {secondary} at {tertiary}',
      generateCombinations: true,
      targets: {
        primary: { placeholder: 'person' },
        secondary: { placeholder: 'role', contextFrom: 'primary' },
        tertiary: { placeholder: 'location', contextFrom: 'primary' },
      },
    };

    const resolvedTargets = {
      primary: [
        { id: 'actor-1', displayName: 'Alex' },
      ],
      secondary: [
        { id: 'duty-1', displayName: 'Gate watch', contextFromId: 'actor-1' },
        { id: 'duty-2', displayName: 'Night patrol', contextFromId: 'actor-1' },
      ],
      tertiary: [
        { id: 'post-1', displayName: 'North Tower', contextFromId: 'actor-1' },
        { id: 'post-2', displayName: 'South Gate', contextFromId: 'actor-1' },
      ],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      {},
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].command).toBe(
      'assign Alex to guard Gate watch at North Tower'
    );
    expect(result.value[0].targets.secondary).toHaveLength(2);
    expect(result.value[0].targets.tertiary).toHaveLength(2);
  });

  it('groups multiple dependent keys even when generateCombinations is not provided', () => {
    const actionDef = {
      id: 'test:dependent-default-behavior',
      template: 'assign {primary} with {secondary} at {tertiary}',
      targets: {
        primary: { placeholder: 'person' },
        secondary: { placeholder: 'role', contextFrom: 'primary' },
        tertiary: { placeholder: 'location', contextFrom: 'primary' },
      },
    };

    const resolvedTargets = {
      primary: [
        { id: 'actor-2', displayName: 'Jamie' },
      ],
      secondary: [
        { id: 'task-1', displayName: 'Repair duty', contextFromId: 'actor-2' },
        { id: 'task-2', displayName: 'Scout mission', contextFromId: 'actor-2' },
      ],
      tertiary: [
        { id: 'zone-1', displayName: 'Workshop', contextFromId: 'actor-2' },
        { id: 'zone-2', displayName: 'North Ridge', contextFromId: 'actor-2' },
      ],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      {},
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].command).toBe(
      'assign Jamie with Repair duty at Workshop'
    );
    expect(result.value[0].targets.secondary).toHaveLength(2);
    expect(result.value[0].targets.tertiary).toHaveLength(2);
  });
});
