/**
 * @file Test to reproduce the adjust_clothing bug in ActionFormattingStage
 * Bug: Multi-target actions are being formatted through legacy single-target path
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';

describe('ActionFormattingStage - adjust_clothing bug', () => {
  let stage;
  let commandFormatter;
  let entityManager;
  let safeEventDispatcher;
  let getEntityDisplayNameFn;
  let errorContextBuilder;
  let logger;

  beforeEach(() => {
    logger = new ConsoleLogger('DEBUG');
    logger.debug = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock command formatter with both legacy and multi-target support
    commandFormatter = {
      format: jest.fn().mockImplementation((actionDef, targetContext) => {
        // Legacy formatter behavior - this is what's causing the bug
        const template = actionDef.template;
        const entityId = targetContext.entityId;
        const displayName = targetContext.displayName || entityId;

        // Log what the legacy formatter is doing
        logger.debug(
          `Legacy format called with template: "${template}", target: ${displayName}`
        );

        // Simulate the bug - replace only the {target} placeholder
        let result = template.replace('{target}', displayName);

        // If it's a multi-target template, it will have unresolved placeholders
        return { ok: true, value: result };
      }),
      formatMultiTarget: jest
        .fn()
        .mockImplementation((actionDef, resolvedTargets) => {
          // Multi-target formatter - this should be called instead
          logger.debug('Multi-target formatter called');
          const template = actionDef.template;
          let result = template;

          // Replace all placeholders correctly
          if (resolvedTargets.primary && resolvedTargets.primary[0]) {
            result = result.replace(
              '{primary}',
              resolvedTargets.primary[0].displayName
            );
          }
          if (resolvedTargets.secondary && resolvedTargets.secondary[0]) {
            result = result.replace(
              '{secondary}',
              resolvedTargets.secondary[0].displayName
            );
          }

          return { ok: true, value: [result] };
        }),
    };

    entityManager = {
      getEntityInstance: jest.fn(),
    };

    safeEventDispatcher = {
      dispatch: jest.fn(),
    };

    getEntityDisplayNameFn = jest.fn((id) => {
      const names = {
        'p_erotica:iker_aguirre_instance': 'Iker Aguirre',
        'clothing:denim_trucker_jacket_instance': 'denim trucker jacket',
      };
      return names[id] || id;
    });

    errorContextBuilder = {
      buildErrorContext: jest.fn(),
    };

    stage = new ActionFormattingStage({
      commandFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn,
      errorContextBuilder,
      logger,
    });
  });

  describe('Bug reproduction', () => {
    it('should use multi-target formatter when resolvedTargets are provided', async () => {
      const actionDef = {
        id: 'caressing:adjust_clothing',
        name: 'Adjust Clothing',
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

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [{ actionDef, targetContexts: [] }],
        resolvedTargets,
        targetDefinitions: actionDef.targets,
        trace: {
          step: jest.fn(),
          info: jest.fn(),
        },
      };

      const result = await stage.execute(context);

      // Check that multi-target formatter was called
      expect(commandFormatter.formatMultiTarget).toHaveBeenCalled();
      expect(commandFormatter.format).not.toHaveBeenCalled();

      // Check the result
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe(
        "adjust Iker Aguirre's denim trucker jacket"
      );
    });

    it('should fall back to legacy formatting and produce malformed actions (bug reproduction)', async () => {
      // Simulate the bug by having the stage fall back to legacy formatting
      const actionDef = {
        id: 'caressing:adjust_clothing',
        name: 'Adjust Clothing',
        template: "adjust {primary}'s {secondary}",
      };

      // These are legacy target contexts (what causes the bug)
      const targetContexts = [
        {
          type: 'entity',
          entityId: 'p_erotica:iker_aguirre_instance',
          displayName: 'Iker Aguirre',
        },
        {
          type: 'entity',
          entityId: 'clothing:denim_trucker_jacket_instance',
          displayName: 'denim trucker jacket',
        },
      ];

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [{ actionDef, targetContexts }],
        // No resolvedTargets or targetDefinitions - this triggers legacy path
        trace: {
          step: jest.fn(),
          info: jest.fn(),
        },
      };

      const result = await stage.execute(context);

      // The bug: legacy formatter is called twice
      expect(commandFormatter.format).toHaveBeenCalledTimes(2);
      expect(commandFormatter.formatMultiTarget).not.toHaveBeenCalled();

      // Check the malformed results
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2);

      // These are the malformed actions produced by the bug
      expect(result.actions[0].command).toContain('{'); // Has unresolved placeholder
      expect(result.actions[1].command).toContain('{'); // Has unresolved placeholder

      console.log(
        'Bug reproduced! Malformed actions:',
        result.actions.map((a) => a.command)
      );
    });
  });
});
