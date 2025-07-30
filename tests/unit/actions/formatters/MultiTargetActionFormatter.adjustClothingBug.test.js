/**
 * @file Focused test suite to reproduce the adjust_clothing formatting bug
 * Bug: When formatting multi-target actions with contextFrom dependencies,
 * the formatter produces two malformed actions instead of one properly formatted action
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

describe('MultiTargetActionFormatter - adjust_clothing bug reproduction', () => {
  let formatter;
  let baseFormatter;
  let logger;
  let entityManager;

  beforeEach(() => {
    // Setup logger with debug enabled
    logger = new ConsoleLogger('DEBUG');
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

  describe('Bug fix verification: correct action formatting', () => {
    it('should produce one properly formatted action (bug is fixed)', () => {
      // This test reproduces the exact bug scenario
      const actionDef = {
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: {
            scope:
              'intimacy:close_actors_facing_each_other_with_torso_clothing',
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

      // Resolved targets - this is what comes from MultiTargetResolutionStage
      // In the bug scenario, we have one primary (Iker) and one secondary (his jacket)
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
            contextFromId: 'p_erotica:iker_aguirre_instance',
          },
        ],
      };

      const targetDefinitions = actionDef.targets;

      // Format the action
      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      // Log the result to see what's happening
      console.log('Formatting result:', JSON.stringify(result, null, 2));

      // The bug is now FIXED - we should get one properly formatted action
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value.length).toBe(1);

      // Verify the action is properly formatted without placeholders
      expect(result.value[0]).toBe(
        "adjust Iker Aguirre's denim trucker jacket"
      );
      expect(result.value[0]).not.toContain('{primary}');
      expect(result.value[0]).not.toContain('{secondary}');

      console.log(
        '✅ BUG FIXED! Got properly formatted action:',
        result.value[0]
      );
    });

    it('should handle multiple actors correctly (fix verified)', () => {
      // Test with multiple actors to see the pattern more clearly
      const actionDef = {
        id: 'intimacy:adjust_clothing',
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
            contextFromId: 'actor1',
          },
          {
            id: 'clothing2',
            displayName: 'blue jacket',
            type: 'entity',
            contextFromId: 'actor2',
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

      console.log('Multiple actors result:', JSON.stringify(result, null, 2));

      // Expected: 2 properly formatted actions
      // Bug might produce: 4 malformed actions (2 per actor)
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);

      // With the fix, we should get exactly 2 properly formatted actions
      expect(result.value.length).toBe(2);
      expect(result.value).toContain("adjust Alice's red shirt");
      expect(result.value).toContain("adjust Bob's blue jacket");

      // Verify no placeholders remain
      result.value.forEach((cmd) => {
        expect(cmd).not.toContain('{primary}');
        expect(cmd).not.toContain('{secondary}');
      });

      console.log('✅ Multiple actors handled correctly:', result.value);
    });

    it('should handle minimal case correctly (fix verified)', () => {
      // Minimal test to isolate the issue
      const actionDef = {
        id: 'test:action',
        template: '{primary} gives {secondary}',
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'p1', displayName: 'Person', type: 'entity' }],
        secondary: [
          {
            id: 's1',
            displayName: 'item',
            type: 'entity',
            contextFromId: 'p1',
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

      console.log('Minimal test result:', result);

      // Should produce exactly one action: "Person gives item"
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value.length).toBe(1);
      expect(result.value[0]).toBe('Person gives item');
      expect(result.value[0]).not.toContain('{primary}');
      expect(result.value[0]).not.toContain('{secondary}');

      console.log('✅ Minimal test passes:', result.value[0]);
    });
  });
});
