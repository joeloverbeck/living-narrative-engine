/**
 * @file Integration tests for Chance-Based Modifier Display
 * @description Tests the integration between MultiTargetActionFormatter and ChanceCalculationService
 * for displaying modifier tags in action templates
 * @see specs/data-driven-modifier-system.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MultiTargetActionFormatter from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ChanceCalculationService from '../../../src/combat/services/ChanceCalculationService.js';
import SkillResolverService from '../../../src/combat/services/SkillResolverService.js';
import ModifierCollectorService from '../../../src/combat/services/ModifierCollectorService.js';
import ModifierContextBuilder from '../../../src/combat/services/ModifierContextBuilder.js';
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
 * Creates a mock base formatter
 * @returns {object} Mock base formatter with format method
 */
function createMockBaseFormatter() {
  return {
    format: jest.fn((template, context) => {
      // Simple placeholder replacement for testing
      let result = template;
      if (context && typeof context === 'object') {
        for (const [key, value] of Object.entries(context)) {
          result = result.replace(`{${key}}`, value);
        }
      }
      return { ok: true, value: result };
    }),
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
      return !!entityComponents[entityId]?.[componentId];
    }),
    getComponentData: jest.fn((entityId, componentId) => {
      return entityComponents[entityId]?.[componentId] ?? null;
    }),
    getEntity: jest.fn((entityId) => {
      if (!entityComponents[entityId]) {
        return null;
      }
      return {
        id: entityId,
        components: entityComponents[entityId],
      };
    }),
    getActiveEntitiesWithComponent: jest.fn(() => []),
  };
}

/**
 * Creates the full service chain for chance calculation
 *
 * @param {object} entityManager - Mock entity manager
 * @param {object} logger - Mock logger
 * @returns {ChanceCalculationService}
 */
