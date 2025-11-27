/**
 * @file Integration tests for ChanceCalculationService
 * @description Tests the service with real sub-services to verify integration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ChanceCalculationService from '../../../src/combat/services/ChanceCalculationService.js';
import SkillResolverService from '../../../src/combat/services/SkillResolverService.js';
import ModifierCollectorService from '../../../src/combat/services/ModifierCollectorService.js';
import ProbabilityCalculatorService from '../../../src/combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../../src/combat/services/OutcomeDeterminerService.js';

/**
 * Creates a mock logger
 *
 * @returns {object} Mock logger
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates a mock entity manager with configurable component data
 *
 * @param {object} entityComponents - Map of entityId -> componentId -> componentData
 * @returns {object} Mock entity manager
 */
function createMockEntityManager(entityComponents = {}) {
  return {
    hasComponent: jest.fn((entityId, componentId) => {
      return !!(entityComponents[entityId]?.[componentId]);
    }),
    getComponentData: jest.fn((entityId, componentId) => {
      return entityComponents[entityId]?.[componentId] ?? null;
    }),
    getActiveEntitiesWithComponent: jest.fn(() => []),
  };
}

/**
 * Creates a standard action definition with chanceBased configuration
 *
 * @param {object} [overrides] - Optional overrides
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
      outcomes: {
        criticalSuccess: 5,
        criticalFailure: 95,
      },
      ...overrides,
    },
  };
}

describe('ChanceCalculationService Integration', () => {
  let service;
  let logger;
  let entityManager;

  describe('with real sub-services', () => {
    beforeEach(() => {
      logger = createMockLogger();
      entityManager = createMockEntityManager({
        'actor-123': {
          'skills:melee_skill': { value: 60 },
        },
        'target-456': {
          'skills:defense_skill': { value: 40 },
        },
        'unskilled-actor': {
          // No skill components
        },
      });

      // Create real sub-services
      const skillResolverService = new SkillResolverService({
        entityManager,
        logger,
      });

      const modifierCollectorService = new ModifierCollectorService({
        entityManager,
        logger,
      });

      const probabilityCalculatorService = new ProbabilityCalculatorService({
        logger,
      });

      const outcomeDeterminerService = new OutcomeDeterminerService({
        logger,
      });

      service = new ChanceCalculationService({
        skillResolverService,
        modifierCollectorService,
        probabilityCalculatorService,
        outcomeDeterminerService,
        logger,
      });
    });

    describe('calculateForDisplay', () => {
      it('should calculate chance for actor with skill component', () => {
        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });

        expect(result.chance).toBeGreaterThanOrEqual(5);
        expect(result.chance).toBeLessThanOrEqual(95);
        expect(result.displayText).toMatch(/^\d+%$/);
        expect(result.breakdown.actorSkill).toBe(60);
        expect(result.breakdown.formula).toBe('ratio');
      });

      it('should use default skill value for actor without skill component', () => {
        const result = service.calculateForDisplay({
          actorId: 'unskilled-actor',
          actionDef: createChanceBasedActionDef({
            actorSkill: {
              component: 'skills:melee_skill',
              default: 20,
            },
          }),
        });

        expect(result.breakdown.actorSkill).toBe(20);
      });

      it('should calculate opposed check with target skill', () => {
        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          targetId: 'target-456',
          actionDef: createChanceBasedActionDef({
            contestType: 'opposed',
            targetSkill: {
              component: 'skills:defense_skill',
              default: 0,
            },
          }),
        });

        expect(result.breakdown.actorSkill).toBe(60);
        expect(result.breakdown.targetSkill).toBe(40);
        // Should produce valid chance within bounds
        expect(result.chance).toBeGreaterThanOrEqual(5);
        expect(result.chance).toBeLessThanOrEqual(95);
      });

      it('should respect bounds constraints', () => {
        // Actor with very high skill
        entityManager = createMockEntityManager({
          'skilled-actor': {
            'skills:melee_skill': { value: 100 },
          },
        });

        const skillResolverService = new SkillResolverService({
          entityManager,
          logger,
        });

        const modifierCollectorService = new ModifierCollectorService({
          entityManager,
          logger,
        });

        const probabilityCalculatorService = new ProbabilityCalculatorService({
          logger,
        });

        const outcomeDeterminerService = new OutcomeDeterminerService({
          logger,
        });

        service = new ChanceCalculationService({
          skillResolverService,
          modifierCollectorService,
          probabilityCalculatorService,
          outcomeDeterminerService,
          logger,
        });

        const result = service.calculateForDisplay({
          actorId: 'skilled-actor',
          actionDef: createChanceBasedActionDef({
            bounds: { min: 10, max: 90 },
          }),
        });

        expect(result.chance).toBeLessThanOrEqual(90);
      });
    });

    describe('resolveOutcome', () => {
      it('should resolve outcome for chance-based action with deterministic roll', () => {
        // First get the threshold to know what roll would succeed
        const displayResult = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
        });
        const threshold = displayResult.chance;

        // Roll below threshold should succeed
        const successRoll = Math.max(6, threshold - 10); // At least 6 to avoid critical success

        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef(),
          forcedRoll: successRoll,
        });

        // If roll < threshold, it should be success (or critical success if roll <= 5)
        if (successRoll <= threshold) {
          expect(['SUCCESS', 'CRITICAL_SUCCESS']).toContain(result.outcome);
        }
        expect(result.roll).toBe(successRoll);
        expect(result.threshold).toBe(threshold);
      });

      it('should detect critical success on low roll', () => {
        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef({
            outcomes: {
              criticalSuccess: 10,
              criticalFailure: 95,
            },
          }),
          forcedRoll: 5, // Very low roll
        });

        expect(result.outcome).toBe('CRITICAL_SUCCESS');
        expect(result.isCritical).toBe(true);
      });

      it('should detect failure on high roll', () => {
        // Set up an actor with low skill for lower threshold
        entityManager = createMockEntityManager({
          'low-skill-actor': {
            'skills:melee_skill': { value: 20 },
          },
        });

        const skillResolverService = new SkillResolverService({
          entityManager,
          logger,
        });

        const modifierCollectorService = new ModifierCollectorService({
          entityManager,
          logger,
        });

        const probabilityCalculatorService = new ProbabilityCalculatorService({
          logger,
        });

        const outcomeDeterminerService = new OutcomeDeterminerService({
          logger,
        });

        service = new ChanceCalculationService({
          skillResolverService,
          modifierCollectorService,
          probabilityCalculatorService,
          outcomeDeterminerService,
          logger,
        });

        const result = service.resolveOutcome({
          actorId: 'low-skill-actor',
          actionDef: createChanceBasedActionDef(),
          forcedRoll: 80, // High roll above threshold
        });

        expect(result.outcome).toBe('FAILURE');
        expect(result.isCritical).toBe(false);
      });

      it('should detect fumble on very high roll', () => {
        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef({
            outcomes: {
              criticalSuccess: 5,
              criticalFailure: 90,
            },
          }),
          forcedRoll: 95, // Very high roll
        });

        expect(result.outcome).toBe('FUMBLE');
        expect(result.isCritical).toBe(true);
      });

      it('should return automatic success for non-chance-based action', () => {
        const result = service.resolveOutcome({
          actorId: 'actor-123',
          actionDef: {
            id: 'test:simple_action',
            chanceBased: { enabled: false },
          },
        });

        expect(result.outcome).toBe('SUCCESS');
        expect(result.threshold).toBe(100);
        expect(result.isCritical).toBe(false);
      });
    });

    describe('consistency between calculateForDisplay and resolveOutcome', () => {
      it('should produce matching thresholds', () => {
        const actionDef = createChanceBasedActionDef();
        const params = {
          actorId: 'actor-123',
          actionDef,
        };

        const displayResult = service.calculateForDisplay(params);
        const outcomeResult = service.resolveOutcome(params);

        expect(outcomeResult.threshold).toBe(displayResult.chance);
      });

      it('should handle opposed checks consistently', () => {
        const actionDef = createChanceBasedActionDef({
          contestType: 'opposed',
          targetSkill: {
            component: 'skills:defense_skill',
            default: 0,
          },
        });
        const params = {
          actorId: 'actor-123',
          targetId: 'target-456',
          actionDef,
        };

        const displayResult = service.calculateForDisplay(params);
        const outcomeResult = service.resolveOutcome(params);

        expect(outcomeResult.threshold).toBe(displayResult.chance);
        expect(displayResult.breakdown.actorSkill).toBe(60);
        expect(displayResult.breakdown.targetSkill).toBe(40);
      });
    });

    describe('formula variations', () => {
      it('should calculate with ratio formula', () => {
        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef({ formula: 'ratio' }),
        });

        expect(result.breakdown.formula).toBe('ratio');
        expect(result.chance).toBeGreaterThanOrEqual(5);
      });

      it('should calculate with logistic formula', () => {
        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef({ formula: 'logistic' }),
        });

        expect(result.breakdown.formula).toBe('logistic');
        expect(result.chance).toBeGreaterThanOrEqual(5);
      });

      it('should calculate with linear formula', () => {
        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          actionDef: createChanceBasedActionDef({ formula: 'linear' }),
        });

        expect(result.breakdown.formula).toBe('linear');
        expect(result.chance).toBeGreaterThanOrEqual(5);
      });
    });

    describe('error handling', () => {
      it('should handle missing entity gracefully', () => {
        const result = service.calculateForDisplay({
          actorId: 'nonexistent-actor',
          actionDef: createChanceBasedActionDef(),
        });

        // Should use default skill value (0)
        expect(result.breakdown.actorSkill).toBe(0);
      });

      it('should handle null targetId for opposed check', () => {
        const result = service.calculateForDisplay({
          actorId: 'actor-123',
          targetId: null,
          actionDef: createChanceBasedActionDef({
            contestType: 'opposed',
            targetSkill: {
              component: 'skills:defense_skill',
              default: 25,
            },
          }),
        });

        // Target skill should be 0 since no target is provided
        expect(result.breakdown.targetSkill).toBe(0);
      });
    });
  });
});
