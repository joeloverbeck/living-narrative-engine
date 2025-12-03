import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionIndexingService } from '../../../src/turns/services/actionIndexingService.js';
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';

describe('Multi-target action duplication bug', () => {
  let indexingService;
  let formatter;
  let mockLogger;
  let baseFormatter;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    baseFormatter = new ActionCommandFormatter();
    indexingService = new ActionIndexingService({ logger: mockLogger });
    formatter = new MultiTargetActionFormatter(baseFormatter, mockLogger);
  });

  it('preserves unique commands for multi-target variations', () => {
    // Simulate the discovered actions that would come from the formatter
    // Currently these all have the SAME params with ALL targets
    const discovered = [
      {
        id: 'personal-space:get_close',
        command: 'get close to Amaia Castillo',
        params: {
          targetIds: {
            primary: [
              'p_erotica:amaia_castillo_instance',
              'p_erotica:jon_urena_instance',
            ],
          },
          isMultiTarget: true,
        },
        description: 'Move closer to target',
      },
      {
        id: 'personal-space:get_close',
        command: 'get close to Jon Ureña',
        params: {
          targetIds: {
            primary: [
              'p_erotica:amaia_castillo_instance',
              'p_erotica:jon_urena_instance',
            ],
          },
          isMultiTarget: true,
        },
        description: 'Move closer to target',
      },
    ];

    // Index the actions
    const indexed = indexingService.indexActions('test_actor', discovered);

    expect(indexed).toHaveLength(2);
    expect(indexed.map((item) => item.commandString)).toEqual([
      'get close to Amaia Castillo',
      'get close to Jon Ureña',
    ]);
  });

  it('should generate separate actions with unique params for each target', () => {
    // This test shows what the correct behavior should be

    const discovered = [
      {
        id: 'personal-space:get_close',
        command: 'get close to Amaia Castillo',
        params: {
          targetIds: {
            primary: ['p_erotica:amaia_castillo_instance'], // Only this target
          },
          targetId: 'p_erotica:amaia_castillo_instance', // backward compat
          isMultiTarget: true,
        },
        description: 'Move closer to target',
      },
      {
        id: 'personal-space:get_close',
        command: 'get close to Jon Ureña',
        params: {
          targetIds: {
            primary: ['p_erotica:jon_urena_instance'], // Only this target
          },
          targetId: 'p_erotica:jon_urena_instance', // backward compat
          isMultiTarget: true,
        },
        description: 'Move closer to target',
      },
    ];

    // Index the actions
    const indexed = indexingService.indexActions('test_actor', discovered);

    // With unique params, both actions should be indexed
    expect(indexed).toHaveLength(2);
    expect(indexed[0].commandString).toBe('get close to Amaia Castillo');
    expect(indexed[1].commandString).toBe('get close to Jon Ureña');
  });

  describe('MultiTargetActionFormatter behavior', () => {
    it('should generate combinations for multiple targets', () => {
      const actionDef = {
        id: 'personal-space:get_close',
        name: 'Get Close',
        template: 'get close to {target}',
      };

      const resolvedTargets = {
        primary: [
          {
            id: 'p_erotica:amaia_castillo_instance',
            displayName: 'Amaia Castillo',
          },
          { id: 'p_erotica:jon_urena_instance', displayName: 'Jon Ureña' },
        ],
      };

      const targetDefinitions = {
        primary: {
          placeholder: 'target',
        },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        null, // entityManager not needed for this test
        { logger: mockLogger },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(2);

      // Extract commands from the objects for comparison
      const commands = result.value.map((item) => item.command);
      expect(commands[0]).toBe('get close to Amaia Castillo');
      expect(commands[1]).toBe('get close to Jon Ureña');

      // The issue is that the formatter returns just strings,
      // not the target information needed to create unique params
    });
  });
});
