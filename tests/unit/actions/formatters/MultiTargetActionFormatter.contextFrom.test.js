/**
 * @file Test suite for MultiTargetActionFormatter with contextFrom dependencies
 * Tests the specific bug where actions with context-dependent targets are incorrectly formatted
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

describe('MultiTargetActionFormatter - contextFrom bug', () => {
  let formatter;
  let baseFormatter;
  let logger;
  let entityManager;

  beforeEach(() => {
    // Setup logger
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();

    // Mock base formatter (not used in multi-target formatting)
    baseFormatter = {
      format: jest.fn(),
    };

    // Mock entity manager (not used in this test)
    entityManager = {
      getEntityInstance: jest.fn(),
    };

    // Create formatter instance
    formatter = new MultiTargetActionFormatter(baseFormatter, logger);
  });

  describe('adjust_clothing action formatting', () => {
    it('should format a single action with both placeholders replaced', () => {
      // Setup action definition matching adjust_clothing
      const actionDef = {
        id: 'caressing:adjust_clothing',
        name: 'Adjust Clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: {
            scope:
              'caressing:close_actors_facing_each_other_with_torso_clothing',
            placeholder: 'primary',
            description: 'Person whose clothing to adjust',
          },
          secondary: {
            scope: 'clothing:target_topmost_torso_upper_clothing',
            placeholder: 'secondary',
            description: 'Specific garment to adjust',
            contextFrom: 'primary',
          },
        },
      };

      // Setup resolved targets - this is what would come from MultiTargetResolutionStage
      const resolvedTargets = {
        primary: [
          {
            id: 'p_erotica:iker_aguirre_instance',
            displayName: 'Iker Aguirre',
            type: 'entity',
          },
        ],
        secondary: [
          {
            id: 'clothing:denim_trucker_jacket_instance',
            displayName: 'denim trucker jacket',
            type: 'entity',
            contextFromId: 'p_erotica:iker_aguirre_instance', // This links secondary to primary
          },
        ],
      };

      // Target definitions from the action
      const targetDefinitions = actionDef.targets;

      // Format the action
      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      // Assert the result
      expect(result.ok).toBe(true);
      expect(result.value).toBeDefined();

      // The bug would produce an array with two malformed commands
      // We expect a single properly formatted command with target info
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(1);
      const item = result.value[0];
      expect(item.command).toBe("adjust Iker Aguirre's denim trucker jacket");
      expect(item.targets).toBeDefined();
      expect(item.targets.primary).toBeDefined();
      expect(item.targets.secondary).toBeDefined();

      // Verify no incomplete placeholders remain
      const commandStr = result.value[0].command;
      expect(commandStr).not.toContain('{primary}');
      expect(commandStr).not.toContain('{secondary}');
    });

    it('should handle multiple primary targets with their respective secondary targets', () => {
      const actionDef = {
        id: 'caressing:adjust_clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: {
            placeholder: 'primary',
          },
          secondary: {
            placeholder: 'secondary',
            contextFrom: 'primary',
          },
        },
      };

      // Multiple actors with their respective clothing
      const resolvedTargets = {
        primary: [
          {
            id: 'actor1',
            displayName: 'Alice',
            type: 'entity',
          },
          {
            id: 'actor2',
            displayName: 'Bob',
            type: 'entity',
          },
        ],
        secondary: [
          {
            id: 'clothing1',
            displayName: 'red shirt',
            type: 'entity',
            contextFromId: 'actor1', // Alice's clothing
          },
          {
            id: 'clothing2',
            displayName: 'blue jacket',
            type: 'entity',
            contextFromId: 'actor2', // Bob's clothing
          },
        ],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(2);

      // Extract commands from the objects for comparison
      const commands = result.value.map((item) => item.command);
      expect(commands).toContain("adjust Alice's red shirt");
      expect(commands).toContain("adjust Bob's blue jacket");
    });

    it('should not generate incorrect combinations for context-dependent targets', () => {
      const actionDef = {
        id: 'test:action',
        template: '{primary} gives {secondary} to {tertiary}',
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
          tertiary: { placeholder: 'tertiary' },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'giver1', displayName: 'Alice', type: 'entity' }],
        secondary: [
          {
            id: 'item1',
            displayName: 'book',
            type: 'entity',
            contextFromId: 'giver1',
          },
        ],
        tertiary: [
          { id: 'receiver1', displayName: 'Charlie', type: 'entity' },
          { id: 'receiver2', displayName: 'David', type: 'entity' },
        ],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Should generate combinations only for independent targets
      expect(result.value).toHaveLength(2);

      // Extract commands from the objects for comparison
      const commands = result.value.map((item) => item.command);
      expect(commands).toContain('Alice gives book to Charlie');
      expect(commands).toContain('Alice gives book to David');
    });
  });

  describe('edge cases', () => {
    it('should handle missing secondary targets gracefully', () => {
      const actionDef = {
        id: 'test:action',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'actor1', displayName: 'Test Actor', type: 'entity' }],
        secondary: [], // No secondary targets resolved
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions: actionDef.targets }
      );

      // Should fail with error when required targets are missing
      expect(result.ok).toBe(false);
      expect(result.error).toContain(
        "Target 'secondary' could not be resolved - action not available"
      );
    });

    it('should handle contextFrom with no matching primary', () => {
      const actionDef = {
        id: 'test:action',
        template: '{primary} uses {secondary}',
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'actor1', displayName: 'Alice', type: 'entity' }],
        secondary: [
          {
            id: 'item1',
            displayName: 'item',
            type: 'entity',
            contextFromId: 'actor2', // Different actor - no match
          },
        ],
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions: actionDef.targets }
      );

      // Should fail with error when no valid combinations can be generated for required targets
      expect(result.ok).toBe(false);
      expect(result.error).toContain(
        'No valid target combinations could be generated for required targets'
      );
    });
  });
});
