import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ChanceCalculationService from '../../../../src/combat/services/ChanceCalculationService.js';

/**
 * Creates minimal mocks for dependencies
 *
 * @returns {object} Object containing mocked dependencies
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    skillResolverService: {
      getSkillValue: jest.fn(),
    },
    modifierCollectorService: {
      collectModifiers: jest.fn(),
    },
    probabilityCalculatorService: {
      calculate: jest.fn(),
    },
    outcomeDeterminerService: {
      determine: jest.fn(),
    },
  };
}

/**
 * Creates a standard action definition with chanceBased configuration
 *
 * @param {object} [overrides] - Optional overrides for the chanceBased config
 * @returns {object} Action definition
 */
function createChanceBasedActionDef(overrides = {}) {
  return {
    id: 'test:melee_attack',
    chanceBased: {
      enabled: true,
      contestType: 'simple',
      actorSkill: {
        component: 'skills:melee_skill',
        default: 0,
      },
      formula: 'ratio',
      fixedDifficulty: 0,
      bounds: { min: 5, max: 95 },
      ...overrides,
    },
  };
}

describe('ChanceCalculationService', () => {
  let service;
  let mocks;

  beforeEach(() => {
    mocks = createMocks();

    // Set up default mock returns
    mocks.skillResolverService.getSkillValue.mockReturnValue({
      baseValue: 50,
      hasComponent: true,
    });

    mocks.modifierCollectorService.collectModifiers.mockReturnValue({
      modifiers: [],
      totalModifier: 0,
    });

    mocks.probabilityCalculatorService.calculate.mockReturnValue({
      baseChance: 50,
      finalChance: 55,
    });

    mocks.outcomeDeterminerService.determine.mockReturnValue({
      outcome: 'SUCCESS',
      roll: 42,
      margin: -13,
      isCritical: false,
    });

    service = new ChanceCalculationService({
      skillResolverService: mocks.skillResolverService,
      modifierCollectorService: mocks.modifierCollectorService,
      probabilityCalculatorService: mocks.probabilityCalculatorService,
      outcomeDeterminerService: mocks.outcomeDeterminerService,
      logger: mocks.logger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(ChanceCalculationService);
      expect(mocks.logger.debug).toHaveBeenCalledWith(
        'ChanceCalculationService: Initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: mocks.skillResolverService,
          modifierCollectorService: mocks.modifierCollectorService,
          probabilityCalculatorService: mocks.probabilityCalculatorService,
          outcomeDeterminerService: mocks.outcomeDeterminerService,
        });
      }).toThrow();
    });

    it('should throw error when skillResolverService is missing', () => {
      expect(() => {
        new ChanceCalculationService({
          modifierCollectorService: mocks.modifierCollectorService,
          probabilityCalculatorService: mocks.probabilityCalculatorService,
          outcomeDeterminerService: mocks.outcomeDeterminerService,
          logger: mocks.logger,
        });
      }).toThrow();
    });

    it('should throw error when modifierCollectorService is missing', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: mocks.skillResolverService,
          probabilityCalculatorService: mocks.probabilityCalculatorService,
          outcomeDeterminerService: mocks.outcomeDeterminerService,
          logger: mocks.logger,
        });
      }).toThrow();
    });

    it('should throw error when probabilityCalculatorService is missing', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: mocks.skillResolverService,
          modifierCollectorService: mocks.modifierCollectorService,
          outcomeDeterminerService: mocks.outcomeDeterminerService,
          logger: mocks.logger,
        });
      }).toThrow();
    });

    it('should throw error when outcomeDeterminerService is missing', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: mocks.skillResolverService,
          modifierCollectorService: mocks.modifierCollectorService,
          probabilityCalculatorService: mocks.probabilityCalculatorService,
          logger: mocks.logger,
        });
      }).toThrow();
    });

    it('should throw error when logger missing required methods', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: mocks.skillResolverService,
          modifierCollectorService: mocks.modifierCollectorService,
          probabilityCalculatorService: mocks.probabilityCalculatorService,
          outcomeDeterminerService: mocks.outcomeDeterminerService,
          logger: { debug: jest.fn() }, // Missing warn, error, info
        });
      }).toThrow();
    });

    it('should throw error when skillResolverService missing required methods', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: {}, // Missing getSkillValue
          modifierCollectorService: mocks.modifierCollectorService,
          probabilityCalculatorService: mocks.probabilityCalculatorService,
          outcomeDeterminerService: mocks.outcomeDeterminerService,
          logger: mocks.logger,
        });
      }).toThrow();
    });

    it('should throw error when modifierCollectorService missing required methods', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: mocks.skillResolverService,
          modifierCollectorService: {}, // Missing collectModifiers
          probabilityCalculatorService: mocks.probabilityCalculatorService,
          outcomeDeterminerService: mocks.outcomeDeterminerService,
          logger: mocks.logger,
        });
      }).toThrow();
    });

    it('should throw error when probabilityCalculatorService missing required methods', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: mocks.skillResolverService,
          modifierCollectorService: mocks.modifierCollectorService,
          probabilityCalculatorService: {}, // Missing calculate
          outcomeDeterminerService: mocks.outcomeDeterminerService,
          logger: mocks.logger,
        });
      }).toThrow();
    });

    it('should throw error when outcomeDeterminerService missing required methods', () => {
      expect(() => {
        new ChanceCalculationService({
          skillResolverService: mocks.skillResolverService,
          modifierCollectorService: mocks.modifierCollectorService,
          probabilityCalculatorService: mocks.probabilityCalculatorService,
          outcomeDeterminerService: {}, // Missing determine
          logger: mocks.logger,
        });
      }).toThrow();
    });
  });

  describe('calculateForDisplay', () => {
    describe('when action is not chance-based', () => {
      it('should return 100% chance when chanceBased is not enabled', () => {
        const actionDef = {
          id: 'test:action',
          chanceBased: { enabled: false },
        };

        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(result).toEqual({
          chance: 100,
          displayText: '',
          activeTags: [],
          breakdown: { reason: 'Action is not chance-based' },
        });
        expect(mocks.skillResolverService.getSkillValue).not.toHaveBeenCalled();
      });

      it('should return 100% chance when chanceBased is undefined', () => {
        const actionDef = { id: 'test:action' };

        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(result).toEqual({
          chance: 100,
          displayText: '',
          activeTags: [],
          breakdown: { reason: 'Action is not chance-based' },
        });
      });

      it('should return 100% chance when actionDef is null', () => {
        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef: null,
        });

        expect(result).toEqual({
          chance: 100,
          displayText: '',
          activeTags: [],
          breakdown: { reason: 'Action is not chance-based' },
        });
      });
    });

    describe('when action is chance-based (simple check)', () => {
      it('should calculate and return display result for simple skill check', () => {
        const actionDef = createChanceBasedActionDef();

        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.skillResolverService.getSkillValue).toHaveBeenCalledWith(
          'actor-123',
          'skills:melee_skill',
          0
        );
        expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith({
          actorId: 'actor-123',
          primaryTargetId: undefined,
          actionConfig: actionDef.chanceBased,
        });
        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith({
          actorSkill: 50,
          targetSkill: 0,
          difficulty: 0,
          formula: 'ratio',
          modifiers: { modifiers: [], totalModifier: 0 },
          bounds: { min: 5, max: 95 },
        });

        expect(result.chance).toBe(55);
        expect(result.displayText).toBe('55%');
        expect(result.breakdown).toEqual({
          actorSkill: 50,
          targetSkill: 0,
          baseChance: 50,
          finalChance: 55,
          modifiers: [],
          formula: 'ratio',
        });
      });

      it('should use default skill value from actionDef', () => {
        const actionDef = createChanceBasedActionDef({
          actorSkill: {
            component: 'skills:melee_skill',
            default: 25,
          },
        });

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.skillResolverService.getSkillValue).toHaveBeenCalledWith(
          'actor-123',
          'skills:melee_skill',
          25
        );
      });

      it('should round final chance to integer', () => {
        mocks.probabilityCalculatorService.calculate.mockReturnValue({
          baseChance: 50.7,
          finalChance: 55.4,
        });

        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.chance).toBe(55);
        expect(result.displayText).toBe('55%');
      });

      it('should round up when chance is .5 or higher', () => {
        mocks.probabilityCalculatorService.calculate.mockReturnValue({
          baseChance: 50,
          finalChance: 55.5,
        });

        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.chance).toBe(56);
        expect(result.displayText).toBe('56%');
      });
    });

    describe('when action is chance-based (opposed check)', () => {
      it('should calculate target skill for opposed checks', () => {
        const actionDef = createChanceBasedActionDef({
          contestType: 'opposed',
          targetSkill: {
            component: 'skills:defense_skill',
            default: 10,
          },
        });

        mocks.skillResolverService.getSkillValue
          .mockReturnValueOnce({ baseValue: 50, hasComponent: true }) // actor skill
          .mockReturnValueOnce({ baseValue: 30, hasComponent: true }); // target skill

        service.calculateForDisplay({
          actorId: 'actor-123',
          targetId: 'target-456',
          actionDef,
        });

        expect(mocks.skillResolverService.getSkillValue).toHaveBeenCalledTimes(2);
        expect(mocks.skillResolverService.getSkillValue).toHaveBeenNthCalledWith(
          1,
          'actor-123',
          'skills:melee_skill',
          0
        );
        expect(mocks.skillResolverService.getSkillValue).toHaveBeenNthCalledWith(
          2,
          'target-456',
          'skills:defense_skill',
          10
        );

        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({
            actorSkill: 50,
            targetSkill: 30,
          })
        );
      });

      it('should not resolve target skill when targetId is missing', () => {
        const actionDef = createChanceBasedActionDef({
          contestType: 'opposed',
          targetSkill: {
            component: 'skills:defense_skill',
            default: 10,
          },
        });

        service.calculateForDisplay({
          actorId: 'actor-123',
          // targetId not provided
          actionDef,
        });

        expect(mocks.skillResolverService.getSkillValue).toHaveBeenCalledTimes(1);
        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({
            targetSkill: 0,
          })
        );
      });

      it('should not resolve target skill when contestType is not opposed', () => {
        const actionDef = createChanceBasedActionDef({
          contestType: 'simple',
          targetSkill: {
            component: 'skills:defense_skill',
            default: 10,
          },
        });

        service.calculateForDisplay({
          actorId: 'actor-123',
          targetId: 'target-456',
          actionDef,
        });

        expect(mocks.skillResolverService.getSkillValue).toHaveBeenCalledTimes(1);
      });
    });

    describe('with different formulas', () => {
      it('should pass logistic formula to calculator', () => {
        const actionDef = createChanceBasedActionDef({ formula: 'logistic' });

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({ formula: 'logistic' })
        );
      });

      it('should pass linear formula to calculator', () => {
        const actionDef = createChanceBasedActionDef({ formula: 'linear' });

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({ formula: 'linear' })
        );
      });

      it('should default to ratio formula when not specified', () => {
        const actionDef = createChanceBasedActionDef();
        delete actionDef.chanceBased.formula;

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({ formula: 'ratio' })
        );
      });
    });

    describe('with custom bounds', () => {
      it('should pass custom bounds to calculator', () => {
        const actionDef = createChanceBasedActionDef({
          bounds: { min: 10, max: 90 },
        });

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({ bounds: { min: 10, max: 90 } })
        );
      });

      it('should use default bounds when not specified', () => {
        const actionDef = createChanceBasedActionDef();
        delete actionDef.chanceBased.bounds;

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({ bounds: { min: 5, max: 95 } })
        );
      });
    });

    describe('with difficulty modifier', () => {
      it('should pass fixedDifficulty to calculator', () => {
        const actionDef = createChanceBasedActionDef({ fixedDifficulty: -10 });

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({ difficulty: -10 })
        );
      });

      it('should default to 0 difficulty when not specified', () => {
        const actionDef = createChanceBasedActionDef();
        delete actionDef.chanceBased.fixedDifficulty;

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.probabilityCalculatorService.calculate).toHaveBeenCalledWith(
          expect.objectContaining({ difficulty: 0 })
        );
      });
    });

    describe('logging', () => {
      it('should log debug message with action ID', () => {
        const actionDef = createChanceBasedActionDef();

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.logger.debug).toHaveBeenCalledWith(
          'ChanceCalculationService: Calculating display chance for test:melee_attack'
        );
      });

      it('should log unknown when action ID is missing', () => {
        const actionDef = createChanceBasedActionDef();
        delete actionDef.id;

        service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.logger.debug).toHaveBeenCalledWith(
          'ChanceCalculationService: Calculating display chance for unknown'
        );
      });
    });
  });

  describe('resolveOutcome', () => {
    describe('when action is not chance-based', () => {
      it('should return automatic success when chanceBased is not enabled', () => {
        const actionDef = {
          id: 'test:action',
          chanceBased: { enabled: false },
        };

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef,
        });

        expect(result).toEqual({
          outcome: 'SUCCESS',
          roll: 0,
          threshold: 100,
          margin: -100,
          modifiers: [],
          activeTags: [],
          isCritical: false,
        });
        expect(mocks.outcomeDeterminerService.determine).not.toHaveBeenCalled();
      });

      it('should return automatic success when actionDef is null', () => {
        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: null,
        });

        expect(result.outcome).toBe('SUCCESS');
        expect(result.isCritical).toBe(false);
      });
    });

    describe('when action is chance-based', () => {
      it('should resolve outcome using calculated chance', () => {
        const actionDef = createChanceBasedActionDef();

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.outcomeDeterminerService.determine).toHaveBeenCalledWith({
          finalChance: 55,
          thresholds: { criticalSuccess: 5, criticalFailure: 95 },
          forcedRoll: undefined,
        });

        expect(result).toEqual({
          outcome: 'SUCCESS',
          roll: 42,
          threshold: 55,
          margin: -13,
          modifiers: [],
          activeTags: [],
          isCritical: false,
        });
      });

      it('should use custom outcome thresholds', () => {
        const actionDef = createChanceBasedActionDef({
          outcomes: {
            criticalSuccess: 3,
            criticalFailure: 98,
          },
        });

        service.resolveOutcome({
          actorId: 'actor-123',
          actionDef,
        });

        expect(mocks.outcomeDeterminerService.determine).toHaveBeenCalledWith(
          expect.objectContaining({
            thresholds: { criticalSuccess: 3, criticalFailure: 98 },
          })
        );
      });

      it('should pass forcedRoll for deterministic testing', () => {
        const actionDef = createChanceBasedActionDef();

        service.resolveOutcome({
          actorId: 'actor-123',
          actionDef,
          forcedRoll: 25,
        });

        expect(mocks.outcomeDeterminerService.determine).toHaveBeenCalledWith(
          expect.objectContaining({ forcedRoll: 25 })
        );
      });

      it('should include target in opposed checks', () => {
        const actionDef = createChanceBasedActionDef({
          contestType: 'opposed',
          targetSkill: {
            component: 'skills:defense_skill',
            default: 0,
          },
        });

        mocks.skillResolverService.getSkillValue
          .mockReturnValueOnce({ baseValue: 50, hasComponent: true })
          .mockReturnValueOnce({ baseValue: 30, hasComponent: true });

        service.resolveOutcome({
          actorId: 'actor-123',
          targetId: 'target-456',
          actionDef,
        });

        expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith(
          expect.objectContaining({ primaryTargetId: 'target-456' })
        );
      });
    });

    describe('different outcome types', () => {
      it('should return CRITICAL_SUCCESS outcome', () => {
        mocks.outcomeDeterminerService.determine.mockReturnValue({
          outcome: 'CRITICAL_SUCCESS',
          roll: 3,
          margin: -52,
          isCritical: true,
        });

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.outcome).toBe('CRITICAL_SUCCESS');
        expect(result.isCritical).toBe(true);
      });

      it('should return FAILURE outcome', () => {
        mocks.outcomeDeterminerService.determine.mockReturnValue({
          outcome: 'FAILURE',
          roll: 70,
          margin: 15,
          isCritical: false,
        });

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.outcome).toBe('FAILURE');
        expect(result.margin).toBe(15);
      });

      it('should return FUMBLE outcome', () => {
        mocks.outcomeDeterminerService.determine.mockReturnValue({
          outcome: 'FUMBLE',
          roll: 98,
          margin: 43,
          isCritical: true,
        });

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.outcome).toBe('FUMBLE');
        expect(result.isCritical).toBe(true);
      });
    });

    describe('modifiers propagation', () => {
      it('should include modifiers from calculation in result', () => {
        mocks.modifierCollectorService.collectModifiers.mockReturnValue({
          modifiers: [
            { source: 'status:injured', value: -10 },
            { source: 'equipment:sword', value: +5 },
          ],
          totalModifier: -5,
        });
        mocks.probabilityCalculatorService.calculate.mockReturnValue({
          baseChance: 50,
          finalChance: 45,
        });

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.modifiers).toEqual([
          { source: 'status:injured', value: -10 },
          { source: 'equipment:sword', value: +5 },
        ]);
      });

      it('should handle empty modifiers array', () => {
        mocks.modifierCollectorService.collectModifiers.mockReturnValue({
          modifiers: [],
          totalModifier: 0,
        });

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.modifiers).toEqual([]);
      });

      it('should handle undefined modifiers in breakdown', () => {
        mocks.modifierCollectorService.collectModifiers.mockReturnValue({
          totalModifier: 0,
        });
        mocks.probabilityCalculatorService.calculate.mockReturnValue({
          baseChance: 50,
          finalChance: 50,
        });

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.modifiers).toEqual([]);
      });
    });

    describe('logging', () => {
      it('should log debug message with action ID', () => {
        service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(mocks.logger.debug).toHaveBeenCalledWith(
          'ChanceCalculationService: Resolving outcome for test:melee_attack'
        );
      });
    });
  });

  describe('multi-target parameter passing (DATDRIMODSYS-004)', () => {
    it('should pass primaryTargetId to modifier collector', () => {
      const actionDef = createChanceBasedActionDef();

      service.calculateForDisplay({
        actorId: 'actor-123',
        primaryTargetId: 'primary-target-456',
        actionDef,
      });

      expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-123',
          primaryTargetId: 'primary-target-456',
        })
      );
    });

    it('should pass secondaryTargetId to modifier collector', () => {
      const actionDef = createChanceBasedActionDef();

      service.calculateForDisplay({
        actorId: 'actor-123',
        secondaryTargetId: 'secondary-target-789',
        actionDef,
      });

      expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({
          secondaryTargetId: 'secondary-target-789',
        })
      );
    });

    it('should pass tertiaryTargetId to modifier collector', () => {
      const actionDef = createChanceBasedActionDef();

      service.calculateForDisplay({
        actorId: 'actor-123',
        tertiaryTargetId: 'tertiary-target-012',
        actionDef,
      });

      expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({
          tertiaryTargetId: 'tertiary-target-012',
        })
      );
    });

    it('should pass all target IDs together to modifier collector', () => {
      const actionDef = createChanceBasedActionDef();

      service.calculateForDisplay({
        actorId: 'actor-123',
        primaryTargetId: 'primary-456',
        secondaryTargetId: 'secondary-789',
        tertiaryTargetId: 'tertiary-012',
        actionDef,
      });

      expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith({
        actorId: 'actor-123',
        primaryTargetId: 'primary-456',
        secondaryTargetId: 'secondary-789',
        tertiaryTargetId: 'tertiary-012',
        actionConfig: actionDef.chanceBased,
      });
    });

    it('should support legacy targetId parameter (backward compatibility)', () => {
      const actionDef = createChanceBasedActionDef({
        contestType: 'opposed',
        targetSkill: {
          component: 'skills:defense_skill',
          default: 0,
        },
      });

      mocks.skillResolverService.getSkillValue
        .mockReturnValueOnce({ baseValue: 50, hasComponent: true }) // actor skill
        .mockReturnValueOnce({ baseValue: 30, hasComponent: true }); // target skill

      service.calculateForDisplay({
        actorId: 'actor-123',
        targetId: 'legacy-target-456', // Using legacy targetId
        actionDef,
      });

      // Should resolve to primaryTargetId internally
      expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryTargetId: 'legacy-target-456',
        })
      );
      // Should also use for skill resolution
      expect(mocks.skillResolverService.getSkillValue).toHaveBeenNthCalledWith(
        2,
        'legacy-target-456',
        'skills:defense_skill',
        0
      );
    });

    it('should prefer primaryTargetId over targetId when both provided', () => {
      const actionDef = createChanceBasedActionDef();

      service.calculateForDisplay({
        actorId: 'actor-123',
        targetId: 'legacy-target',
        primaryTargetId: 'new-primary-target',
        actionDef,
      });

      expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryTargetId: 'new-primary-target',
        })
      );
    });

    it('should pass multi-target IDs through resolveOutcome', () => {
      const actionDef = createChanceBasedActionDef();

      service.resolveOutcome({
        actorId: 'actor-123',
        primaryTargetId: 'primary-456',
        secondaryTargetId: 'secondary-789',
        tertiaryTargetId: 'tertiary-012',
        actionDef,
      });

      expect(mocks.modifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryTargetId: 'primary-456',
          secondaryTargetId: 'secondary-789',
          tertiaryTargetId: 'tertiary-012',
        })
      );
    });
  });

  describe('activeTags extraction (DATDRIMODSYS-004)', () => {
    it('should extract active tags from modifiers', () => {
      mocks.modifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [
          { type: 'flat', value: 10, tag: 'Flanking' },
          { type: 'flat', value: -5, tag: 'Injured' },
        ],
        totalFlat: 5,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor-123',
        actionDef: createChanceBasedActionDef(),
      });

      expect(result.activeTags).toEqual(['Flanking', 'Injured']);
    });

    it('should return empty activeTags when no modifiers have tags', () => {
      mocks.modifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [
          { type: 'flat', value: 10 },
          { type: 'flat', value: -5 },
        ],
        totalFlat: 5,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor-123',
        actionDef: createChanceBasedActionDef(),
      });

      expect(result.activeTags).toEqual([]);
    });

    it('should return empty activeTags when modifiers array is empty', () => {
      mocks.modifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [],
        totalFlat: 0,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor-123',
        actionDef: createChanceBasedActionDef(),
      });

      expect(result.activeTags).toEqual([]);
    });

    it('should return empty activeTags when modifiers is undefined', () => {
      mocks.modifierCollectorService.collectModifiers.mockReturnValue({
        totalFlat: 0,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor-123',
        actionDef: createChanceBasedActionDef(),
      });

      expect(result.activeTags).toEqual([]);
    });

    it('should filter out modifiers with null tags', () => {
      mocks.modifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [
          { type: 'flat', value: 10, tag: 'Flanking' },
          { type: 'flat', value: -5, tag: null },
          { type: 'flat', value: 5, tag: 'Blessed' },
        ],
        totalFlat: 10,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor-123',
        actionDef: createChanceBasedActionDef(),
      });

      expect(result.activeTags).toEqual(['Flanking', 'Blessed']);
    });

    it('should filter out modifiers with empty string tags', () => {
      mocks.modifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [
          { type: 'flat', value: 10, tag: 'Flanking' },
          { type: 'flat', value: -5, tag: '' },
          { type: 'flat', value: 5, tag: '   ' }, // whitespace-only
        ],
        totalFlat: 10,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor-123',
        actionDef: createChanceBasedActionDef(),
      });

      expect(result.activeTags).toEqual(['Flanking']);
    });

    it('should filter out non-string tags', () => {
      mocks.modifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [
          { type: 'flat', value: 10, tag: 'Flanking' },
          { type: 'flat', value: -5, tag: 123 }, // number
          { type: 'flat', value: 5, tag: { name: 'test' } }, // object
        ],
        totalFlat: 10,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor-123',
        actionDef: createChanceBasedActionDef(),
      });

      expect(result.activeTags).toEqual(['Flanking']);
    });

    it('should include activeTags in outcome result', () => {
      mocks.modifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [
          { type: 'flat', value: 10, tag: 'Flanking' },
          { type: 'flat', value: -5, tag: 'Injured' },
        ],
        totalFlat: 5,
        totalPercentage: 1,
      });

      const result = service.resolveOutcome({
        actorId: 'actor-123',
        actionDef: createChanceBasedActionDef(),
      });

      expect(result.activeTags).toEqual(['Flanking', 'Injured']);
    });

    it('should return empty activeTags in outcome for non-chance-based actions', () => {
      const actionDef = {
        id: 'test:action',
        chanceBased: { enabled: false },
      };

      const result = service.resolveOutcome({
        actorId: 'actor-123',
        actionDef,
      });

      expect(result.activeTags).toEqual([]);
    });
  });

  describe('integration between calculateForDisplay and resolveOutcome', () => {
    it('should produce consistent results when called with same inputs', () => {
      const actionDef = createChanceBasedActionDef();
      const params = { actorId: 'actor-123', actionDef };

      const displayResult = service.calculateForDisplay(params);
      const outcomeResult = service.resolveOutcome(params);

      // The threshold in outcome should match the chance in display
      expect(outcomeResult.threshold).toBe(displayResult.chance);
    });

    it('should use same skill resolution for both methods', () => {
      mocks.skillResolverService.getSkillValue.mockReturnValue({
        baseValue: 75,
        hasComponent: true,
      });
      mocks.probabilityCalculatorService.calculate.mockReturnValue({
        baseChance: 75,
        finalChance: 70,
      });

      const actionDef = createChanceBasedActionDef();

      service.calculateForDisplay({ actorId: 'actor-123', actionDef });
      service.resolveOutcome({ actorId: 'actor-123', actionDef });

      // Skill resolver should be called with same params both times
      expect(mocks.skillResolverService.getSkillValue).toHaveBeenNthCalledWith(
        1,
        'actor-123',
        'skills:melee_skill',
        0
      );
      expect(mocks.skillResolverService.getSkillValue).toHaveBeenNthCalledWith(
        2,
        'actor-123',
        'skills:melee_skill',
        0
      );
    });
  });
});