function createChanceCalculationService(entityManager, logger) {
  const skillResolverService = new SkillResolverService({
    entityManager,
    logger,
  });

  const modifierContextBuilder = new ModifierContextBuilder({
    entityManager,
    logger,
  });

  const modifierCollectorService = new ModifierCollectorService({
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

  return new ChanceCalculationService({
    skillResolverService,
    modifierCollectorService,
    probabilityCalculatorService,
    outcomeDeterminerService,
    logger,
  });
}

describe('Chance-Based Modifier Display Integration', () => {
  let logger;
  let baseFormatter;
  let entityManager;
  let multiTargetFormatter;
  let chanceCalculationService;

  beforeEach(() => {
    logger = createMockLogger();
    baseFormatter = createMockBaseFormatter();
  });

  describe('Tag Display in Action Templates', () => {
    beforeEach(() => {
      entityManager = createMockEntityManager({
        actor1: {
          'core:actor': { name: 'Fighter' },
          'skills:grappling_skill': { value: 50 },
        },
        target1: {
          'core:actor': { name: 'Goblin' },
          'positioning:prone': {},
        },
        target2: {
          'core:actor': { name: 'Orc' },
          // Not prone
        },
      });

      chanceCalculationService = createChanceCalculationService(
        entityManager,
        logger
      );
      multiTargetFormatter = new MultiTargetActionFormatter(
        baseFormatter,
        logger
      );
    });

    it('should display tags in formatted action when modifiers are active', () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'linear',
          fixedDifficulty: 30,
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: {
                  '!!': [
                    { var: 'entity.primary.components.positioning:prone' },
                  ],
                },
              },
              value: 15,
              type: 'flat',
              tag: 'target prone',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target1', displayName: 'Goblin' }] },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].command).toContain('[target prone]');
    });

    it('should NOT display tags when modifiers are inactive', () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'linear',
          fixedDifficulty: 30,
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: {
                  '!!': [
                    { var: 'entity.primary.components.positioning:prone' },
                  ],
                },
              },
              value: 15,
              type: 'flat',
              tag: 'target prone',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target2', displayName: 'Orc' }] }, // Orc is NOT prone
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].command).not.toContain('[target prone]');
      expect(result.value[0].command).not.toContain('[');
    });

    it('should display multiple tags when multiple modifiers are active', () => {
      // Update entityManager with target that has multiple status components
      entityManager = createMockEntityManager({
        actor1: {
          'core:actor': { name: 'Fighter' },
          'skills:grappling_skill': { value: 50 },
        },
        target1: {
          'core:actor': { name: 'Goblin' },
          'positioning:prone': {},
          'physical-control-states:being_restrained': { restrainedBy: 'someone' },
        },
      });

      chanceCalculationService = createChanceCalculationService(
        entityManager,
        logger
      );

      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'linear',
          fixedDifficulty: 30,
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: {
                  '!!': [
                    { var: 'entity.primary.components.positioning:prone' },
                  ],
                },
              },
              value: 15,
              type: 'flat',
              tag: 'prone',
            },
            {
              condition: {
                logic: {
                  '!!': [
                    {
                      var: 'entity.primary.components.physical-control-states:being_restrained',
                    },
                  ],
                },
              },
              value: 10,
              type: 'flat',
              tag: 'restrained',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target1', displayName: 'Goblin' }] },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].command).toContain('[prone]');
      expect(result.value[0].command).toContain('[restrained]');
    });

    it('should handle actions without chance-based modifiers', () => {
      const actionDef = {
        id: 'test:simple_attack',
        template: 'attack {target}',
        generateCombinations: true,
        chanceBased: {
          enabled: false,
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target1', displayName: 'Goblin' }] },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].command).toBe('attack Goblin');
      expect(result.value[0].command).not.toContain('[');
    });
  });

  describe('Different Target Combinations', () => {
    beforeEach(() => {
      entityManager = createMockEntityManager({
        actor1: {
          'core:actor': { name: 'Fighter' },
          'skills:grappling_skill': { value: 50 },
        },
        target1: {
          'core:actor': { name: 'Goblin' },
          'positioning:prone': {},
        },
        target2: {
          'core:actor': { name: 'Orc' },
          // Not prone
        },
      });

      chanceCalculationService = createChanceCalculationService(
        entityManager,
        logger
      );
      multiTargetFormatter = new MultiTargetActionFormatter(
        baseFormatter,
        logger
      );
    });

    it('should calculate modifiers per target combination', () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'linear',
          fixedDifficulty: 30,
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: {
                  '!!': [
                    { var: 'entity.primary.components.positioning:prone' },
                  ],
                },
              },
              value: 15,
              type: 'flat',
              tag: 'prone',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        {
          primary: [
            { id: 'target1', displayName: 'Goblin' }, // Prone
            { id: 'target2', displayName: 'Orc' }, // Not prone
          ],
        },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(2);

      // Goblin (prone) should have tag
      const goblinCommand = result.value.find((v) =>
        v.command.includes('Goblin')
      );
      expect(goblinCommand).toBeDefined();
      expect(goblinCommand.command).toContain('[prone]');

      // Orc (not prone) should NOT have tag
      const orcCommand = result.value.find((v) => v.command.includes('Orc'));
      expect(orcCommand).toBeDefined();
      expect(orcCommand.command).not.toContain('[prone]');
      expect(orcCommand.command).not.toContain('[');
    });

    it('should produce different chance percentages based on active modifiers', () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'linear',
          fixedDifficulty: 30,
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: {
                  '!!': [
                    { var: 'entity.primary.components.positioning:prone' },
                  ],
                },
              },
              value: 15,
              type: 'flat',
              tag: 'prone',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        {
          primary: [
            { id: 'target1', displayName: 'Goblin' }, // Prone
            { id: 'target2', displayName: 'Orc' }, // Not prone
          ],
        },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);

      // Extract percentage values from commands
      const goblinCommand = result.value.find((v) =>
        v.command.includes('Goblin')
      );
      const orcCommand = result.value.find((v) => v.command.includes('Orc'));

      // Extract number from "(XX% chance)"
      const goblinMatch = goblinCommand.command.match(/\((\d+)% chance\)/);
      const orcMatch = orcCommand.command.match(/\((\d+)% chance\)/);

      expect(goblinMatch).not.toBeNull();
      expect(orcMatch).not.toBeNull();

      const goblinChance = parseInt(goblinMatch[1], 10);
      const orcChance = parseInt(orcMatch[1], 10);

      // Goblin (prone) should have higher chance due to +15 modifier
      expect(goblinChance).toBeGreaterThan(orcChance);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      entityManager = createMockEntityManager({
        actor1: {
          'core:actor': { name: 'Fighter' },
          'skills:grappling_skill': { value: 50 },
        },
        target1: {
          'core:actor': { name: 'Goblin' },
        },
      });

      chanceCalculationService = createChanceCalculationService(
        entityManager,
        logger
      );
      multiTargetFormatter = new MultiTargetActionFormatter(
        baseFormatter,
        logger
      );
    });

    it('should handle actions without template {chance} placeholder', () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target}', // No {chance} placeholder
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'linear',
          fixedDifficulty: 30,
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: { logic: { '==': [1, 1] } },
              value: 10,
              type: 'flat',
              tag: 'always active',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target1', displayName: 'Goblin' }] },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      // Should not crash, just no chance calculation performed
      expect(result.value[0].command).toBe('attack Goblin');
    });

    it('should handle modifiers with empty tag gracefully', () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'linear',
          fixedDifficulty: 30,
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: { logic: { '==': [1, 1] } },
              value: 10,
              type: 'flat',
              tag: '', // Empty tag
            },
            {
              condition: { logic: { '==': [1, 1] } },
              value: 5,
              type: 'flat',
              // No tag property at all
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target1', displayName: 'Goblin' }] },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      // Should not display empty brackets
      expect(result.value[0].command).not.toContain('[]');
      expect(result.value[0].command).not.toContain('[ ]');
    });

    it('should handle missing chanceCalculationService gracefully', () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'linear',
          fixedDifficulty: 30,
          bounds: { min: 5, max: 95 },
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target1', displayName: 'Goblin' }] },
        {},
        {
          // No chanceCalculationService provided
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      // Should not crash, {chance} remains unresolved or handled gracefully
    });
  });
});
