/**
 * @file Integration tests for weapon attack target state modifiers
 * @description Tests the chance modifiers applied when attacking fallen or restrained targets
 * @see data/mods/weapons/actions/swing_at_target.action.json
 * @see data/mods/weapons/actions/strike_target.action.json
 * @see data/mods/weapons/actions/thrust_at_target.action.json
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModifierContextBuilder from '../../../../src/combat/services/ModifierContextBuilder.js';
import ModifierCollectorService from '../../../../src/combat/services/ModifierCollectorService.js';

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
 * Shared modifier configuration matching the actual weapon action files
 * These are the modifiers added to swing_at_target, strike_target, and thrust_at_target
 */
const WEAPON_ATTACK_MODIFIERS = [
  {
    condition: {
      logic: {
        '!!': [{ 'var': 'entity.secondary.components.positioning:fallen' }],
      },
    },
    type: 'flat',
    value: 15,
    tag: 'target downed',
    targetRole: 'secondary',
    description: 'Bonus for attacking a fallen target',
  },
  {
    condition: {
      logic: {
        '!!': [{ 'var': 'entity.secondary.components.positioning:being_restrained' }],
      },
    },
    type: 'flat',
    value: 10,
    tag: 'target restrained',
    targetRole: 'secondary',
    description: 'Bonus for attacking a restrained target',
  },
];

