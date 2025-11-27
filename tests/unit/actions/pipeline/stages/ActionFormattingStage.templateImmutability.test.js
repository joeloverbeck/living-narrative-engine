/**
 * @file Regression test for template immutability in ActionFormattingStage
 * @description Verifies that chance injection does NOT mutate cached actionDef.template
 *
 * Context: ActionDefinition objects are cached in ActionIndex. If the stage
 * mutates actionDef.template directly, subsequent actors will see stale chance
 * values calculated for previous actors.
 *
 * Fix: Store the formatted template on the transient actionWithTarget object
 * as `formattedTemplate`, not on the cached actionDef.
 */

import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import * as CoordinatorModule from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js';

describe('ActionFormattingStage - Template Immutability', () => {
  let stage;
  let runMock;
  let coordinatorSpy;

  const createDependencies = (chanceOverrides = {}) => ({
    commandFormatter: { name: 'formatter' },
    entityManager: { name: 'entities' },
    safeEventDispatcher: { dispatch: jest.fn() },
    getEntityDisplayNameFn: jest.fn(),
    errorContextBuilder: { buildErrorContext: jest.fn() },
    logger: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
    chanceCalculationService: {
      calculateForDisplay: jest.fn().mockReturnValue({
        chance: 75,
        displayText: '75%',
        breakdown: { formula: 'ratio', actorSkill: 50, targetSkill: 0 },
      }),
      resolveOutcome: jest.fn(),
      ...chanceOverrides,
    },
  });

  beforeEach(() => {
    runMock = jest.fn().mockResolvedValue({ success: true });
    coordinatorSpy = jest
      .spyOn(CoordinatorModule, 'ActionFormattingCoordinator')
      .mockImplementation(() => {
        return { run: runMock };
      });
    stage = new ActionFormattingStage(createDependencies());
    jest.clearAllMocks();
  });

  afterEach(() => {
    coordinatorSpy.mockRestore();
  });

  describe('Chance-based action template handling', () => {
    it('should NOT mutate the original actionDef.template when injecting chance', async () => {
      // Arrange: Create a cached actionDef with a template containing {chance}
      const originalTemplate = 'Attempt to seduce ({chance}% chance)';
      const cachedActionDef = {
        id: 'seduction:seduce_target',
        name: 'Seduce Target',
        template: originalTemplate,
        chanceBased: {
          enabled: true,
          actorSkill: { component: 'core:stats', default: 10 },
          formula: 'ratio',
        },
      };

      const context = {
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef: cachedActionDef,
            targetContexts: [{ entityId: 'target-1' }],
          },
        ],
        trace: { step: jest.fn() },
      };

      // Act: Execute the stage (which triggers chance injection)
      await stage.executeInternal(context);

      // Assert: The original actionDef.template should NOT be mutated
      expect(cachedActionDef.template).toBe(originalTemplate);
      expect(cachedActionDef.template).toContain('{chance}');
      expect(cachedActionDef.template).not.toContain('75');
    });

    it('should store the formatted template on actionWithTarget.formattedTemplate', async () => {
      // Arrange
      const originalTemplate = 'Try to charm ({chance}% success)';
      const cachedActionDef = {
        id: 'social:charm',
        name: 'Charm',
        template: originalTemplate,
        chanceBased: {
          enabled: true,
          actorSkill: { component: 'core:charisma', default: 5 },
          formula: 'ratio',
        },
      };

      const actionWithTarget = {
        actionDef: cachedActionDef,
        targetContexts: [{ entityId: 'target-1' }],
      };

      const context = {
        actor: { id: 'actor-1' },
        actionsWithTargets: [actionWithTarget],
        trace: { step: jest.fn() },
      };

      // Act
      await stage.executeInternal(context);

      // Assert: formattedTemplate should contain the calculated chance
      expect(actionWithTarget.formattedTemplate).toBeDefined();
      expect(actionWithTarget.formattedTemplate).toContain('75');
      expect(actionWithTarget.formattedTemplate).not.toContain('{chance}');
      expect(actionWithTarget.formattedTemplate).toBe('Try to charm (75% success)');
    });

    it('should produce consistent results for multiple actors with same cached actionDef', async () => {
      // Arrange: Simulate the bug scenario - same cached actionDef used for multiple actors
      const originalTemplate = 'Intimidate ({chance}% effectiveness)';
      const sharedCachedActionDef = {
        id: 'social:intimidate',
        name: 'Intimidate',
        template: originalTemplate,
        chanceBased: {
          enabled: true,
          actorSkill: { component: 'core:strength', default: 10 },
          contestType: 'opposed',
          targetSkill: { component: 'core:willpower', default: 10 },
          formula: 'ratio',
        },
      };

      // First actor: high skill (75% chance)
      const deps1 = createDependencies({
        calculateForDisplay: jest.fn().mockReturnValue({
          chance: 75,
          displayText: '75%',
          breakdown: { formula: 'ratio', actorSkill: 80, targetSkill: 40 },
        }),
      });
      const stage1 = new ActionFormattingStage(deps1);

      const actionWithTarget1 = {
        actionDef: sharedCachedActionDef,
        targetContexts: [{ entityId: 'target-1' }],
      };

      const context1 = {
        actor: { id: 'strong-actor' },
        actionsWithTargets: [actionWithTarget1],
        trace: { step: jest.fn() },
      };

      // Second actor: low skill (25% chance)
      const deps2 = createDependencies({
        calculateForDisplay: jest.fn().mockReturnValue({
          chance: 25,
          displayText: '25%',
          breakdown: { formula: 'ratio', actorSkill: 20, targetSkill: 40 },
        }),
      });
      const stage2 = new ActionFormattingStage(deps2);

      const actionWithTarget2 = {
        actionDef: sharedCachedActionDef, // Same cached object!
        targetContexts: [{ entityId: 'target-2' }],
      };

      const context2 = {
        actor: { id: 'weak-actor' },
        actionsWithTargets: [actionWithTarget2],
        trace: { step: jest.fn() },
      };

      // Act: Process both actors sequentially (as would happen in game)
      await stage1.executeInternal(context1);
      await stage2.executeInternal(context2);

      // Assert: Each actor should have their own calculated chance
      expect(actionWithTarget1.formattedTemplate).toBe('Intimidate (75% effectiveness)');
      expect(actionWithTarget2.formattedTemplate).toBe('Intimidate (25% effectiveness)');

      // Assert: The original cached template is NEVER mutated
      expect(sharedCachedActionDef.template).toBe(originalTemplate);
      expect(sharedCachedActionDef.template).toContain('{chance}');
    });

    it('should not set formattedTemplate for non-chance-based actions', async () => {
      // Arrange
      const actionWithTarget = {
        actionDef: {
          id: 'movement:walk',
          name: 'Walk',
          template: 'Walk to {target}',
          // No chanceBased property
        },
        targetContexts: [{ entityId: 'target-1' }],
      };

      const context = {
        actor: { id: 'actor-1' },
        actionsWithTargets: [actionWithTarget],
        trace: { step: jest.fn() },
      };

      // Act
      await stage.executeInternal(context);

      // Assert: formattedTemplate should not be set
      expect(actionWithTarget.formattedTemplate).toBeUndefined();
    });

    it('should not set formattedTemplate when template lacks {chance} placeholder', async () => {
      // Arrange
      const actionWithTarget = {
        actionDef: {
          id: 'social:compliment',
          name: 'Compliment',
          template: 'Give a compliment to {target}', // No {chance} placeholder
          chanceBased: {
            enabled: true,
            actorSkill: { component: 'core:charisma', default: 5 },
          },
        },
        targetContexts: [{ entityId: 'target-1' }],
      };

      const context = {
        actor: { id: 'actor-1' },
        actionsWithTargets: [actionWithTarget],
        trace: { step: jest.fn() },
      };

      // Act
      await stage.executeInternal(context);

      // Assert: formattedTemplate should not be set since there's no {chance} to replace
      expect(actionWithTarget.formattedTemplate).toBeUndefined();
    });
  });
});
