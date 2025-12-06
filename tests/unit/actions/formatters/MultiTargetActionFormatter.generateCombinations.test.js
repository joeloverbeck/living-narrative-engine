/**
 * @file Test suite for MultiTargetActionFormatter generateCombinations behavior
 * Tests the specific functionality where actions with generateCombinations: true
 * create separate action combinations for each context-dependent target
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

describe('MultiTargetActionFormatter - generateCombinations behavior', () => {
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

  describe('remove_others_clothing action formatting', () => {
    it('should generate separate combinations when generateCombinations is true', () => {
      // Setup action definition matching remove_others_clothing
      const actionDef = {
        id: 'clothing:remove_others_clothing',
        name: "Remove Other's Clothing",
        description: "Remove a piece of someone else's topmost clothing",
        targets: {
          primary: {
            scope: 'positioning:close_actors',
            placeholder: 'person',
            description: 'The person whose clothing to remove',
          },
          secondary: {
            scope: 'clothing:topmost_clothing',
            placeholder: 'item',
            description: 'The clothing item to remove',
            contextFrom: 'primary',
          },
        },
        generateCombinations: true,
        template: "remove {person}'s {item}",
      };

      // Setup resolved targets - one person with multiple clothing items
      const resolvedTargets = {
        primary: [
          {
            id: 'bob_instance',
            displayName: 'Bob',
            type: 'entity',
          },
        ],
        secondary: [
          {
            id: 'jacket1',
            displayName: 'chore jacket',
            type: 'entity',
            contextFromId: 'bob_instance',
          },
          {
            id: 'jeans1',
            displayName: 'jeans',
            type: 'entity',
            contextFromId: 'bob_instance',
          },
          {
            id: 'boots1',
            displayName: 'boots',
            type: 'entity',
            contextFromId: 'bob_instance',
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
      expect(Array.isArray(result.value)).toBe(true);

      // Should generate separate combinations for each clothing item
      expect(result.value).toHaveLength(3);

      // Extract commands for verification
      const commands = result.value.map((item) => item.command);
      expect(commands).toEqual(
        expect.arrayContaining([
          "remove Bob's chore jacket",
          "remove Bob's jeans",
          "remove Bob's boots",
        ])
      );

      // Verify each combination has correct target structure
      result.value.forEach((item, index) => {
        expect(item).toHaveProperty('command');
        expect(item).toHaveProperty('targets');
        expect(item.targets).toHaveProperty('primary');
        expect(item.targets).toHaveProperty('secondary');

        // Verify primary target is Bob
        expect(Array.isArray(item.targets.primary)).toBe(true);
        expect(item.targets.primary).toHaveLength(1);
        expect(item.targets.primary[0].id).toBe('bob_instance');

        // Verify secondary target matches one of the clothing items
        expect(Array.isArray(item.targets.secondary)).toBe(true);
        expect(item.targets.secondary).toHaveLength(1);
        const secondaryTarget = item.targets.secondary[0];
        expect(['jacket1', 'jeans1', 'boots1']).toContain(secondaryTarget.id);
      });
    });

    it('should still generate separate combinations for contextFrom targets when generateCombinations is undefined', () => {
      // Setup action definition without generateCombinations flag
      // NOTE: The current implementation shows that context-dependent targets
      // already generate separate combinations even without the flag.
      // The generateCombinations: true flag is mainly for clarity and future consistency.
      const actionDef = {
        id: 'caressing:adjust_clothing',
        name: 'Adjust Clothing',
        template: "adjust {person}'s {item}",
        targets: {
          primary: {
            scope: 'positioning:close_actors',
            placeholder: 'person',
            description: 'The person whose clothing to adjust',
          },
          secondary: {
            scope: 'clothing:topmost_clothing',
            placeholder: 'item',
            description: 'The clothing item to adjust',
            contextFrom: 'primary',
          },
        },
        // generateCombinations: undefined (default)
      };

      // Setup resolved targets - one person with multiple clothing items
      const resolvedTargets = {
        primary: [
          {
            id: 'bob_instance',
            displayName: 'Bob',
            type: 'entity',
          },
        ],
        secondary: [
          {
            id: 'jacket1',
            displayName: 'chore jacket',
            type: 'entity',
            contextFromId: 'bob_instance',
          },
          {
            id: 'jeans1',
            displayName: 'jeans',
            type: 'entity',
            contextFromId: 'bob_instance',
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
      expect(Array.isArray(result.value)).toBe(true);

      // Current behavior: separate combinations even without explicit flag
      expect(result.value).toHaveLength(2);

      // Extract commands for verification
      const commands = result.value.map((item) => item.command);
      expect(commands).toEqual(
        expect.arrayContaining([
          "adjust Bob's chore jacket",
          "adjust Bob's jeans",
        ])
      );
    });

    it('should handle empty secondary targets gracefully with generateCombinations', () => {
      // Setup action definition with generateCombinations
      const actionDef = {
        id: 'clothing:remove_others_clothing',
        name: "Remove Other's Clothing",
        generateCombinations: true,
        template: "remove {person}'s {item}",
        targets: {
          primary: {
            scope: 'positioning:close_actors',
            placeholder: 'person',
          },
          secondary: {
            scope: 'clothing:topmost_clothing',
            placeholder: 'item',
            contextFrom: 'primary',
          },
        },
      };

      // Setup resolved targets with no secondary targets
      const resolvedTargets = {
        primary: [
          {
            id: 'bob_instance',
            displayName: 'Bob',
            type: 'entity',
          },
        ],
        secondary: [], // No clothing items
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

      // Should fail gracefully when no secondary targets available
      expect(result.ok).toBe(false);
      expect(result.error).toContain(
        "Target 'secondary' could not be resolved"
      );
    });
  });

  describe('independent targets behavior', () => {
    it('should still generate cartesian product for independent targets regardless of generateCombinations', () => {
      // Setup action definition with independent targets (no contextFrom)
      const actionDef = {
        id: 'combat:throw',
        name: 'Throw',
        generateCombinations: true, // Should not affect independent targets
        template: 'throw {item} at {target}',
        targets: {
          primary: {
            scope: 'inventory:items',
            placeholder: 'item',
          },
          secondary: {
            scope: 'nearby:enemies',
            placeholder: 'target',
            // No contextFrom - these are independent targets
          },
        },
      };

      // Setup resolved targets - multiple items and multiple targets
      const resolvedTargets = {
        primary: [
          { id: 'rock1', displayName: 'Small Rock' },
          { id: 'knife1', displayName: 'Knife' },
        ],
        secondary: [
          { id: 'enemy1', displayName: 'Goblin' },
          { id: 'enemy2', displayName: 'Orc' },
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
      expect(Array.isArray(result.value)).toBe(true);

      // Should generate cartesian product: 2 items × 2 targets = 4 combinations
      expect(result.value).toHaveLength(4);

      // Extract commands for verification
      const commands = result.value.map((item) => item.command);
      expect(commands).toEqual(
        expect.arrayContaining([
          'throw Small Rock at Goblin',
          'throw Small Rock at Orc',
          'throw Knife at Goblin',
          'throw Knife at Orc',
        ])
      );
    });
  });
});
