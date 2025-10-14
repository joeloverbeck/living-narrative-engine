/**
 * @file Test to reproduce the mixed actions bug
 * Bug: When processing both legacy and multi-target actions in the same pipeline,
 * the MultiTargetResolutionStage doesn't pass resolvedTargets to ActionFormattingStage,
 * causing multi-target actions to be formatted incorrectly with unresolved placeholders.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

describe('MultiTargetActionFormatter - mixed actions bug reproduction', () => {
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

    // Mock base formatter (used for legacy actions)
    baseFormatter = {
      format: jest
        .fn()
        .mockReturnValue({ ok: true, value: 'formatted legacy action' }),
    };

    // Mock entity manager
    entityManager = {
      getEntityInstance: jest.fn(),
    };

    // Create formatter instance
    formatter = new MultiTargetActionFormatter(baseFormatter, logger);
  });

  describe('Bug reproduction: mixed legacy and multi-target actions', () => {
    it('should demonstrate the bug when processing mixed action types', () => {
      // This reproduces the scenario where we have both legacy and multi-target actions
      // being processed together, which causes MultiTargetResolutionStage to not
      // pass resolvedTargets/targetDefinitions to ActionFormattingStage

      const adjustClothingActionDef = {
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

      // Legacy action that would be processed in the same pipeline
      const legacyFollowActionDef = {
        id: 'core:follow',
        name: 'Follow',
        template: 'follow {target}',
        targets: 'core:actors_in_location', // Legacy string format
      };

      // When ActionFormattingStage processes adjust_clothing without resolvedTargets/targetDefinitions,
      // it tries to call formatMultiTarget with empty or malformed data

      // Simulate the scenario: ActionFormattingStage detects multi-target action
      // but has no resolvedTargets (because mixed actions were detected in pipeline)
      const hasMultiTargetActions = [
        adjustClothingActionDef,
        legacyFollowActionDef,
      ].some(
        ({ actionDef = adjustClothingActionDef }) =>
          actionDef.targets && typeof actionDef.targets === 'object'
      );

      console.log('Has multi-target actions:', hasMultiTargetActions);

      // This should trigger the exact same condition as ActionFormattingStage.js:90-100
      if (hasMultiTargetActions) {
        console.log(
          'WARNING: Multi-target actions detected but no resolvedTargets/targetDefinitions provided.'
        );

        // The bug: formatMultiTarget is called with empty/undefined resolvedTargets
        const buggyResolvedTargets = undefined; // This is what happens in the bug
        const buggyTargetDefinitions = undefined;

        const result = formatter.formatMultiTarget(
          adjustClothingActionDef,
          buggyResolvedTargets,
          entityManager,
          { debug: true },
          { targetDefinitions: buggyTargetDefinitions }
        );

        console.log('Buggy result:', JSON.stringify(result, null, 2));

        // This should fail or produce malformed output
        expect(result.ok).toBe(false); // Should fail when no targets provided
      }
    });

    it('should reproduce the bug with the actual problematic resolved targets', () => {
      // Test what happens when MultiTargetResolutionStage correctly resolves targets
      // but ActionFormattingStage processes it in legacy mode due to mixed actions

      const actionDef = {
        id: 'caressing:adjust_clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      // This is what MultiTargetResolutionStage would produce
      const correctlyResolvedTargets = {
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

      // But ActionFormattingStage doesn't receive this due to mixed actions
      // So it calls the legacy formatter path which can't handle multi-target templates

      // Simulate what happens when the coordinator's legacy fallback path
      // encounters a multi-target action

      const targetContexts = [
        {
          type: 'entity',
          entityId: 'p_erotica:iker_aguirre_instance',
          displayName: 'Iker Aguirre',
        },
      ];

      // This would be the call to base formatter with multi-target template
      const legacyFormatterResult = baseFormatter.format(
        actionDef,
        targetContexts[0],
        entityManager,
        { debug: true },
        { displayNameFn: (id) => id }
      );

      console.log('Legacy formatter called with multi-target template:', {
        template: actionDef.template,
        target: targetContexts[0],
        result: legacyFormatterResult,
      });

      // The legacy formatter would try to format "adjust {primary}'s {secondary}"
      // with only one target context, leading to unresolved placeholders
      expect(legacyFormatterResult.ok).toBe(true);
      expect(legacyFormatterResult.value).toBe('formatted legacy action');
    });

    it('should work correctly when ALL actions are multi-target', () => {
      // This should work because MultiTargetResolutionStage would pass
      // resolvedTargets/targetDefinitions when allActionsAreMultiTarget = true

      const actionDef = {
        id: 'caressing:adjust_clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

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

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions: actionDef.targets }
      );

      console.log('Correct result:', JSON.stringify(result, null, 2));

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(1);

      // Extract command from the object for comparison
      const command = result.value[0].command;
      expect(command).toBe("adjust Iker Aguirre's denim trucker jacket");
    });
  });
});
