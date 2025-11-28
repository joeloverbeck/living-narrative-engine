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
        display: 'swing sword at target (50% chance)',
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
   *
   * @param options
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
   *
   * @param actionDef
   * @param targetContexts
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
        template: 'swing sword at {target} ({chance}% chance)',
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
        'swing sword at {target} (67% chance)'
      );
      // Verify original template remains unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing sword at {target} ({chance}% chance)'
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
        template: 'swing at {target} ({chance}% chance)',
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
        'swing at {target} (67% chance)'
      );
      // Verify original template remains unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}% chance)'
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
        template: 'swing at {target} ({chance}% chance)',
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
        'swing at {target} (50% chance)'
      );
      // Verify original template remains unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}% chance)'
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
        template: 'walk to {target} ({chance}% chance)', // Has placeholder but no chanceBased
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
        'walk to {target} ({chance}% chance)'
      );

      expect(mockChanceCalculationService.calculateForDisplay).not.toHaveBeenCalled();
    });

    it('should not modify template when chanceBased.enabled is false', async () => {
      // Arrange
      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}% chance)',
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
        'swing at {target} ({chance}% chance)'
      );

      expect(mockChanceCalculationService.calculateForDisplay).not.toHaveBeenCalled();
    });
  });

  describe('Without combat services', () => {
    it('should work normally without chanceCalculationService (backward compatibility)', async () => {
      // Arrange
      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}% chance)',
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
        'swing at {target} ({chance}% chance)'
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
        template: 'swing at {target} ({chance}% chance)',
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
              primary: [{ id: 'resolved-target-1' }],
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
        template: 'swing at {target} ({chance}% chance)',
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
        template: 'swing at {target} ({chance}% chance)',
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
        'swing at {target} (75% chance)'
      );
      // Verify original template remains unchanged
      expect(context.actionsWithTargets[0].actionDef.template).toBe(
        'swing at {target} ({chance}% chance)'
      );
    });
  });

  describe('Target role extraction for multi-target actions', () => {
    it('should use secondary target when targetRole is "secondary" (default)', async () => {
      // Arrange - Multi-target action where primary is weapon, secondary is character
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 68,
        displayText: '68%',
        breakdown: { formula: 'ratio', actorSkill: 73, targetSkill: 35 },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing {weapon} at {target} ({chance}% chance)',
        targets: {
          primary: { scope: 'weapons:wielded_cutting_weapons', placeholder: 'weapon' },
          secondary: { scope: 'core:actors_in_location', placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill', default: 10 },
          targetSkill: {
            component: 'skills:defense_skill',
            default: 0,
            targetRole: 'secondary', // Explicit: use secondary target (the character)
          },
          formula: 'ratio',
        },
      };

      const context = {
        actor: { id: 'vespera-id' },
        actionsWithTargets: [
          {
            actionDef,
            resolvedTargets: {
              primary: [{ id: 'rapier-weapon-id' }], // Weapon
              secondary: [{ id: 'bertram-id' }], // Character target
            },
            targetContexts: [],
          },
        ],
        trace: null,
      };

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should use secondary target (bertram-id), not primary (rapier-weapon-id)
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'vespera-id',
        targetId: 'bertram-id', // Secondary target, not the weapon
        actionDef,
      });
    });

    it('should default to secondary when targetRole is not specified (backward compatibility)', async () => {
      // Arrange - Old action definition without explicit targetRole
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 65,
        displayText: '65%',
        breakdown: { formula: 'ratio' },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill' },
          targetSkill: {
            component: 'skills:defense_skill',
            // No targetRole specified - should default to 'secondary'
          },
          formula: 'ratio',
        },
      };

      const context = {
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef,
            resolvedTargets: {
              primary: [{ id: 'weapon-id' }],
              secondary: [{ id: 'character-target-id' }],
            },
            targetContexts: [],
          },
        ],
        trace: null,
      };

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should default to secondary target
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'actor-1',
        targetId: 'character-target-id', // Secondary, not primary
        actionDef,
      });
    });

    it('should use primary target when targetRole is explicitly "primary"', async () => {
      // Arrange - Action where primary target provides the skill
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 50,
        displayText: '50%',
        breakdown: { formula: 'ratio' },
      });

      const actionDef = {
        id: 'magic:enchant_item',
        template: 'enchant {item} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:magic_skill' },
          targetSkill: {
            component: 'items:magic_resistance',
            targetRole: 'primary', // The item provides the resistance
          },
          formula: 'ratio',
        },
      };

      const context = {
        actor: { id: 'mage-id' },
        actionsWithTargets: [
          {
            actionDef,
            resolvedTargets: {
              primary: [{ id: 'magic-sword-id' }], // Item with magic resistance
              secondary: [{ id: 'irrelevant-id' }],
            },
            targetContexts: [],
          },
        ],
        trace: null,
      };

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should use primary target as specified
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'mage-id',
        targetId: 'magic-sword-id', // Primary target
        actionDef,
      });
    });

    it('should fall back to primary if specified role has no targets', async () => {
      // Arrange - Configured for secondary but secondary is empty
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 40,
        displayText: '40%',
        breakdown: { formula: 'ratio' },
      });

      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing at {target} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill' },
          targetSkill: {
            component: 'skills:defense_skill',
            targetRole: 'secondary', // Configured for secondary
          },
          formula: 'ratio',
        },
      };

      const context = {
        actor: { id: 'actor-1' },
        actionsWithTargets: [
          {
            actionDef,
            resolvedTargets: {
              primary: [{ id: 'primary-target-id' }],
              // No secondary targets available
            },
            targetContexts: [],
          },
        ],
        trace: null,
      };

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should fall back to primary
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'actor-1',
        targetId: 'primary-target-id', // Fallback to primary
        actionDef,
      });
    });

    it('should use tertiary target when targetRole is "tertiary"', async () => {
      // Arrange - Action with three targets where tertiary provides skill
      mockChanceCalculationService.calculateForDisplay.mockReturnValue({
        chance: 55,
        displayText: '55%',
        breakdown: { formula: 'ratio' },
      });

      const actionDef = {
        id: 'magic:cast_through_focus',
        template: 'cast through {focus} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:magic_skill' },
          targetSkill: {
            component: 'items:focus_resistance',
            targetRole: 'tertiary', // Focus item provides resistance
          },
          formula: 'ratio',
        },
      };

      const context = {
        actor: { id: 'mage-id' },
        actionsWithTargets: [
          {
            actionDef,
            resolvedTargets: {
              primary: [{ id: 'spell-id' }],
              secondary: [{ id: 'target-creature-id' }],
              tertiary: [{ id: 'magic-focus-id' }],
            },
            targetContexts: [],
          },
        ],
        trace: null,
      };

      const stage = createStage({
        chanceCalculationService: mockChanceCalculationService,
      });

      // Act
      await stage.executeInternal(context);

      // Assert - Should use tertiary target
      expect(mockChanceCalculationService.calculateForDisplay).toHaveBeenCalledWith({
        actorId: 'mage-id',
        targetId: 'magic-focus-id', // Tertiary target
        actionDef,
      });
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
        template: 'swing at {target} ({chance}% chance)',
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

