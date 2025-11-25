/**
 * @file Additional coverage tests for MultiTargetActionFormatter hot paths.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

const createLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('MultiTargetActionFormatter - additional coverage', () => {
  let formatter;
  let baseFormatter;
  let logger;

  beforeEach(() => {
    baseFormatter = { format: jest.fn() };
    logger = createLogger();
    formatter = new MultiTargetActionFormatter(baseFormatter, logger);
  });

  it('pushes formatted combinations and resolves id placeholders', () => {
    const actionDef = {
      id: 'test:ids',
      name: 'Identify',
      template: 'identify {primary.id}',
      targets: {
        primary: { placeholder: 'primary' },
      },
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'entity-123',
          displayName: 'Visible Name',
        },
      ],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      null,
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toEqual([
      {
        command: 'identify entity-123',
        targets: { primary: [resolvedTargets.primary[0]] },
      },
    ]);
  });

  it('flags unresolved placeholders when a target entry is unexpectedly missing', () => {
    const actionDef = {
      id: 'test:missing-target',
      name: 'Missing Target',
      template: 'use {item} on {primary}',
      targets: {
        primary: { placeholder: 'primary' },
        secondary: { placeholder: 'item' },
      },
    };

    const resolvedTargets = {
      primary: [{ id: 'hero', displayName: 'Hero' }],
      // Use a falsy, non-object value to trigger the defensive branch without
      // crashing earlier dependency detection logic.
      secondary: [0],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      null,
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('unresolved placeholders');
  });

  it('derives no fallback placeholder when every candidate is already assigned', () => {
    const actionDef = {
      id: 'test:fallbacks',
      name: 'Fallbacks',
      template: '{person}',
      targets: {
        primary: { placeholder: 'person' },
        secondary: {},
      },
    };

    const resolvedTargets = {
      primary: [{ id: 'one', displayName: 'One' }],
      secondary: [{ id: 'two', displayName: 'Two' }],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      null,
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe('One');
  });

  it('limits independent combination expansion at the maximum threshold', () => {
    const actionDef = {
      id: 'test:independent-cap',
      name: 'Independent Cap',
      template: '{primary} meets {dependent} and takes {loot}',
      targets: {
        primary: { placeholder: 'primary' },
        dependent: { placeholder: 'dependent', contextFrom: 'primary' },
        loot: { placeholder: 'loot' },
      },
      generateCombinations: true,
    };

    const primaryTarget = { id: 'p1', displayName: 'Prime' };
    const dependentTargets = Array.from({ length: 2 }, (_, i) => ({
      id: `d${i + 1}`,
      displayName: `Dependent ${i + 1}`,
      contextFromId: 'p1',
    }));
    const lootTargets = Array.from({ length: 60 }, (_, i) => ({
      id: `l${i + 1}`,
      displayName: `Loot ${i + 1}`,
    }));

    const resolvedTargets = {
      primary: [primaryTarget],
      dependent: dependentTargets,
      loot: lootTargets,
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      null,
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(true);
    expect(result.value.length).toBe(50);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('halts dependent cartesian generation when exceeding the maximum combinations', () => {
    const actionDef = {
      id: 'test:dependent-cap',
      name: 'Dependent Cap',
      template: '{primary} matches {depA} and {depB}',
      targets: {
        primary: { placeholder: 'primary' },
        depA: { placeholder: 'depA', contextFrom: 'primary' },
        depB: { placeholder: 'depB', contextFrom: 'primary' },
      },
      generateCombinations: true,
    };

    const primaryTarget = { id: 'p1', displayName: 'Prime' };
    const depA = Array.from({ length: 10 }, (_, i) => ({
      id: `a${i + 1}`,
      displayName: `A${i + 1}`,
      contextFromId: 'p1',
    }));
    const depB = Array.from({ length: 10 }, (_, i) => ({
      id: `b${i + 1}`,
      displayName: `B${i + 1}`,
      contextFromId: 'p1',
    }));

    const resolvedTargets = {
      primary: [primaryTarget],
      depA,
      depB,
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      null,
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(true);
    expect(result.value.length).toBe(50);
  });

  it('produces cartesian combinations for independent multi-entity targets', () => {
    const actionDef = {
      id: 'test:cartesian',
      name: 'Cartesian',
      template: '{primary} greets {secondary}',
      targets: {
        primary: { placeholder: 'primary' },
        secondary: { placeholder: 'secondary' },
      },
      generateCombinations: true,
    };

    const resolvedTargets = {
      primary: [
        { id: 'p1', displayName: 'One' },
        { id: 'p2', displayName: 'Two' },
      ],
      secondary: [
        { id: 's1', displayName: 'Alpha' },
        { id: 's2', displayName: 'Beta' },
      ],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      null,
      {},
      { targetDefinitions: actionDef.targets }
    );

    expect(result.ok).toBe(true);
    expect(result.value.map((entry) => entry.command)).toEqual(
      expect.arrayContaining([
        'One greets Alpha',
        'One greets Beta',
        'Two greets Alpha',
        'Two greets Beta',
      ])
    );
  });
});
