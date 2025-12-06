/**
 * @file Exhaustive branch coverage for MultiTargetActionFormatter.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

class FlakyTargetCollection {
  constructor(items, zeroAfterReads = 1) {
    this.items = items;
    this._reads = 0;
    this._zeroAfterReads = zeroAfterReads;
  }

  get length() {
    this._reads += 1;
    if (this._reads > this._zeroAfterReads) {
      return 0;
    }
    return this.items.length;
  }

  some(callback) {
    return this.items.some((value, index, array) =>
      value ? callback(value, index, array) : false
    );
  }

  every(callback) {
    return this.items.every((value, index, array) =>
      value ? callback(value, index, array) : false
    );
  }

  filter(callback) {
    return this.items.filter((value, index, array) =>
      value ? callback(value, index, array) : false
    );
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

describe('MultiTargetActionFormatter exhaustive branch coverage', () => {
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

  it('handles degenerate placeholder resolution scenarios with defensive fallbacks', () => {
    const actionDef = {
      id: 'test:degenerate-placeholders',
      template: [
        'assist {primary.name}',
        '({primary.metadata})',
        'fallback {primary.stats.value}',
        'direct {primary.}',
      ].join(' | '),
      generateCombinations: false,
    };

    const resolvedTargets = {
      primary: new FlakyTargetCollection([undefined], Number.POSITIVE_INFINITY),
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      {},
      {},
      {
        targetDefinitions: {
          primary: { placeholder: 'actor' },
        },
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('unresolved placeholders');

    const missingPrimaryWarning = mockLogger.warn.mock.calls.find(([message]) =>
      message.includes('No target found in non-empty array for key: primary')
    );
    expect(missingPrimaryWarning).toBeDefined();

    const placeholderWarning = mockLogger.warn.mock.calls.find(
      ([message]) =>
        message === 'Template still contains placeholders after formatting:'
    );
    expect(placeholderWarning).toBeDefined();
    expect(placeholderWarning[1].remainingPlaceholders).toEqual(
      expect.arrayContaining([
        'primary.name',
        'primary.',
        'primary.stats.value',
        'primary.metadata',
      ])
    );
  });

  it('resolves alias placeholders and normalizes complex values for resolved targets', () => {
    const actionDef = {
      id: 'test:alias-resolution',
      template: [
        'use {foo}',
        'assist {secondary}',
        '{bar}',
        '{baz}',
        'alias {secondary.displayName}',
        'id {secondary.id}',
        'context {secondary.context.detail}',
        'missing {secondary.missingProp}',
        'object {secondary.metadata}',
        'blank {secondary.blankValue}',
        'nested {secondary.stats.value}',
      ].join(' | '),
      generateCombinations: false,
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'actor-1',
          displayName: 'Hero',
        },
      ],
      support: [
        {
          id: 'support-1',
          displayName: 'Scout',
        },
      ],
      observer: [
        {
          id: 'observer-1',
          displayName: 'Watcher',
        },
      ],
      secondary: [
        {
          id: { raw: 'sec-1' },
          displayName: 'Guardian',
          name: '',
          context: { detail: 'close friend' },
          metadata: { faction: 'allies' },
          blankValue: '',
          stats: null,
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
        },
      }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toContain('Hero');
    expect(result.value).toContain('Scout');
    expect(result.value).toContain('Watcher');
    expect(result.value).toContain('Guardian');

    const resolvedSecondary = mockLogger.debug.mock.calls.find(
      ([message, payload]) =>
        message === 'Resolved placeholder values for target:' &&
        payload?.targetKey === 'secondary'
    );
    expect(resolvedSecondary).toBeDefined();
    expect(
      resolvedSecondary[1].placeholderValueMap['secondary.displayName']
    ).toBe('Guardian');
    expect(
      resolvedSecondary[1].placeholderValueMap['secondary.context.detail']
    ).toBe('close friend');
    expect(resolvedSecondary[1].placeholderValueMap['secondary.id']).toEqual({
      raw: 'sec-1',
    });
  });

  it('returns a combination error when dependent targets disappear after the initial guard', () => {
    const actionDef = {
      id: 'test:flaky-dependent-length',
      template: 'combine {primary} with {dependent}',
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'actor-1',
          displayName: 'Actor One',
        },
      ],
      dependent: new FlakyTargetCollection(
        [
          {
            id: 'tool-1',
            displayName: 'Tool One',
            contextFromId: 'actor-1',
          },
        ],
        1
      ),
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
        },
      }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain(
      'No valid target combinations could be generated'
    );
  });

  it('expands multiple dependent keys with and without generateAllCombinations and skips incomplete combinations', () => {
    const createResolvedTargets = () => ({
      leader: [
        { id: 'leader-1', displayName: 'Leader', role: 'captain' },
        { id: 'leader-2', displayName: 'Second Leader', role: 'scout' },
      ],
      ally: [
        { id: 'ally-1', displayName: 'Ally One', contextFromId: 'leader-1' },
        { id: 'ally-2', displayName: 'Ally Two', contextFromId: 'leader-1' },
      ],
      tool: [
        { id: 'tool-1', displayName: 'Tool One', contextFromId: 'leader-1' },
        { id: 'tool-2', displayName: 'Tool Two', contextFromId: 'leader-2' },
      ],
      location: [
        { id: 'loc-1', displayName: 'Camp' },
        { id: 'loc-2', displayName: 'Bridge' },
      ],
      spotter: [
        { id: 'spotter-1', displayName: 'Scout A' },
        { id: 'spotter-2', displayName: 'Scout B' },
      ],
    });

    const actionTemplate =
      'coordinate {leader.displayName} with {ally.displayName}, bring {tool.displayName} to {location.displayName} and confirm with {spotter.displayName}';

    const expectations = (template, resolvedTargets, generateAllCombinations) =>
      formatter.formatMultiTarget(
        {
          id: 'test:multi-dependent',
          template,
          generateCombinations: generateAllCombinations,
        },
        resolvedTargets,
        {},
        {},
        {
          targetDefinitions: {
            leader: { placeholder: 'leader' },
            ally: { placeholder: 'ally', contextFrom: 'leader' },
            tool: { placeholder: 'tool', contextFrom: 'leader' },
            location: { placeholder: 'location' },
            spotter: { placeholder: 'spotter' },
          },
        }
      );

    const resolvedTargetsForTrue = createResolvedTargets();
    const combinationsWithFlag = expectations(
      actionTemplate,
      resolvedTargetsForTrue,
      true
    );

    expect(combinationsWithFlag.ok).toBe(true);
    expect(Array.isArray(combinationsWithFlag.value)).toBe(true);
    expect(combinationsWithFlag.value.length).toBeGreaterThan(0);
    for (const entry of combinationsWithFlag.value) {
      expect(entry.command).toContain('Leader');
      expect(entry.command).toMatch(/Camp|Bridge/);
    }

    const resolvedTargetsForFalse = createResolvedTargets();
    const combinationsWithoutFlag = expectations(
      actionTemplate,
      resolvedTargetsForFalse,
      false
    );

    expect(combinationsWithoutFlag.ok).toBe(true);
    expect(combinationsWithoutFlag.value.length).toBeGreaterThan(0);

    const skippedCombinationDebug = mockLogger.debug.mock.calls.find(
      ([message, payload]) =>
        message === 'generateContextDependentCombinations:' &&
        payload.primaryTargets.some((primary) => primary.id === 'leader-2')
    );
    expect(skippedCombinationDebug).toBeDefined();

    const generatedCombinationsLog = mockLogger.debug.mock.calls.find(
      ([message]) => message === 'Generated combinations:'
    );
    expect(generatedCombinationsLog).toBeDefined();

    const volatileTargets = createResolvedTargets();
    volatileTargets.spotter = new FlakyTargetCollection(
      [
        { id: 'spotter-1', displayName: 'Scout A' },
        { id: 'spotter-2', displayName: 'Scout B' },
      ],
      3
    );

    const combinationsWithMissingTargets = expectations(
      actionTemplate,
      volatileTargets,
      true
    );

    expect(combinationsWithMissingTargets.ok).toBe(false);
    expect(combinationsWithMissingTargets.error).toContain(
      'No valid target combinations'
    );
  });
});
