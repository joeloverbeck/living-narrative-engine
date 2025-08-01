/**
 * @file Test suite to reproduce the ACTUAL unresolved placeholder bug
 *
 * REAL BUG: Multi-target actions are being processed by the legacy ActionFormatter
 * instead of MultiTargetActionFormatter, causing {secondary} to remain unresolved.
 *
 * Expected: "adjust Iker Aguirre's denim trucker jacket"
 * Actual: "adjust Iker Aguirre's {secondary}" (legacy formatter only handles {target})
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import ActionCommandFormatter from '../../../../src/actions/actionFormatter.js';

describe('MultiTargetActionFormatter - Unresolved Placeholder Bug', () => {
  let formatter;
  let baseFormatter;
  let logger;
  let entityManager;

  beforeEach(() => {
    logger = new ConsoleLogger('DEBUG');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();

    baseFormatter = {
      format: jest.fn(),
    };

    entityManager = {
      getEntityInstance: jest.fn().mockReturnValue({
        id: 'p_erotica:iker_aguirre_instance',
        getAllComponents: () => ({}),
      }),
    };

    formatter = new MultiTargetActionFormatter(baseFormatter, logger);
  });

  describe('Bug reproduction: legacy formatter handling multi-target', () => {
    it('should demonstrate the ACTUAL bug - legacy formatter leaves {secondary} unresolved', () => {
      // This test shows what happens when the legacy ActionCommandFormatter
      // is used on multi-target actions instead of MultiTargetActionFormatter

      const legacyFormatter = new ActionCommandFormatter({
        entityManager,
        logger,
        safeEventDispatcher: { dispatch: jest.fn() },
      });

      const actionDef = {
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: {
            scope:
              'intimacy:close_actors_facing_each_other_with_torso_clothing',
            placeholder: 'primary',
          },
          secondary: {
            scope: 'clothing:target_topmost_torso_upper_clothing',
            placeholder: 'secondary',
            contextFrom: 'primary',
          },
        },
      };

      // Legacy formatter expects a single target context, not multi-target
      // This simulates what happens when the pipeline passes a single target
      // with a placeholder to the legacy formatter
      const singleTargetContext = {
        type: 'entity',
        entityId: 'p_erotica:iker_aguirre_instance',
        displayName: 'Iker Aguirre',
        placeholder: 'primary', // This should make legacy formatter replace {primary}
      };

      const result = legacyFormatter.format(
        actionDef,
        singleTargetContext,
        entityManager,
        {
          debug: true,
          logger,
          safeEventDispatcher: { dispatch: jest.fn() },
        },
        {
          displayNameFn: (entity, fallback) => {
            if (entity && entity.id === 'p_erotica:iker_aguirre_instance') {
              return 'Iker Aguirre';
            }
            return fallback;
          },
        }
      );

      console.log('Legacy formatter bug result:', result);

      // This reproduces the exact bug from the logs!
      // Legacy formatter replaces only the {primary} placeholder but leaves {secondary}
      expect(result.ok).toBe(true);
      expect(result.value).toBe("adjust Iker Aguirre's {secondary}");
      expect(result.value).toContain('{secondary}'); // Bug indicator!

      console.log(
        '✅ REPRODUCED THE ACTUAL BUG! Legacy formatter only handles single placeholders.'
      );
    });
  });

  describe('Bug reproduction: unresolved {secondary} placeholder', () => {
    it('should reproduce the bug - action shows {secondary} instead of resolved value', () => {
      // Reproduce the exact scenario from the bug report
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

      // This is what the resolver should provide
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

      console.log('Bug reproduction result:', JSON.stringify(result, null, 2));

      // This test should FAIL initially (demonstrating the bug)
      // After fix, it should PASS
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value.length).toBeGreaterThan(0);

      // The bug manifests as the action containing unresolved placeholders
      const formattedAction = result.value[0];

      // This is what we SHOULD get (test will fail until bug is fixed)
      expect(formattedAction).toBe(
        "adjust Iker Aguirre's denim trucker jacket"
      );

      // These should NOT be present (bug indicators)
      expect(formattedAction).not.toContain('{primary}');
      expect(formattedAction).not.toContain('{secondary}');
    });

    it('should demonstrate the bug with minimal case', () => {
      // Minimal reproduction to isolate the issue
      const actionDef = {
        id: 'test:bug',
        template: '{primary} adjusts {secondary}',
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'actor1', displayName: 'Actor', type: 'entity' }],
        secondary: [
          {
            id: 'item1',
            displayName: 'item',
            type: 'entity',
            contextFromId: 'actor1',
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

      console.log('Minimal bug reproduction:', result);

      // This should work correctly
      expect(result.ok).toBe(true);
      expect(result.value[0]).toBe('Actor adjusts item');
      expect(result.value[0]).not.toContain('{secondary}');
    });

    it('should fail when secondary target is missing (edge case)', () => {
      // Test what happens when contextFrom target is missing
      const actionDef = {
        id: 'test:missing',
        template: '{primary} adjusts {secondary}',
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      // Primary exists but secondary is empty (contextFrom failed)
      const resolvedTargets = {
        primary: [{ id: 'actor1', displayName: 'Actor', type: 'entity' }],
        secondary: [], // Empty - context resolution failed
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions: actionDef.targets }
      );

      console.log('Missing secondary target result:', result);

      // This should fail gracefully, not produce malformed actions
      expect(result.ok).toBe(false);
    });
  });
});
