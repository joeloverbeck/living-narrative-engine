/**
 * @file Integration tests for food:eat_entirely action discovery
 * @description Tests the action structure and discoverability for single-serving food items
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import eatEntirelyAction from '../../../../data/mods/food/actions/eat_entirely.action.json';

describe('food:eat_entirely Action Discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('food', 'food:eat_entirely');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action id', () => {
      expect(eatEntirelyAction.id).toBe('food:eat_entirely');
    });

    it('should have correct template for complete consumption', () => {
      expect(eatEntirelyAction.template).toBe('eat {primary}');
    });

    it('should target single_serving_food scope', () => {
      expect(eatEntirelyAction.targets.primary.scope).toBe(
        'food:single_serving_food'
      );
    });

    it('should require edible and food_container components on target', () => {
      expect(eatEntirelyAction.required_components.primary).toContain(
        'eating-states:edible'
      );
      expect(eatEntirelyAction.required_components.primary).toContain(
        'food:food_container'
      );
    });

    it('should forbid consumed component on target', () => {
      expect(eatEntirelyAction.forbidden_components.primary).toContain(
        'eating-states:consumed'
      );
    });

    it('should forbid restrained/restraining states on actor', () => {
      expect(eatEntirelyAction.forbidden_components.actor).toContain(
        'physical-control-states:being_restrained'
      );
      expect(eatEntirelyAction.forbidden_components.actor).toContain(
        'physical-control-states:restraining'
      );
    });

    it('should have free-grabbing-appendage prerequisite', () => {
      expect(eatEntirelyAction.prerequisites).toHaveLength(1);
      expect(eatEntirelyAction.prerequisites[0].logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });
  });

  describe('Discoverability scenarios', () => {
    it('should be discoverable when target has exactly 1 serving', async () => {
      // Arrange - Create actor and food item with single serving
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Alice',
        'Croissant',
      ]);

      // Set up food as single-serving edible
      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
        flavorText: 'A perfectly flaky, buttery croissant.',
        tags: ['pastry', 'breakfast', 'buttery'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      // Give actor inventory with the food
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act - Execute eat_entirely action (should succeed)
      const result = await fixture.executeAction(actor.id, food.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);
    });

    it('should be available for last serving of originally multi-serving item', async () => {
      // Arrange - Item that started with multiple servings but now has 1
      const { actor, target: food } = fixture.createStandardActorTarget([
        'David',
        'Partially Eaten Pie',
      ]);

      // Originally 4 servings, now reduced to 1
      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1, // Last serving
        maxServings: 4, // Originally had 4
        flavorText: 'The last slice of meat pie.',
        tags: ['pie', 'savory'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act - Should be able to eat_entirely since only 1 serving remains
      const result = await fixture.executeAction(actor.id, food.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);
    });

    it('should NOT be available when target lacks edible component', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Eve',
        'Inedible Object',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
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
        'Frank',
        'Already Eaten',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
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
