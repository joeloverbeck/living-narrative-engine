/**
 * @file Integration tests for food:eat_from action discovery
 * @description Tests the action structure and discoverability based on serving count
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import eatFromAction from '../../../../data/mods/food/actions/eat_from.action.json';

describe('food:eat_from Action Discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('food', 'food:eat_from');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action id', () => {
      expect(eatFromAction.id).toBe('food:eat_from');
    });

    it('should have correct template for partial eating', () => {
      expect(eatFromAction.template).toBe('eat from {primary}');
    });

    it('should target multi_serving_food scope', () => {
      expect(eatFromAction.targets.primary.scope).toBe('food:multi_serving_food');
    });

    it('should require edible and food_container components on target', () => {
      expect(eatFromAction.required_components.primary).toContain(
        'eating-states:edible'
      );
      expect(eatFromAction.required_components.primary).toContain(
        'food:food_container'
      );
    });

    it('should forbid consumed component on target', () => {
      expect(eatFromAction.forbidden_components.primary).toContain(
        'eating-states:consumed'
      );
    });

    it('should forbid restrained/restraining states on actor', () => {
      expect(eatFromAction.forbidden_components.actor).toContain(
        'physical-control-states:being_restrained'
      );
      expect(eatFromAction.forbidden_components.actor).toContain(
        'physical-control-states:restraining'
      );
    });

    it('should have free-grabbing-appendage prerequisite', () => {
      expect(eatFromAction.prerequisites).toHaveLength(1);
      expect(eatFromAction.prerequisites[0].logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });
  });

  describe('Discoverability scenarios', () => {
    it('should be discoverable when target has multiple servings', async () => {
      // Arrange - Create actor and food item with multiple servings
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Alice',
        'Bread Loaf',
      ]);

      // Set up food as multi-serving edible
      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 4,
        maxServings: 6,
        flavorText: 'Fresh crusty bread.',
        tags: ['bread', 'staple'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      // Give actor inventory with the food
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act - Execute eat_from action (should succeed)
      const result = await fixture.executeAction(actor.id, food.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);
    });

    it('should NOT be available when target lacks edible component', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'David',
        'Rock',
      ]);

      // Set up item without edible component
      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 4,
        maxServings: 4,
        flavorText: 'Not actually food.',
        tags: [],
      });
      // Note: NOT adding eating-states:edible component
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act & Assert
      await expect(fixture.executeAction(actor.id, food.id)).rejects.toThrow(
        'ACTION EXECUTION VALIDATION FAILED'
      );
    });

    it('should NOT be available when target has consumed component', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Eve',
        'Consumed Pie',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 2,
        maxServings: 4,
        flavorText: '',
        tags: [],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      // Add consumed component (forbidden)
      fixture.entityManager.addComponent(food.id, 'eating-states:consumed', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act & Assert
      await expect(fixture.executeAction(actor.id, food.id)).rejects.toThrow(
        'ACTION EXECUTION VALIDATION FAILED'
      );
    });
  });
});
