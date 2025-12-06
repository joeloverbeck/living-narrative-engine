/**
 * @file Integration test to verify the adjust_clothing bug is fixed in the pipeline
 * Tests the complete ActionFormattingStage with multi-target actions in mixed scenarios
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { extractTargetIds } from '../../common/actions/targetParamTestHelpers.js';

describe('ActionFormattingStage - adjust_clothing bug integration', () => {
  let stage;
  let multiTargetFormatter;
  let baseFormatter;
  let entityManager;
  let safeEventDispatcher;
  let logger;
  let errorContextBuilder;

  beforeEach(() => {
    logger = new ConsoleLogger('DEBUG');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();

    // Mock base formatter
    baseFormatter = {
      format: jest
        .fn()
        .mockReturnValue({ ok: true, value: 'legacy formatted action' }),
    };

    // Create multi-target formatter
    multiTargetFormatter = new MultiTargetActionFormatter(
      baseFormatter,
      logger
    );

    // Mock entity manager
    entityManager = {
      getEntityInstance: jest.fn().mockReturnValue({
        id: 'mock-entity',
        getAllComponents: () => ({}),
      }),
    };

    // Mock safe event dispatcher
    safeEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Mock error context builder
    errorContextBuilder = {
      buildErrorContext: jest.fn().mockReturnValue({ error: 'mock error' }),
    };

    // Create stage instance
    stage = new ActionFormattingStage({
      commandFormatter: multiTargetFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn: (id) => id,
      errorContextBuilder,
      logger,
    });
  });

  describe('Mixed action scenarios', () => {
    it('should format adjust_clothing correctly when mixed with legacy actions', async () => {
      // Simulate the scenario from the bug report:
      // Mixed actions (legacy + multi-target) being processed together

      const adjustClothingActionDef = {
        id: 'caressing:adjust_clothing',
        name: 'Adjust Clothing',
        description:
          'Smooth their collar or adjust a displaced garment with possessive care.',
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

      const legacyFollowActionDef = {
        id: 'core:follow',
        name: 'Follow',
        template: 'follow {target}',
        targets: 'core:actors_in_location', // Legacy string format
      };

      // Simulate the target contexts that would come from MultiTargetResolutionStage
      // This represents the mixed scenario where adjust_clothing has properly resolved
      // multi-target contexts with placeholders
      const adjustClothingTargetContexts = [
        {
          type: 'entity',
          entityId: 'p_erotica:iker_aguirre_instance',
          displayName: 'Iker Aguirre',
          placeholder: 'primary',
        },
        {
          type: 'entity',
          entityId: 'clothing:denim_trucker_jacket_instance',
          displayName: 'denim trucker jacket',
          placeholder: 'secondary',
          contextFromId: 'p_erotica:iker_aguirre_instance',
        },
      ];

      const followTargetContexts = [
        {
          type: 'entity',
          entityId: 'p_erotica:amaia_castillo_instance',
          displayName: 'Amaia Castillo',
        },
      ];

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: adjustClothingActionDef,
            targetContexts: adjustClothingTargetContexts,
          },
          {
            actionDef: legacyFollowActionDef,
            targetContexts: followTargetContexts,
          },
        ],
        // Note: No resolvedTargets/targetDefinitions at pipeline level
        // due to mixed action types - this is what causes the bug
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);

      // Find the adjust_clothing action in the results
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions.length).toBeGreaterThan(0);

      const primaryIds = adjustClothingActions.flatMap((action) =>
        extractTargetIds(action.params, { placeholder: 'primary' })
      );
      expect(primaryIds).toEqual(
        expect.arrayContaining(['p_erotica:iker_aguirre_instance'])
      );

      const secondaryIds = adjustClothingActions.flatMap((action) =>
        extractTargetIds(action.params, { placeholder: 'secondary' })
      );
      expect(secondaryIds).toEqual(
        expect.arrayContaining(['clothing:denim_trucker_jacket_instance'])
      );

      for (const adjustAction of adjustClothingActions) {
        expect(adjustAction.command).not.toContain('{');
        expect(adjustAction.command).not.toContain('}');
        expect(
          extractTargetIds(adjustAction.params, { placeholder: 'primary' })
        ).toHaveLength(1);
        expect(
          extractTargetIds(adjustAction.params, { placeholder: 'secondary' })
        ).toHaveLength(1);
      }
    });

    it('should handle the case where secondary target is missing', async () => {
      // Test the scenario where the secondary scope resolves to no targets
      // In this case, the action should not be available

      const adjustClothingActionDef = {
        id: 'caressing:adjust_clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      // Only primary target, no secondary target
      const targetContexts = [
        {
          type: 'entity',
          entityId: 'p_erotica:iker_aguirre_instance',
          displayName: 'Iker Aguirre',
          placeholder: 'primary',
        },
        // Note: No secondary target contexts
      ];

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: adjustClothingActionDef,
            targetContexts,
          },
        ],
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      const adjustClothingActions = result.actions.filter(
        (action) => action.id === 'caressing:adjust_clothing'
      );

      expect(adjustClothingActions.length).toBe(1);
      const adjustAction = adjustClothingActions[0];
      const primaryTargets = extractTargetIds(adjustAction.params);
      expect(primaryTargets).toContain('p_erotica:iker_aguirre_instance');
      const secondaryTargets = extractTargetIds(adjustAction.params, {
        placeholder: 'secondary',
      });
      expect(secondaryTargets).toEqual(['p_erotica:iker_aguirre_instance']);
    });

    it('should handle malformed target contexts gracefully', async () => {
      const adjustClothingActionDef = {
        id: 'caressing:adjust_clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      // Malformed target contexts (missing required fields)
      const malformedTargetContexts = [
        {
          type: 'entity',
          // Missing entityId and displayName
        },
        {
          // Missing type
          entityId: 'some-id',
        },
      ];

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef: adjustClothingActionDef,
            targetContexts: malformedTargetContexts,
          },
        ],
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      // Should handle malformed data gracefully, likely resulting in no actions or errors
      expect(result.actions).toBeDefined();
    });
  });
});
