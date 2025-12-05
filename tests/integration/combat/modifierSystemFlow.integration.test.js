/**
 * @file Integration tests for Modifier System Flow
 * @description Tests the complete flow from context building through modifier collection
 * @see specs/data-driven-modifier-system.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModifierContextBuilder from '../../../src/combat/services/ModifierContextBuilder.js';
import ModifierCollectorService from '../../../src/combat/services/ModifierCollectorService.js';
import ChanceCalculationService from '../../../src/combat/services/ChanceCalculationService.js';
import SkillResolverService from '../../../src/combat/services/SkillResolverService.js';
import ProbabilityCalculatorService from '../../../src/combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../../src/combat/services/OutcomeDeterminerService.js';

/**
 * Creates a mock logger
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
 * Supports getEntity() for full entity retrieval (used by ModifierContextBuilder)
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
    getEntity: jest.fn((entityId) => {
      if (!entityComponents[entityId]) {
        return null;
      }
      // Return entity with components property for ModifierContextBuilder
      return {
        id: entityId,
        components: entityComponents[entityId],
      };
    }),
    getActiveEntitiesWithComponent: jest.fn(() => []),
  };
}

describe('Modifier System Flow Integration', () => {
  let logger;
  let entityManager;
  let modifierContextBuilder;
  let modifierCollectorService;

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('Context Building', () => {
    beforeEach(() => {
      entityManager = createMockEntityManager({
        'actor1': {
          'core:actor': { name: 'Test Actor' },
          'skills:grappling_skill': { value: 60 },
          'core:position': { locationId: 'location1' },
        },
        'target1': {
          'core:actor': { name: 'Test Target' },
          'positioning:being_restrained': { restrainedBy: 'someone' },
          'skills:defense_skill': { value: 30 },
        },
        'location1': {
          'core:location': { name: 'Test Room' },
          'environment:lighting': { level: 'dim' },
        },
      });

      modifierContextBuilder = new ModifierContextBuilder({
        entityManager,
        logger,
      });
    });

    it('should build complete context with actor data', () => {
      const context = modifierContextBuilder.buildContext({
        actorId: 'actor1',
      });

      // Verify actor data
      expect(context.entity.actor.id).toBe('actor1');
      expect(context.entity.actor.components['core:actor'].name).toBe('Test Actor');
      expect(context.entity.actor.components['skills:grappling_skill'].value).toBe(60);
    });

    it('should build context with primary target data', () => {
      const context = modifierContextBuilder.buildContext({
        actorId: 'actor1',
        primaryTargetId: 'target1',
      });

      // Verify target data
      expect(context.entity.primary.id).toBe('target1');
      expect(context.entity.primary.components['positioning:being_restrained']).toBeDefined();
      expect(context.entity.primary.components['skills:defense_skill'].value).toBe(30);
    });

    it('should resolve location from actor position component', () => {
      const context = modifierContextBuilder.buildContext({
        actorId: 'actor1',
      });

      // Verify location from actor's position
      expect(context.entity.location).toBeDefined();
      expect(context.entity.location.id).toBe('location1');
      expect(context.entity.location.components['environment:lighting'].level).toBe('dim');
    });

    it('should handle missing optional targets gracefully', () => {
      const context = modifierContextBuilder.buildContext({
        actorId: 'actor1',
      });

      expect(context.entity.actor).toBeDefined();
      expect(context.entity.primary).toBeNull();
      expect(context.entity.secondary).toBeNull();
      expect(context.entity.tertiary).toBeNull();
    });
  });

  describe('Modifier Collection with JSON Logic Conditions', () => {
    beforeEach(() => {
      entityManager = createMockEntityManager({
        'actor1': {
          'core:actor': { name: 'Test Actor' },
          'skills:grappling_skill': { value: 60 },
          'core:position': { locationId: 'location1' },
        },
        'target1': {
          'core:actor': { name: 'Restrained Target' },
          'positioning:being_restrained': { restrainedBy: 'someone' },
          'skills:defense_skill': { value: 30 },
        },
        'target2': {
          'core:actor': { name: 'Free Target' },
          'skills:defense_skill': { value: 40 },
        },
        'location1': {
          'core:location': { name: 'Test Room' },
          'environment:lighting': { level: 'dim' },
        },
      });

      modifierContextBuilder = new ModifierContextBuilder({
        entityManager,
        logger,
      });

      modifierCollectorService = new ModifierCollectorService({
        entityManager,
        modifierContextBuilder,
        logger,
      });
    });

    it('should activate modifier when target has required component', () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: {
              logic: {
                '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }]
              }
            },
            value: 20,
            type: 'flat',
            tag: 'target restrained',
            description: 'Bonus when target is already restrained',
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        actionConfig,
      });

      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].tag).toBe('target restrained');
      expect(result.modifiers[0].value).toBe(20);
      expect(result.totalFlat).toBe(20);
    });

    it('should NOT activate modifier when target lacks component', () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: {
              logic: {
                '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }]
              }
            },
            value: 20,
            type: 'flat',
            tag: 'target restrained',
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target2', // target2 is NOT restrained
        actionConfig,
      });

      expect(result.modifiers).toHaveLength(0);
      expect(result.totalFlat).toBe(0);
    });

    it('should handle multiple modifiers with different conditions', () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: {
              logic: {
                '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }]
              }
            },
            value: 20,
            type: 'flat',
            tag: 'target restrained',
          },
          {
            condition: {
              logic: {
                '==': [
                  { 'var': 'entity.location.components.environment:lighting.level' },
                  'dim'
                ]
              }
            },
            value: -10,
            type: 'flat',
            tag: 'low light',
          },
        ],
      };

      // Test with restrained target in dim location
      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        actionConfig,
      });

      expect(result.modifiers).toHaveLength(2);
      expect(result.totalFlat).toBe(10); // 20 - 10

      // Verify both tags are present
      const tags = result.modifiers.map(m => m.tag);
      expect(tags).toContain('target restrained');
      expect(tags).toContain('low light');
    });

    it('should activate modifier when condition has no condition (always active)', () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            // No condition property - should always activate
            value: 5,
            type: 'flat',
            tag: 'base bonus',
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        actionConfig,
      });

      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].tag).toBe('base bonus');
      expect(result.totalFlat).toBe(5);
    });
  });

  describe('Stacking Rules', () => {
    beforeEach(() => {
      entityManager = createMockEntityManager({
        'actor1': {
          'core:actor': { name: 'Test Actor' },
        },
      });

      modifierContextBuilder = new ModifierContextBuilder({
        entityManager,
        logger,
      });

      modifierCollectorService = new ModifierCollectorService({
        entityManager,
        modifierContextBuilder,
        logger,
      });
    });

    it('should apply stacking rules - only highest value for same stackId', () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: { logic: { '==': [1, 1] } }, // Always true
            value: 10,
            type: 'flat',
            tag: 'buff 1',
            stackId: 'strength_buff',
          },
          {
            condition: { logic: { '==': [1, 1] } }, // Always true
            value: 15,
            type: 'flat',
            tag: 'buff 2',
            stackId: 'strength_buff',
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        actionConfig,
      });

      // Only highest value should apply (15, not 10)
      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].value).toBe(15);
      expect(result.totalFlat).toBe(15);
    });

    it('should allow different stackIds to stack', () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: { logic: { '==': [1, 1] } },
            value: 10,
            type: 'flat',
            tag: 'strength buff',
            stackId: 'strength_buff',
          },
          {
            condition: { logic: { '==': [1, 1] } },
            value: 5,
            type: 'flat',
            tag: 'agility buff',
            stackId: 'agility_buff',
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        actionConfig,
      });

      // Both modifiers should apply (different stackIds)
      expect(result.modifiers).toHaveLength(2);
      expect(result.totalFlat).toBe(15); // 10 + 5
    });

    it('should allow modifiers without stackId to accumulate', () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: { logic: { '==': [1, 1] } },
            value: 5,
            type: 'flat',
            tag: 'bonus 1',
            // No stackId
          },
          {
            condition: { logic: { '==': [1, 1] } },
            value: 5,
            type: 'flat',
            tag: 'bonus 2',
            // No stackId
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        actionConfig,
      });

      // Both modifiers should apply (no stacking restriction)
      expect(result.modifiers).toHaveLength(2);
      expect(result.totalFlat).toBe(10); // 5 + 5
    });
  });

  describe('Full Chance Calculation Flow with Modifiers', () => {
    let chanceCalculationService;

    beforeEach(() => {
      entityManager = createMockEntityManager({
        'actor1': {
          'core:actor': { name: 'Test Actor' },
          'skills:grappling_skill': { value: 60 },
        },
        'target1': {
          'core:actor': { name: 'Restrained Target' },
          'positioning:being_restrained': { restrainedBy: 'someone' },
          'skills:defense_skill': { value: 30 },
        },
        'target2': {
          'core:actor': { name: 'Free Target' },
          'skills:defense_skill': { value: 30 },
        },
      });

      // Create real service chain
      const skillResolverService = new SkillResolverService({
        entityManager,
        logger,
      });

      modifierContextBuilder = new ModifierContextBuilder({
        entityManager,
        logger,
      });

      modifierCollectorService = new ModifierCollectorService({
        entityManager,
        modifierContextBuilder,
        logger,
      });

      const probabilityCalculatorService = new ProbabilityCalculatorService({
        logger,
      });

      const outcomeDeterminerService = new OutcomeDeterminerService({
        logger,
      });

      chanceCalculationService = new ChanceCalculationService({
        skillResolverService,
        modifierCollectorService,
        probabilityCalculatorService,
        outcomeDeterminerService,
        logger,
      });
    });

    it('should calculate final chance including active modifiers', () => {
      const actionDef = {
        id: 'test:action',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:grappling_skill',
            default: 10,
          },
          targetSkill: {
            component: 'skills:defense_skill',
            default: 0,
            targetRole: 'primary',
          },
          formula: 'ratio',
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: {
                  '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }]
                }
              },
              value: 20,
              type: 'flat',
              tag: 'target restrained',
            },
          ],
        },
      };

      // Calculate with restrained target
      const resultWithModifier = chanceCalculationService.calculateForDisplay({
        actorId: 'actor1',
        primaryTargetId: 'target1', // Restrained target
        actionDef,
      });

      // Should have modifier active
      expect(resultWithModifier.activeTags).toContain('target restrained');
      expect(resultWithModifier.breakdown.modifiers).toHaveLength(1);

      // Calculate with non-restrained target
      const resultWithoutModifier = chanceCalculationService.calculateForDisplay({
        actorId: 'actor1',
        primaryTargetId: 'target2', // NOT restrained
        actionDef,
      });

      // Should NOT have modifier active
      expect(resultWithoutModifier.activeTags).not.toContain('target restrained');
      expect(resultWithoutModifier.breakdown.modifiers).toHaveLength(0);

      // Chance should be higher with modifier (flat +20)
      expect(resultWithModifier.chance).toBeGreaterThan(resultWithoutModifier.chance);
    });

    it('should include all active tags in result', () => {
      const actionDef = {
        id: 'test:multi_modifier_action',
        chanceBased: {
          enabled: true,
          contestType: 'simple',
          actorSkill: {
            component: 'skills:grappling_skill',
            default: 10,
          },
          formula: 'ratio',
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: { logic: { '==': [1, 1] } }, // Always true
              value: 10,
              type: 'flat',
              tag: 'first bonus',
            },
            {
              condition: { logic: { '==': [1, 1] } }, // Always true
              value: 5,
              type: 'flat',
              tag: 'second bonus',
            },
          ],
        },
      };

      const result = chanceCalculationService.calculateForDisplay({
        actorId: 'actor1',
        actionDef,
      });

      expect(result.activeTags).toContain('first bonus');
      expect(result.activeTags).toContain('second bonus');
      expect(result.breakdown.modifiers).toHaveLength(2);
    });
  });
});
