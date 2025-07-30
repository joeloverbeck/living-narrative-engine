/**
 * @file Test suite that demonstrates the fix for multi-target action formatting bug
 * This test shows how the fix prevents multi-target actions from being incorrectly
 * processed through the legacy formatting path
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';

describe('ActionFormattingStage - multi-target action fix', () => {
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

    // Mock formatter that tracks calls
    commandFormatter = {
      format: jest.fn().mockImplementation((actionDef, targetContext) => {
        // Legacy formatter - should NOT be called for multi-target actions
        return {
          ok: true,
          value: actionDef.template, // Return template unchanged to show the bug
        };
      }),
      formatMultiTarget: jest
        .fn()
        .mockImplementation((actionDef, resolvedTargets) => {
          // Multi-target formatter - should be used instead
          let result = actionDef.template;
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

    entityManager = { getEntityInstance: jest.fn() };
    safeEventDispatcher = { dispatch: jest.fn() };
    getEntityDisplayNameFn = jest.fn((id) => id);
    errorContextBuilder = { buildErrorContext: jest.fn() };

    stage = new ActionFormattingStage({
      commandFormatter,
      entityManager,
      safeEventDispatcher,
      getEntityDisplayNameFn,
      errorContextBuilder,
      logger,
    });
  });

  describe('Multi-target action protection', () => {
    it('should skip multi-target actions in legacy formatting path', async () => {
      // This is the adjust_clothing action definition
      const actionDef = {
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: {
            placeholder: 'primary',
            description: 'Person whose clothing to adjust',
          },
          secondary: {
            placeholder: 'secondary',
            description: 'Specific garment to adjust',
            contextFrom: 'primary',
          },
        },
      };

      // This simulates what happens when a multi-target action comes through
      // the legacy path (without resolvedTargets/targetDefinitions)
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef,
            targetContexts: [
              {
                type: 'entity',
                entityId: 'person1',
                displayName: 'Iker Aguirre',
              },
              {
                type: 'entity',
                entityId: 'clothing1',
                displayName: 'denim trucker jacket',
              },
            ],
          },
        ],
        trace: {
          step: jest.fn(),
          info: jest.fn(),
        },
      };

      const result = await stage.execute(context);

      // The fix ensures that multi-target actions are skipped in legacy formatting
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Multi-target actions detected but no resolvedTargets/targetDefinitions provided'
        )
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Skipping multi-target action 'intimacy:adjust_clothing' in legacy formatting"
        )
      );

      // Legacy formatter should NOT be called for multi-target actions
      expect(commandFormatter.format).not.toHaveBeenCalled();

      // No formatted actions should be produced (they're skipped)
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should properly format multi-target actions when correct data is provided', async () => {
      const actionDef = {
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: { placeholder: 'primary' },
          secondary: { placeholder: 'secondary', contextFrom: 'primary' },
        },
      };

      // This is the correct way - with resolvedTargets and targetDefinitions
      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [{ actionDef, targetContexts: [] }],
        resolvedTargets: {
          primary: [
            {
              id: 'person1',
              displayName: 'Iker Aguirre',
              type: 'entity',
            },
          ],
          secondary: [
            {
              id: 'clothing1',
              displayName: 'denim trucker jacket',
              type: 'entity',
              contextFromId: 'person1',
            },
          ],
        },
        targetDefinitions: actionDef.targets,
        trace: {
          step: jest.fn(),
          info: jest.fn(),
        },
      };

      const result = await stage.execute(context);

      // Should use multi-target formatter
      expect(commandFormatter.formatMultiTarget).toHaveBeenCalledTimes(1);
      expect(commandFormatter.format).not.toHaveBeenCalled();

      // Should produce correctly formatted action
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe(
        "adjust Iker Aguirre's denim trucker jacket"
      );
      expect(result.actions[0].params.isMultiTarget).toBe(true);
    });

    it('should still format legacy single-target actions correctly', async () => {
      // A legacy action without multi-target definitions
      const actionDef = {
        id: 'core:go',
        name: 'Go',
        template: 'go {target}',
        targets: 'core:adjacent_locations', // String target = legacy
      };

      const context = {
        actor: { id: 'test-actor' },
        actionsWithTargets: [
          {
            actionDef,
            targetContexts: [
              {
                type: 'entity',
                entityId: 'location1',
                displayName: 'north',
              },
            ],
          },
        ],
        trace: {
          step: jest.fn(),
          info: jest.fn(),
        },
      };

      const result = await stage.execute(context);

      // Should use legacy formatter for legacy actions
      expect(commandFormatter.format).toHaveBeenCalledTimes(1);
      expect(commandFormatter.formatMultiTarget).not.toHaveBeenCalled();

      // Should produce formatted action
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('go {target}'); // Template unchanged in our mock
    });
  });
});
