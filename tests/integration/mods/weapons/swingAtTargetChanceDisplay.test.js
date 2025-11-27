/**
 * @file Integration tests for chance-based action display in ActionFormattingStage
 * Tests that {chance} placeholder is correctly replaced with calculated probability
 *
 * Updated to use ChanceCalculationService instead of individual skill/probability services.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../src/actions/pipeline/stages/ActionFormattingStage.js';

describe('swingAtTargetChanceDisplay - Chance Injection in ActionFormattingStage', () => {
  let mockLogger;
  let mockCommandFormatter;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let mockGetEntityDisplayNameFn;
  let mockErrorContextBuilder;
  let mockChanceCalculationService;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCommandFormatter = {
      format: jest.fn().mockReturnValue({
        command: 'swing_at_target',
        display: 'swing sword at target (50%)',
      }),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getEntity: jest.fn().mockReturnValue({ id: 'test-entity' }),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockGetEntityDisplayNameFn = jest.fn().mockReturnValue('Test Entity');

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn().mockReturnValue({
        type: 'error',
        message: 'Test error',
      }),
    };

    mockChanceCalculationService = {
      calculateForDisplay: jest.fn().mockReturnValue({
        chance: 67,
        displayText: '67%',
        breakdown: {
          formula: 'ratio',
          actorSkill: 50,
          targetSkill: 25,
        },
      }),
      resolveOutcome: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Creates a stage instance with optional chanceCalculationService
   */
  function createStage(options = {}) {
    return new ActionFormattingStage({
      commandFormatter: mockCommandFormatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
      errorContextBuilder: mockErrorContextBuilder,
      logger: mockLogger,
      chanceCalculationService: options.chanceCalculationService ?? null,
    });
  }

  /**
   * Creates a basic context with an action
   */
  function createContext(actionDef, targetContexts = []) {
    return {
      actor: { id: 'actor-1' },
      actionsWithTargets: [
        {
          actionDef,
          targetContexts,
        },
      ],
      trace: null,
    };
  }

  describe('Basic chance injection', () => {
    it('should replace {chance} placeholder with calculated percentage', async () => {
      // Arrange
      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing sword at {target} ({chance}%)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
            default: 0,
          },
          targetSkill: {
            component: 'skills:defense_skill',
            default: 0,
          },
          formula: 'ratio',
        },
      };

      const targetContexts = [{ entityId: 'target-1' }];
      const context = createContext(actionDef, targetContexts);

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Formatted template should be set (original actionDef.template unchanged for cache safety)
      expect(context.actionsWithTargets[0].formattedTemplate).toBe(
        'swing sword at {target} (67%)'
      );
      // Verify original template remains unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing sword at {target} ({chance}%)'
      );

      // Verify service was called with correct parameters
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'actor-1',
        targetId: 'target-1',
        actionDef,
      });
    });
  });

  describe('Opposed skill check display', () => {
    it('should calculate correct chance for actor skill 50 vs target skill 25', async () => {
      // Arrange - Setup service to return expected values
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 67,
        displayText: '67%',
        breakdown: { formula: 'ratio', actorSkill: 50, targetSkill: 25 },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}%)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill', default: 0 },
          targetSkill: { component: 'skills:defense_skill', default: 0 },
          formula: 'ratio',
        },
      };

      const context = createContext(actionDef, [{ entityId: 'target-1' }]);

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'actor-1',
        targetId: 'target-1',
        actionDef,
      });

      // Formatted template should be set (original actionDef.template unchanged for cache safety)
      expect(context.actionsWithTargets[0].formattedTemplate).toBe(
        'swing at {target} (67%)'
      );
      // Verify original template remains unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}%)'
      );
    });
  });

  describe('Missing skill fallback', () => {
    it('should use default value when skill component is missing', async () => {
      // Arrange - Service handles fallback internally
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 50,
        displayText: '50%',
        breakdown: { formula: 'ratio', actorSkill: 10, targetSkill: 0 },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}%)',
        chanceBased: {
          enabled: true,
          contestType: 'simple',
          actorSkill: {
            component: 'skills:melee_skill',
            default: 10,
          },
          formula: 'ratio',
        },
      };

      const context = createContext(actionDef, [{ entityId: 'target-1' }]);

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Service was called
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalled();

      // Formatted template should be set (original actionDef.template unchanged for cache safety)
      expect(context.actionsWithTargets[0].formattedTemplate).toBe(
        'swing at {target} (50%)'
      );
      // Verify original template remains unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}%)'
      );
    });
  });

  describe('No chance placeholder', () => {
    it('should leave template unchanged if no {chance} placeholder', async () => {
      // Arrange
      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing sword at {target}', // No {chance}
        chanceBased: {
          enabled: true,
          actorSkill: { component: 'skills:melee_skill' },
          formula: 'ratio',
        },
      };

      const context = createContext(actionDef, [{ entityId: 'target-1' }]);

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Template unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing sword at {target}'
      );

      // Service should NOT be called since no placeholder
      expect(mockChanceCalculationService.calculateForDisplay).not.toHaveBeenCalled();
    });
  });

  describe('Non-chance action unchanged', () => {
    it('should not modify template for actions without chanceBased enabled', async () => {
      // Arrange
      const actionDef = {
        id: 'core:walk_to',
        template: 'walk to {target} ({chance}%)', // Has placeholder but no chanceBased
        // No chanceBased property
      };

      const context = createContext(actionDef, [{ entityId: 'target-1' }]);

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Template unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'walk to {target} ({chance}%)'
      );

      expect(mockChanceCalculationService.calculateForDisplay).not.toHaveBeenCalled();
    });

    it('should not modify template when chanceBased.enabled is false', async () => {
      // Arrange
      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}%)',
        chanceBased: {
          enabled: false, // Explicitly disabled
          actorSkill: { component: 'skills:melee_skill' },
        },
      };

      const context = createContext(actionDef, [{ entityId: 'target-1' }]);

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Template unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}%)'
      );

      expect(mockChanceCalculationService.calculateForDisplay).not.toHaveBeenCalled();
    });
  });

  describe('Without combat services', () => {
    it('should work normally without chanceCalculationService (backward compatibility)', async () => {
      // Arrange
      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}%)',
        chanceBased: {
          enabled: true,
          actorSkill: { component: 'skills:melee_skill' },
        },
      };

      const context = createContext(actionDef, [{ entityId: 'target-1' }]);

      // Create stage WITHOUT chanceCalculationService
      const stage = createStage();

      // Act
      await stage.executeInternal(context);

      // Assert - Template unchanged because no service available
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}%)'
      );
    });
  });

  describe('Target extraction', () => {
    it('should extract target from resolvedTargets when available', async () => {
      // Arrange
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 60,
        displayText: '60%',
        breakdown: { formula: 'ratio' },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}%)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill' },
          targetSkill: { component: 'skills:defense_skill' },
          formula: 'ratio',
        },
      };

      const context = {
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef,
            resolvedTargets: {
              primary: [{ entityId: 'resolved-target-1' }],
            },
            targetContexts: [{ entityId: 'fallback-target' }],
          },
        ],
        trace: null,
      };

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should use resolvedTargets.primary, not targetContexts
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'actor-1',
        targetId: 'resolved-target-1',
        actionDef,
      });
    });

    it('should fall back to targetContexts when resolvedTargets is not available', async () => {
      // Arrange
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 55,
        displayText: '55%',
        breakdown: { formula: 'ratio' },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}%)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill' },
          targetSkill: { component: 'skills:defense_skill' },
          formula: 'ratio',
        },
      };

      const context = {
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef,
            // No resolvedTargets
            targetContexts: [{ entityId: 'fallback-target' }],
          },
        ],
        trace: null,
      };

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should use targetContexts fallback
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'actor-1',
        targetId: 'fallback-target',
        actionDef,
      });
    });
  });

  describe('Formula and bounds', () => {
    it('should pass actionDef with custom formula and bounds to service', async () => {
      // Arrange
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 75,
        displayText: '75%',
        breakdown: { formula: 'logistic' },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}%)',
        chanceBased: {
          enabled: true,
          contestType: 'simple',
          actorSkill: { component: 'skills:melee_skill', default: 0 },
          fixedDifficulty: 10,
          formula: 'logistic',
          bounds: { min: 10, max: 90 },
        },
      };

      const context = createContext(actionDef, [{ entityId: 'target-1' }]);

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Service receives actionDef which contains the formula and bounds
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'actor-1',
        targetId: 'target-1',
        actionDef,
      });

      // Formatted template should be set (original actionDef.template unchanged for cache safety)
      expect(context.actionsWithTargets[0].formattedTemplate).toBe(
        'swing at {target} (75%)'
      );
      // Verify original template remains unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}%)'
      );
    });
  });

  describe('Logging', () => {
    it('should log debug message when injecting chance', async () => {
      // Arrange
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 67,
        displayText: '67%',
        breakdown: { formula: 'ratio' },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}%)',
        chanceBased: {
          enabled: true,
          actorSkill: { component: 'skills:melee_skill' },
          formula: 'ratio',
        },
      };

      const context = createContext(actionDef, [{ entityId: 'target-1' }]);

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should log debug message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Injected chance 67%')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("action 'weapons:swing_at_target'")
      );
    });
  });
});
