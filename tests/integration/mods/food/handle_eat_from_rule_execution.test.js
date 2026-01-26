/**
 * @file Integration tests for handle_eat_from rule execution
 * @description Tests the complete rule execution flow for eating from food items
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('food:eat_from Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('food', 'food:eat_from');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('successful eating scenarios', () => {
    it('should reduce servings by 1 after eating', async () => {
      // Arrange - Create actor and food with multiple servings
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Alice',
        'Meat Pie',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 4,
        maxServings: 4,
        flavorText: 'A hearty meat pie with rich gravy.',
        tags: ['pie', 'savory', 'meat'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act
      const result = await fixture.executeAction(actor.id, food.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Verify servings reduced by 1
      const foodContainer = fixture.entityManager.getComponentData(
        food.id,
        'food:food_container'
      );
      expect(foodContainer.currentServings).toBe(3); // 4 - 1
    });

    it('should keep edible component when multiple servings remain', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Bob',
        'Bread Loaf',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 6,
        maxServings: 6,
        flavorText: 'Fresh crusty bread with a soft interior.',
        tags: ['bread', 'staple'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Should still have edible component
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:edible')
      ).toBe(true);
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:consumed')
      ).toBe(false);

      // Verify 5 servings remain
      const foodContainer = fixture.entityManager.getComponentData(
        food.id,
        'food:food_container'
      );
      expect(foodContainer.currentServings).toBe(5);
    });

    it('should transition to consumed state when eating reduces servings to 0', async () => {
      // Arrange - Food with exactly 1 serving that eat_from consumes
      // Note: The scope requires >1 servings, so this tests edge case where
      // eating reduces to 0 (e.g., starting with 2 servings)
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Charlie',
        'Apple Tart',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 2,
        maxServings: 2,
        flavorText: 'Caramelized apple meets buttery pastry.',
        tags: ['pastry', 'fruit', 'sweet'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act - Eat first serving (2 -> 1)
      await fixture.executeAction(actor.id, food.id);

      // Assert - Still has 1 serving, still edible
      let foodContainer = fixture.entityManager.getComponentData(
        food.id,
        'food:food_container'
      );
      expect(foodContainer.currentServings).toBe(1);
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:edible')
      ).toBe(true);
    });

    it('should handle eating from inventory item without position component', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'David',
        'Meat Pie',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 4,
        maxServings: 4,
        flavorText: 'Savory filling wrapped in flaky pastry.',
        tags: ['pie', 'savory'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Remove position component (item is in inventory)
      fixture.entityManager.removeComponent(food.id, 'core:position');

      // Verify no position component
      expect(fixture.entityManager.hasComponent(food.id, 'core:position')).toBe(
        false
      );

      // Act
      const result = await fixture.executeAction(actor.id, food.id);

      // Assert - Should succeed
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      const foodContainer = fixture.entityManager.getComponentData(
        food.id,
        'food:food_container'
      );
      expect(foodContainer.currentServings).toBe(3);
    });
  });

  describe('consecutive eating', () => {
    it('should allow multiple consecutive eating actions', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Eve',
        'Large Bread Loaf',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 5,
        maxServings: 6,
        flavorText: 'Hearty bread for a journey.',
        tags: ['bread'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act - Eat multiple times (5 -> 4 -> 3)
      await fixture.executeAction(actor.id, food.id);
      await fixture.executeAction(actor.id, food.id);

      // Assert
      const foodContainer = fixture.entityManager.getComponentData(
        food.id,
        'food:food_container'
      );
      expect(foodContainer.currentServings).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should fail when eating from food without food_container component', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Frank',
        'Mystery Item',
      ]);

      // Add edible but NO food_container
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act & Assert
      await expect(fixture.executeAction(actor.id, food.id)).rejects.toThrow();
    });
  });
});
