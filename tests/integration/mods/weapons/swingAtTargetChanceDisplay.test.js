/**
 * @file Integration tests for chance-based action display in ActionFormattingStage
 * Tests that {chance} placeholder is correctly replaced with calculated probability
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
  let mockSkillResolverService;
  let mockProbabilityCalculatorService;

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

    mockSkillResolverService = {
      getSkillValue: jest.fn().mockReturnValue({
        baseValue: 50,
        hasComponent: true,
      }),
    };

    mockProbabilityCalculatorService = {
      calculate: jest.fn().mockReturnValue({
        baseChance: 67,
        finalChance: 67,
        breakdown: {
          formula: 'ratio',
          rawCalculation: 67,
          afterModifiers: 67,
          bounds: { min: 5, max: 95 },
        },
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Creates a stage instance with optional combat services
   */
  function createStage(options = {}) {
    return new ActionFormattingStage({
      commandFormatter: mockCommandFormatter,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
      getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
      errorContextBuilder: mockErrorContextBuilder,
      logger: mockLogger,
      skillResolverService: options.skillResolverService ?? null,
      probabilityCalculatorService: options.probabilityCalculatorService ?? null,
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Template should have been modified
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing sword at {target} (67%)'
      );

      // Verify services were called
      expect(mockSkillResolverService.getSkillValue).toHaveBeenCalledWith(
        'actor-1',
        'skills:melee_skill',
        0
      );
      expect(mockProbabilityCalculatorService.calculate).toHaveBeenCalled();
    });
  });

  describe('Opposed skill check display', () => {
    it('should calculate correct chance for actor skill 50 vs target skill 25', async () => {
      // Arrange - Setup specific skill values
      mockSkillResolverService.getSkillValue
        .mockReturnValueOnce({ baseValue: 50, hasComponent: true }) // actor
        .mockReturnValueOnce({ baseValue: 25, hasComponent: true }); // target

      // ratio formula: actor / (actor + target) * 100 = 50 / 75 * 100 = 66.67
      mockProbabilityCalculatorService.calculate.mockReturnValue({
        baseChance: 66.67,
        finalChance: 67,
        breakdown: { formula: 'ratio' },
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert
      expect(mockSkillResolverService.getSkillValue).toHaveBeenNthCalledWith(
        1,
        'actor-1',
        'skills:melee_skill',
        0
      );
      expect(mockSkillResolverService.getSkillValue).toHaveBeenNthCalledWith(
        2,
        'target-1',
        'skills:defense_skill',
        0
      );

      expect(mockProbabilityCalculatorService.calculate).toHaveBeenCalledWith({
        actorSkill: 50,
        targetSkill: 25,
        difficulty: 0,
        formula: 'ratio',
        bounds: undefined,
      });

      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} (67%)'
      );
    });
  });

  describe('Missing skill fallback', () => {
    it('should use default value when skill component is missing', async () => {
      // Arrange - Actor has no skill component
      mockSkillResolverService.getSkillValue.mockReturnValue({
        baseValue: 10, // default value
        hasComponent: false,
      });

      mockProbabilityCalculatorService.calculate.mockReturnValue({
        baseChance: 50,
        finalChance: 50,
        breakdown: { formula: 'ratio' },
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should use default value 10
      expect(mockSkillResolverService.getSkillValue).toHaveBeenCalledWith(
        'actor-1',
        'skills:melee_skill',
        10
      );

      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} (50%)'
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Template unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing sword at {target}'
      );

      // Services should NOT be called since no placeholder
      expect(mockProbabilityCalculatorService.calculate).not.toHaveBeenCalled();
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Template unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'walk to {target} ({chance}%)'
      );

      expect(mockSkillResolverService.getSkillValue).not.toHaveBeenCalled();
      expect(mockProbabilityCalculatorService.calculate).not.toHaveBeenCalled();
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Template unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}%)'
      );

      expect(mockSkillResolverService.getSkillValue).not.toHaveBeenCalled();
    });
  });

  describe('Without combat services', () => {
    it('should work normally without combat services (backward compatibility)', async () => {
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

      // Create stage WITHOUT combat services
      const stage = createStage();

      // Act
      await stage.executeInternal(context);

      // Assert - Template unchanged because no services available
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}%)'
      );
    });
  });

  describe('Target extraction', () => {
    it('should extract target from resolvedTargets when available', async () => {
      // Arrange
      mockProbabilityCalculatorService.calculate.mockReturnValue({
        finalChance: 60,
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should use resolvedTargets.primary, not targetContexts
      expect(mockSkillResolverService.getSkillValue).toHaveBeenNthCalledWith(
        2,
        'resolved-target-1',
        'skills:defense_skill',
        0
      );
    });

    it('should fall back to targetContexts when resolvedTargets is not available', async () => {
      // Arrange
      mockProbabilityCalculatorService.calculate.mockReturnValue({
        finalChance: 55,
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should use targetContexts fallback
      expect(mockSkillResolverService.getSkillValue).toHaveBeenNthCalledWith(
        2,
        'fallback-target',
        'skills:defense_skill',
        0
      );
    });
  });

  describe('Formula and bounds', () => {
    it('should pass custom formula and bounds to probability calculator', async () => {
      // Arrange
      mockProbabilityCalculatorService.calculate.mockReturnValue({
        finalChance: 75,
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert
      expect(mockProbabilityCalculatorService.calculate).toHaveBeenCalledWith({
        actorSkill: 50,
        targetSkill: 0,
        difficulty: 10,
        formula: 'logistic',
        bounds: { min: 10, max: 90 },
      });

      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} (75%)'
      );
    });
  });

  describe('Logging', () => {
    it('should log debug message when injecting chance', async () => {
      // Arrange
      mockProbabilityCalculatorService.calculate.mockReturnValue({
        finalChance: 67,
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
        skillResolverService: mockSkillResolverService,
        probabilityCalculatorService: mockProbabilityCalculatorService,
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