describe('Weapon Attack Target State Modifiers', () => {
  let logger;
  let modifierContextBuilder;
  let modifierCollectorService;

  /**
   * Creates the service chain with configured entity manager
   *
   * @param {object} entityComponents - Entity component data
   */
  function setupServices(entityComponents) {
    const entityManager = createMockEntityManager(entityComponents);
    modifierContextBuilder = new ModifierContextBuilder({
      entityManager,
      logger,
    });
    modifierCollectorService = new ModifierCollectorService({
      entityManager,
      modifierContextBuilder,
      logger,
    });
  }

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('Fallen Target Modifier (+15 bonus)', () => {
    it('should apply +15 flat bonus when target has positioning:fallen component', () => {
      // Arrange - Target is fallen
      setupServices({
        'attacker': {
          'core:actor': { name: 'Attacker' },
          'skills:melee_skill': { value: 50 },
        },
        'fallen_target': {
          'core:actor': { name: 'Fallen Target' },
          'positioning:fallen': { activityMetadata: { shouldDescribeInActivity: true } },
          'skills:defense_skill': { value: 30 },
        },
      });

      const actionConfig = {
        enabled: true,
        modifiers: WEAPON_ATTACK_MODIFIERS,
      };

      // Act
      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'fallen_target',
        actionConfig,
      });

      // Assert
      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].tag).toBe('target downed');
      expect(result.modifiers[0].value).toBe(15);
      expect(result.modifiers[0].type).toBe('flat');
      expect(result.totalFlat).toBe(15);
    });

    it('should have "target downed" tag when target is fallen', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
        'fallen_target': {
          'core:actor': { name: 'Fallen Target' },
          'positioning:fallen': {},
        },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'fallen_target',
        actionConfig: { modifiers: WEAPON_ATTACK_MODIFIERS },
      });

      expect(result.modifiers.some((m) => m.tag === 'target downed')).toBe(true);
    });
  });

  describe('Restrained Target Modifier (+10 bonus)', () => {
    it('should apply +10 flat bonus when target has positioning:being_restrained component', () => {
      // Arrange - Target is restrained
      setupServices({
        'attacker': {
          'core:actor': { name: 'Attacker' },
          'skills:melee_skill': { value: 50 },
        },
        'restrained_target': {
          'core:actor': { name: 'Restrained Target' },
          'positioning:being_restrained': { restraining_entity_id: 'holder', consented: false },
          'skills:defense_skill': { value: 30 },
        },
      });

      const actionConfig = {
        enabled: true,
        modifiers: WEAPON_ATTACK_MODIFIERS,
      };

      // Act
      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'restrained_target',
        actionConfig,
      });

      // Assert
      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].tag).toBe('target restrained');
      expect(result.modifiers[0].value).toBe(10);
      expect(result.modifiers[0].type).toBe('flat');
      expect(result.totalFlat).toBe(10);
    });

    it('should have "target restrained" tag when target is restrained', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
        'restrained_target': {
          'core:actor': { name: 'Restrained Target' },
          'positioning:being_restrained': { restraining_entity_id: 'holder' },
        },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'restrained_target',
        actionConfig: { modifiers: WEAPON_ATTACK_MODIFIERS },
      });

      expect(result.modifiers.some((m) => m.tag === 'target restrained')).toBe(true);
    });
  });

  describe('Stacking Behavior - Both Modifiers', () => {
    it('should apply BOTH modifiers when target is fallen AND restrained (+25 total)', () => {
      // Arrange - Target is both fallen and restrained
      setupServices({
        'attacker': {
          'core:actor': { name: 'Attacker' },
          'skills:melee_skill': { value: 50 },
        },
        'helpless_target': {
          'core:actor': { name: 'Helpless Target' },
          'positioning:fallen': { activityMetadata: { shouldDescribeInActivity: true } },
          'positioning:being_restrained': { restraining_entity_id: 'holder', consented: false },
          'skills:defense_skill': { value: 30 },
        },
      });

      const actionConfig = {
        enabled: true,
        modifiers: WEAPON_ATTACK_MODIFIERS,
      };

      // Act
      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'helpless_target',
        actionConfig,
      });

      // Assert - Both modifiers should apply
      expect(result.modifiers).toHaveLength(2);
      expect(result.totalFlat).toBe(25); // 15 + 10

      // Verify both tags are present
      const tags = result.modifiers.map((m) => m.tag);
      expect(tags).toContain('target downed');
      expect(tags).toContain('target restrained');
    });

    it('should have both "target downed" and "target restrained" tags', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
        'helpless_target': {
          'core:actor': { name: 'Helpless Target' },
          'positioning:fallen': {},
          'positioning:being_restrained': { restraining_entity_id: 'holder' },
        },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'helpless_target',
        actionConfig: { modifiers: WEAPON_ATTACK_MODIFIERS },
      });

      expect(result.modifiers).toHaveLength(2);
      expect(result.modifiers.find((m) => m.tag === 'target downed')).toBeDefined();
      expect(result.modifiers.find((m) => m.tag === 'target restrained')).toBeDefined();
    });

    it('should stack modifiers additively (no stackId = all apply)', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
        'helpless_target': {
          'core:actor': { name: 'Helpless Target' },
          'positioning:fallen': {},
          'positioning:being_restrained': { restraining_entity_id: 'holder' },
        },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'helpless_target',
        actionConfig: { modifiers: WEAPON_ATTACK_MODIFIERS },
      });

      // Without stackId, both flat modifiers should add together
      expect(result.totalFlat).toBe(15 + 10);
      expect(result.totalPercentage).toBe(1); // No percentage modifiers
    });
  });

  describe('No Modifier - Target Without State Components', () => {
    it('should apply NO modifiers when target has neither fallen nor restrained component', () => {
      // Arrange - Target is standing and free
      setupServices({
        'attacker': {
          'core:actor': { name: 'Attacker' },
          'skills:melee_skill': { value: 50 },
        },
        'normal_target': {
          'core:actor': { name: 'Normal Target' },
          'skills:defense_skill': { value: 30 },
          // No positioning:fallen or positioning:being_restrained
        },
      });

      const actionConfig = {
        enabled: true,
        modifiers: WEAPON_ATTACK_MODIFIERS,
      };

      // Act
      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'normal_target',
        actionConfig,
      });

      // Assert - No modifiers should apply
      expect(result.modifiers).toHaveLength(0);
      expect(result.totalFlat).toBe(0);
    });

    it('should not display any modifier tags when target is in normal state', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
        'normal_target': {
          'core:actor': { name: 'Normal Target' },
        },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'normal_target',
        actionConfig: { modifiers: WEAPON_ATTACK_MODIFIERS },
      });

      expect(result.modifiers).toHaveLength(0);
    });
  });

  describe('Action-Specific Behavior', () => {
    // Test that all three actions use the same modifier structure

    const actionConfigs = {
      'weapons:swing_at_target': {
        id: 'weapons:swing_at_target',
        name: 'Swing at Target',
        template: 'swing {weapon} at {target} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill', default: 10 },
          targetSkill: { component: 'skills:defense_skill', default: 0, targetRole: 'secondary' },
          modifiers: WEAPON_ATTACK_MODIFIERS,
        },
      },
      'weapons:strike_target': {
        id: 'weapons:strike_target',
        name: 'Strike at Target',
        template: 'strike {target} with {weapon} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill', default: 10 },
          targetSkill: { component: 'skills:defense_skill', default: 0, targetRole: 'secondary' },
          modifiers: WEAPON_ATTACK_MODIFIERS,
        },
      },
      'weapons:thrust_at_target': {
        id: 'weapons:thrust_at_target',
        name: 'Thrust at Target',
        template: 'thrust {weapon} at {target} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: { component: 'skills:melee_skill', default: 10 },
          targetSkill: { component: 'skills:defense_skill', default: 0, targetRole: 'secondary' },
          modifiers: WEAPON_ATTACK_MODIFIERS,
        },
      },
    };

    Object.entries(actionConfigs).forEach(([actionId, actionDef]) => {
      describe(`${actionDef.name} (${actionId})`, () => {
        it('should apply fallen modifier (+15) to fallen target', () => {
          setupServices({
            'attacker': { 'core:actor': { name: 'Attacker' } },
            'fallen_target': {
              'core:actor': { name: 'Fallen Target' },
              'positioning:fallen': {},
            },
          });

          const result = modifierCollectorService.collectModifiers({
            actorId: 'attacker',
            secondaryTargetId: 'fallen_target',
            actionConfig: actionDef.chanceBased,
          });

          expect(result.totalFlat).toBe(15);
          expect(result.modifiers[0].tag).toBe('target downed');
        });

        it('should apply restrained modifier (+10) to restrained target', () => {
          setupServices({
            'attacker': { 'core:actor': { name: 'Attacker' } },
            'restrained_target': {
              'core:actor': { name: 'Restrained Target' },
              'positioning:being_restrained': { restraining_entity_id: 'holder' },
            },
          });

          const result = modifierCollectorService.collectModifiers({
            actorId: 'attacker',
            secondaryTargetId: 'restrained_target',
            actionConfig: actionDef.chanceBased,
          });

          expect(result.totalFlat).toBe(10);
          expect(result.modifiers[0].tag).toBe('target restrained');
        });

        it('should apply both modifiers (+25) to fallen AND restrained target', () => {
          setupServices({
            'attacker': { 'core:actor': { name: 'Attacker' } },
            'helpless_target': {
              'core:actor': { name: 'Helpless Target' },
              'positioning:fallen': {},
              'positioning:being_restrained': { restraining_entity_id: 'holder' },
            },
          });

          const result = modifierCollectorService.collectModifiers({
            actorId: 'attacker',
            secondaryTargetId: 'helpless_target',
            actionConfig: actionDef.chanceBased,
          });

          expect(result.totalFlat).toBe(25);
          expect(result.modifiers).toHaveLength(2);
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing secondary target gracefully', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        // No secondaryTargetId provided
        actionConfig: { modifiers: WEAPON_ATTACK_MODIFIERS },
      });

      // No modifiers should apply when target is missing
      expect(result.modifiers).toHaveLength(0);
      expect(result.totalFlat).toBe(0);
    });

    it('should handle non-existent target entity gracefully', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
        // 'nonexistent_target' is not in entity manager
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'nonexistent_target',
        actionConfig: { modifiers: WEAPON_ATTACK_MODIFIERS },
      });

      // Should handle gracefully without errors
      expect(result.modifiers).toHaveLength(0);
    });

    it('should not confuse actor state with target state', () => {
      // Actor is fallen, target is not - modifiers should NOT apply
      setupServices({
        'attacker': {
          'core:actor': { name: 'Fallen Attacker' },
          'positioning:fallen': {}, // Actor is fallen
        },
        'normal_target': {
          'core:actor': { name: 'Normal Target' },
          // Target is NOT fallen or restrained
        },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'normal_target',
        actionConfig: { modifiers: WEAPON_ATTACK_MODIFIERS },
      });

      // Modifiers check entity.secondary (target), not entity.actor
      expect(result.modifiers).toHaveLength(0);
      expect(result.totalFlat).toBe(0);
    });

    it('should work with empty modifiers array', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
        'fallen_target': {
          'core:actor': { name: 'Fallen Target' },
          'positioning:fallen': {},
        },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'fallen_target',
        actionConfig: { modifiers: [] },
      });

      expect(result.modifiers).toHaveLength(0);
      expect(result.totalFlat).toBe(0);
    });

    it('should work when actionConfig has no modifiers property', () => {
      setupServices({
        'attacker': { 'core:actor': { name: 'Attacker' } },
        'fallen_target': {
          'core:actor': { name: 'Fallen Target' },
          'positioning:fallen': {},
        },
      });

      const result = modifierCollectorService.collectModifiers({
        actorId: 'attacker',
        secondaryTargetId: 'fallen_target',
        actionConfig: { enabled: true },
      });

      expect(result.modifiers).toHaveLength(0);
      expect(result.totalFlat).toBe(0);
    });
  });
});
