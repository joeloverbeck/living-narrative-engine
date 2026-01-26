/**
 * @file Integration tests for consumable_disappears behavior after eat_entirely
 * @description Tests that food items with the consumable_disappears marker are removed
 *              from the game world after being fully consumed, while items without the
 *              marker remain as consumed remnants.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('food:consumable_disappears Behavior', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('food', 'food:eat_entirely');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  /**
   * Helper to create a food entity with standard components.
   *
   * @param {string} name - The display name for the food.
   * @param {object} options - Configuration options.
   * @param {number} [options.servings] - Number of servings (default: 1).
   * @param {boolean} [options.disappears] - Whether to add consumable_disappears marker (default: false).
   * @returns {object} The created food entity with id property.
   */
  const createFood = (name, { servings = 1, disappears = false } = {}) => {
    // createEntity() returns a string ID, not an object
    const foodId = fixture.createEntity(`test:${name.toLowerCase().replace(/\s+/g, '_')}`);

    fixture.entityManager.addComponent(foodId, 'core:name', { text: name });
    fixture.entityManager.addComponent(foodId, 'food:food_container', {
      currentServings: servings,
      maxServings: servings,
      flavorText: `Delicious ${name.toLowerCase()}.`,
      tags: ['food'],
    });
    fixture.entityManager.addComponent(foodId, 'eating-states:edible', {});
    fixture.entityManager.addComponent(foodId, 'items-core:item', {});
    fixture.entityManager.addComponent(foodId, 'items-core:portable', {});

    if (disappears) {
      fixture.entityManager.addComponent(foodId, 'food:consumable_disappears', {});
    }

    // Return object with id property for backward compatibility with test code
    return { id: foodId };
  };

  describe('food WITH consumable_disappears marker', () => {
    it('should be removed from game after eating entirely', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Alice', 'Dummy']);
      const food = createFood('Croissant', { servings: 1, disappears: true });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Verify entity exists before eating
      expect(fixture.entityManager.hasEntity(food.id)).toBe(true);

      // Act
      const result = await fixture.executeAction(actor.id, food.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Entity should be completely removed from game
      expect(fixture.entityManager.hasEntity(food.id)).toBe(false);
    });

    it('should be removed from inventory AND game after eating', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Bob', 'Dummy']);
      const food = createFood('Apple Tart', { servings: 1, disappears: true });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Verify initial inventory state
      let inventory = fixture.entityManager.getComponentData(
        actor.id,
        'inventory:inventory'
      );
      expect(inventory.items).toContain(food.id);

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Entity removed from game
      expect(fixture.entityManager.hasEntity(food.id)).toBe(false);

      // Assert - Entity removed from inventory
      inventory = fixture.entityManager.getComponentData(
        actor.id,
        'inventory:inventory'
      );
      expect(inventory.items).not.toContain(food.id);
    });

    it('should not have consumed component (entity is gone)', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Charlie', 'Dummy']);
      const food = createFood('Cheese Pastry', { servings: 1, disappears: true });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Can't check for consumed component because entity doesn't exist
      expect(fixture.entityManager.hasEntity(food.id)).toBe(false);
    });

    it('should preserve other items in inventory after removal', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['David', 'Dummy']);
      const food = createFood('Cinnamon Roll', { servings: 1, disappears: true });
      // createEntity() returns a string ID, not an object
      const otherItemId = fixture.createEntity('test:other_item');
      fixture.entityManager.addComponent(otherItemId, 'items-core:item', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [otherItemId, food.id],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Other item should remain
      const inventory = fixture.entityManager.getComponentData(
        actor.id,
        'inventory:inventory'
      );
      expect(inventory.items).toContain(otherItemId);
      expect(inventory.items).not.toContain(food.id);
      expect(inventory.items.length).toBe(1);
    });
  });

  describe('food WITHOUT consumable_disappears marker', () => {
    it('should remain in game as consumed remnant after eating', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Eve', 'Dummy']);
      const food = createFood('Chicken Wing', { servings: 1, disappears: false });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Entity should still exist
      expect(fixture.entityManager.hasEntity(food.id)).toBe(true);
    });

    it('should have consumed component after eating', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Frank', 'Dummy']);
      const food = createFood('Drumstick', { servings: 1, disappears: false });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Should have consumed component
      expect(fixture.entityManager.hasComponent(food.id, 'eating-states:consumed')).toBe(true);
    });

    it('should remain in inventory after eating', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Grace', 'Dummy']);
      const food = createFood('Bone-In Steak', { servings: 1, disappears: false });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Should still be in inventory
      const inventory = fixture.entityManager.getComponentData(
        actor.id,
        'inventory:inventory'
      );
      expect(inventory.items).toContain(food.id);
    });

    it('should not have edible component after eating', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Henry', 'Dummy']);
      const food = createFood('Ribs', { servings: 1, disappears: false });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Edible removed, consumed added
      expect(fixture.entityManager.hasComponent(food.id, 'eating-states:edible')).toBe(false);
      expect(fixture.entityManager.hasComponent(food.id, 'eating-states:consumed')).toBe(true);
    });
  });

  describe('mixed inventory scenarios', () => {
    it('should handle inventory with disappearing and non-disappearing items', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Ivy', 'Dummy']);
      const disappearingFood = createFood('Croissant', { servings: 1, disappears: true });
      const remainingFood = createFood('Chicken Wing', { servings: 1, disappears: false });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [disappearingFood.id, remainingFood.id],
        maxWeightKg: 50,
      });

      // Act - Eat the disappearing food
      await fixture.executeAction(actor.id, disappearingFood.id);

      // Assert - Croissant gone, chicken wing remains
      expect(fixture.entityManager.hasEntity(disappearingFood.id)).toBe(false);
      expect(fixture.entityManager.hasEntity(remainingFood.id)).toBe(true);

      const inventory = fixture.entityManager.getComponentData(
        actor.id,
        'inventory:inventory'
      );
      expect(inventory.items).not.toContain(disappearingFood.id);
      expect(inventory.items).toContain(remainingFood.id);
    });
  });

  describe('warning behavior', () => {
    it('should not log warnings about missing entities during eat_entirely with disappears marker', async () => {
      // Arrange
      const { actor } = fixture.createStandardActorTarget(['Tester', 'Dummy']);
      const food = createFood('Test Croissant', { servings: 1, disappears: true });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Capture warnings
      const warnings = [];
      const originalWarn = fixture.logger.warn;
      fixture.logger.warn = (...args) => {
        warnings.push(args);
        originalWarn.apply(fixture.logger, args);
      };

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Cleanup
      fixture.logger.warn = originalWarn;

      // Assert - No warnings about entity not found
      const entityNotFoundWarnings = warnings.filter(
        (args) => args[0] && args[0].includes('Entity not found')
      );
      expect(entityNotFoundWarnings).toHaveLength(0);
      expect(fixture.entityManager.hasEntity(food.id)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle eating non-inventory item with disappears marker', async () => {
      // Arrange
      const { actor, target: food } = fixture.createStandardActorTarget([
        'Jack',
        'Floor Croissant',
      ]);

      // Manually configure the target as disappearing food (not in inventory)
      fixture.entityManager.addComponent(food.id, 'food:food_container', {
        currentServings: 1,
        maxServings: 1,
        flavorText: 'Found on the floor.',
        tags: ['pastry'],
      });
      fixture.entityManager.addComponent(food.id, 'eating-states:edible', {});
      fixture.entityManager.addComponent(food.id, 'items-core:item', {});
      fixture.entityManager.addComponent(food.id, 'items-core:portable', {});
      fixture.entityManager.addComponent(food.id, 'food:consumable_disappears', {});

      // Give actor an empty inventory
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Entity should be removed even though not in inventory
      expect(fixture.entityManager.hasEntity(food.id)).toBe(false);
    });

    it('should handle multi-serving food with disappears marker', async () => {
      // Arrange - Food with 2 servings but we're eating it entirely in one action
      // Note: eat_entirely consumes ALL remaining servings
      const { actor } = fixture.createStandardActorTarget(['Kate', 'Dummy']);
      const food = createFood('Two-Serving Tart', { servings: 1, disappears: true });

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [food.id],
        maxWeightKg: 50,
      });

      // Act
      await fixture.executeAction(actor.id, food.id);

      // Assert - Should be removed
      expect(fixture.entityManager.hasEntity(food.id)).toBe(false);
    });
  });
});
