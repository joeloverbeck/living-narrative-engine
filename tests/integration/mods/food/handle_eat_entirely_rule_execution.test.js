/**
 * @file Integration tests for handle_eat_entirely rule execution
 * @description Tests the complete rule execution flow for consuming entire food items
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('food:eat_entirely Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('food', 'food:eat_entirely');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('successful eating scenarios', () => {
    it('should set currentServings to 0 after eating', async () => {
      // Arrange - Create actor and single-serving food
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Alice',
        'Croissant',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
        flavorText: 'Warm, flaky layers of buttery pastry.',
        tags: ['pastry', 'breakfast', 'buttery'],
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

      // Verify servings set to 0
      const foodContainer = fixture.entityManager.getComponentData(
        food.id,
        'food:food_container'
      );
      expect(foodContainer.currentServings).toBe(0);
    });

    it('should add consumed component after eating', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Bob',
        'Cinnamon Roll',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
        flavorText: 'Sweet, gooey cinnamon filling.',
        tags: ['pastry', 'sweet', 'breakfast'],
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

      // Assert - Should have consumed component
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:consumed')
      ).toBe(true);
    });

    it('should remove edible component after eating', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Charlie',
        'Cheese Pastry',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
        flavorText: 'Molten cheese stretches from the flaky pastry.',
        tags: ['pastry', 'savory', 'cheese'],
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

      // Assert - Should NOT have edible component anymore
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:edible')
      ).toBe(false);
    });

    it('should complete state transition from edible to consumed', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'David',
        'Apple Slice',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
        flavorText: 'A crisp slice of fresh apple.',
        tags: ['fruit', 'healthy'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Verify initial state
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:edible')
      ).toBe(true);
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:consumed')
      ).toBe(false);

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Complete state transition
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:edible')
      ).toBe(false);
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:consumed')
      ).toBe(true);
      expect(
        fixture.entityManager.getComponentData(food.id, 'food:food_container')
          .currentServings
      ).toBe(0);
    });
  });

  describe('inventory items', () => {
    it('should handle eating from inventory item without position component', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Eve',
        'Croissant',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
        flavorText: 'Delicate buttery layers.',
        tags: ['pastry', 'breakfast'],
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
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:consumed')
      ).toBe(true);
    });
  });

  describe('last serving of multi-serving items', () => {
    it('should consume last serving of originally multi-serving item', async () => {
      // Arrange - Item that started with multiple servings but now has 1
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Frank',
        'Last Slice of Pie',
      ]);

      // Originally 4 servings, now just 1 remaining
      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 4,
        flavorText: 'The final savory slice.',
        tags: ['pie', 'meat', 'savory'],
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

      const foodContainer = fixture.entityManager.getComponentData(
        food.id,
        'food:food_container'
      );
      expect(foodContainer.currentServings).toBe(0);
      expect(foodContainer.maxServings).toBe(4); // maxServings unchanged
      expect(
        fixture.entityManager.hasComponent(food.id, 'eating-states:consumed')
      ).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should fail when eating food without food_container component', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Grace',
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

    it('should fail when food already has consumed component', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Henry',
        'Already Consumed Item',
      ]);

      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
        flavorText: '',
        tags: [],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'eating-states:consumed', {}); // Already consumed
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act & Assert - Should fail due to forbidden consumed component
      await expect(fixture.executeAction(actor.id, food.id)).rejects.toThrow(
        'ACTION EXECUTION VALIDATION FAILED'
      );
    });
  });
});
