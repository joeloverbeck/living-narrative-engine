/**
 * @file Tests covering fallback placeholder resolution paths and
 * independent target expansion safeguards for MultiTargetActionFormatter.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

describe('MultiTargetActionFormatter - fallback placeholder resolution', () => {
  let formatter;
  let baseFormatter;
  let logger;
  const entityManager = {};

  beforeEach(() => {
    baseFormatter = { format: jest.fn() };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    formatter = new MultiTargetActionFormatter(baseFormatter, logger);
  });

  it('prioritizes actor placeholder for primary targets when template provides it', () => {
    const actionDef = {
      id: 'greetings:warm_hello',
      template: 'Greet {actor} warmly',
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
      entityManager,
      {},
      {}
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe('Greet Alex warmly');
  });

  it('returns no fallback placeholders when only dot notation placeholders are present', () => {
    const actionDef = {
      id: 'observation:study_subject',
      template: 'Observe {primary.name} closely',
    };

    const resolvedTargets = {
      primary: [
        {
          id: 'subject-1',
          displayName: 'Dana',
          name: 'Dana',
        },
      ],
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      entityManager,
      {},
      {}
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe('Observe Dana closely');
  });

  it('uses positional placeholder order when priority fallbacks are unavailable for secondary targets', () => {
    const actionDef = {
      id: 'crafting:combine_items',
      template: 'Combine {alpha} with {beta}',
    };

    const resolvedTargets = {
      primary: [
        { id: 'hero', displayName: 'Aria' },
      ],
      secondary: [
        { id: 'item-1', displayName: 'Shield' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'alpha' },
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      entityManager,
      {},
      { targetDefinitions }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe('Combine Aria with Shield');
  });

  it('falls back to the first unassigned placeholder when other strategies fail', () => {
    const actionDef = {
      id: 'teamwork:coordinate_assist',
      template: 'Use {alpha}, {alpha}, and {gamma}',
    };

    const resolvedTargets = {
      primary: [
        { id: 'leader', displayName: 'Morgan' },
      ],
      secondary: [
        { id: 'support-1', displayName: 'Scout' },
      ],
    };

    const targetDefinitions = {
      primary: { placeholder: 'alpha' },
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      entityManager,
      {},
      { targetDefinitions }
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe('Use Morgan, Morgan, and Scout');
  });

  it('warns when independent targets are not arrays during combination expansion', () => {
    const actionDef = {
      id: 'equipment:assign_support',
      template: 'Assign {primary} to guard with {secondary}',
    };

    const resolvedTargets = {
      primary: [
        { id: 'hero-1', displayName: 'Iris' },
      ],
      secondary: [
        {
          id: 'blade-1',
          displayName: 'Sunblade',
          contextFromId: 'hero-1',
        },
      ],
      tertiary: (() => {
        const items = [{ id: 'support-1', displayName: 'Watcher' }];
        const pseudoArray = {
          length: items.length,
          some(callback) {
            return items.some(callback);
          },
          every(callback) {
            return items.every(callback);
          },
        };
        items.forEach((item, index) => {
          pseudoArray[index] = item;
        });
        return pseudoArray;
      })(),
    };

    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      entityManager,
      {},
      {}
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "MultiTargetActionFormatter: targets for key 'tertiary' is not an array",
      expect.objectContaining({ key: 'tertiary' })
    );
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(0);
  });
});