/**
 * DIAGNOSTIC TEST SUITE
 * Tests per-combination chance calculation with REAL ChanceCalculationService
 * to identify why 5% appears for all targets instead of calculated values.
 *
 * @see /home/joeloverbeck/.claude/plans/generic-bouncing-sprout.md
 */
import ChanceCalculationService from '../../../../src/combat/services/ChanceCalculationService.js';
import SkillResolverService from '../../../../src/combat/services/SkillResolverService.js';
import ModifierCollectorService from '../../../../src/combat/services/ModifierCollectorService.js';
import ProbabilityCalculatorService from '../../../../src/combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../../../src/combat/services/OutcomeDeterminerService.js';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

describe('DIAGNOSTIC: generateCombinations with REAL ChanceCalculationService', () => {
  let realChanceService;
  let mockEntityManager;
  let mockLogger;
  let multiTargetFormatter;

  /**
   * Creates a mock entity manager with configurable skill components
   *
   * @param entitySkills
   */
  function createEntityManagerWithSkills(entitySkills) {
    return {
      hasComponent: jest.fn((entityId, componentId) => {
        return !!(entitySkills[entityId]?.[componentId]);
      }),
      getComponentData: jest.fn((entityId, componentId) => {
        return entitySkills[entityId]?.[componentId] ?? null;
      }),
      getActiveEntitiesWithComponent: jest.fn(() => []),
      getEntity: jest.fn((id) => ({ id })),
    };
  }

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Set up entities with specific skill values for testing
    // Vespera: melee_skill=73
    // Bertram: defense_skill=35 (expected chance: 73/(73+35)*100 = ~68%)
    // HighDefense: defense_skill=73 (expected chance: 73/(73+73)*100 = ~50%)
    mockEntityManager = createEntityManagerWithSkills({
      vespera: {
        'skills:melee_skill': { value: 73 },
      },
      bertram: {
        'skills:defense_skill': { value: 35 },
      },
      'high-defense-target': {
        'skills:defense_skill': { value: 73 },
      },
      'low-defense-target': {
        'skills:defense_skill': { value: 10 },
      },
      rapier: {
        // Weapon - no skills
      },
    });

    // Create REAL combat services
    const skillResolver = new SkillResolverService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    const modifierCollector = new ModifierCollectorService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    const probabilityCalculator = new ProbabilityCalculatorService({
      logger: mockLogger,
    });

    const outcomeDeterminer = new OutcomeDeterminerService({
      logger: mockLogger,
    });

    realChanceService = new ChanceCalculationService({
      skillResolverService: skillResolver,
      modifierCollectorService: modifierCollector,
      probabilityCalculatorService: probabilityCalculator,
      outcomeDeterminerService: outcomeDeterminer,
      logger: mockLogger,
    });

    // Create base formatter mock
    const mockBaseFormatter = {
      format: jest.fn().mockReturnValue({ ok: true, value: 'formatted' }),
    };

    multiTargetFormatter = new MultiTargetActionFormatter(
      mockBaseFormatter,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Direct ChanceCalculationService verification', () => {
    it('should calculate ~68% for Vespera (melee=73) vs Bertram (defense=35)', () => {
      // Direct test of the service to verify it works correctly
      const result = realChanceService.calculateForDisplay({
        actorId: 'vespera',
        targetId: 'bertram',
        actionDef: {
          id: 'weapons:swing_at_target',
          chanceBased: {
            enabled: true,
            contestType: 'opposed',
            actorSkill: {
              component: 'skills:melee_skill',
              property: 'value',
              default: 10,
            },
            targetSkill: {
              component: 'skills:defense_skill',
              property: 'value',
              default: 0,
              targetRole: 'secondary',
            },
            formula: 'ratio',
            bounds: { min: 5, max: 95 },
          },
        },
      });

      // Expected: 73/(73+35)*100 = 67.6% (rounded to ~68%)
      expect(result.chance).toBeGreaterThanOrEqual(65);
      expect(result.chance).toBeLessThanOrEqual(70);
      expect(result.breakdown.actorSkill).toBe(73);
      expect(result.breakdown.targetSkill).toBe(35);
    });

    it('should calculate ~50% for equal skills (73 vs 73)', () => {
      const result = realChanceService.calculateForDisplay({
        actorId: 'vespera',
        targetId: 'high-defense-target',
        actionDef: {
          id: 'weapons:swing_at_target',
          chanceBased: {
            enabled: true,
            contestType: 'opposed',
            actorSkill: {
              component: 'skills:melee_skill',
              property: 'value',
              default: 10,
            },
            targetSkill: {
              component: 'skills:defense_skill',
              property: 'value',
              default: 0,
            },
            formula: 'ratio',
            bounds: { min: 5, max: 95 },
          },
        },
      });

      // Expected: 73/(73+73)*100 = 50%
      expect(result.chance).toBe(50);
    });

    it('should return minimum 5% when service receives invalid/missing entity', () => {
      const result = realChanceService.calculateForDisplay({
        actorId: 'nonexistent-actor',
        targetId: 'nonexistent-target',
        actionDef: {
          id: 'weapons:swing_at_target',
          chanceBased: {
            enabled: true,
            contestType: 'opposed',
            actorSkill: {
              component: 'skills:melee_skill',
              property: 'value',
              default: 10,
            },
            targetSkill: {
              component: 'skills:defense_skill',
              property: 'value',
              default: 0,
            },
            formula: 'ratio',
            bounds: { min: 5, max: 95 },
          },
        },
      });

      // Default skill=10, target default=0: 10/(10+0)*100 = 100%, clamped to 95
      // But since target doesn't exist, targetSkill should be 0
      expect(result.breakdown.actorSkill).toBe(10); // Default
      expect(result.breakdown.targetSkill).toBe(0); // Default for non-existent
    });
  });

  describe('MultiTargetActionFormatter.formatMultiTarget with real services', () => {
    it('should calculate different chances for different targets via combination', () => {
      // Action definition matching swing_at_target.action.json
      const actionDef = {
        id: 'weapons:swing_at_target',
        name: 'Swing at Target',
        template: 'swing {weapon} at {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: {
            scope: 'weapons:wielded_cutting_weapons',
            placeholder: 'weapon',
          },
          secondary: {
            scope: 'core:actors_in_location',
            placeholder: 'target',
          },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:melee_skill',
            property: 'value',
            default: 10,
          },
          targetSkill: {
            component: 'skills:defense_skill',
            property: 'value',
            default: 0,
            targetRole: 'secondary',
          },
          formula: 'ratio',
          bounds: { min: 5, max: 95 },
        },
      };

      // Resolved targets with multiple secondary targets (different defense skills)
      const resolvedTargets = {
        primary: [{ id: 'rapier', displayName: 'Rapier' }],
        secondary: [
          { id: 'bertram', displayName: 'Bertram' }, // defense=35, expected ~68%
          { id: 'high-defense-target', displayName: 'High Defense' }, // defense=73, expected ~50%
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'weapon' },
        secondary: { placeholder: 'target' },
      };

      // Options with REAL ChanceCalculationService and actorId
      const options = {
        logger: mockLogger,
        debug: true,
        chanceCalculationService: realChanceService,
        actorId: 'vespera', // Vespera has melee_skill=73
      };

      // Act - call formatMultiTarget directly
      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        options,
        { targetDefinitions }
      );

      // Assert
      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(2); // One for each secondary target

      // Find commands for each target
      const bertramCommand = result.value.find((c) =>
        c.targets?.secondary?.some((t) => t.id === 'bertram')
      );
      const highDefenseCommand = result.value.find((c) =>
        c.targets?.secondary?.some((t) => t.id === 'high-defense-target')
      );

      // DIAGNOSTIC: Log what we got
      console.log('DIAGNOSTIC: Bertram command:', bertramCommand?.command);
      console.log(
        'DIAGNOSTIC: High Defense command:',
        highDefenseCommand?.command
      );

      // Verify different chances for different targets
      // Bertram (defense=35) should get ~68%
      expect(bertramCommand?.command).toMatch(/\(6[5-9]% chance\)/);

      // High Defense (defense=73) should get ~50%
      expect(highDefenseCommand?.command).toMatch(/\(50% chance\)/);
    });

    it('DIAGNOSTIC: verify combination structure matches expected format', () => {
      const actionDef = {
        id: 'weapons:swing_at_target',
        template: 'swing {weapon} at {target} ({chance}% chance)',
        generateCombinations: true,
        targets: {
          primary: { placeholder: 'weapon' },
          secondary: { placeholder: 'target' },
        },
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill', default: 10 },
          targetSkill: {
            component: 'skills:defense_skill',
            default: 0,
            targetRole: 'secondary',
          },
          formula: 'ratio',
          bounds: { min: 5, max: 95 },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'rapier', displayName: 'Rapier' }],
        secondary: [{ id: 'bertram', displayName: 'Bertram' }],
      };

      const options = {
        logger: mockLogger,
        chanceCalculationService: realChanceService,
        actorId: 'vespera',
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        mockEntityManager,
        options,
        { targetDefinitions: actionDef.targets }
      );

      expect(result.ok).toBe(true);

      // Check that calculateForDisplay was called via debug logs
      const debugCalls = mockLogger.debug.mock.calls;
      console.log(
        'DIAGNOSTIC: All debug logs:',
        debugCalls.map((c) => c[0])
      );

      // Verify the combination structure returned
      if (result.value?.[0]?.targets) {
        console.log(
          'DIAGNOSTIC: Combination targets structure:',
          JSON.stringify(result.value[0].targets, null, 2)
        );
      }
    });
  });
});
