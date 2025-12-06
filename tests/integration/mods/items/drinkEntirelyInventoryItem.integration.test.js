/**
 * @file Integration tests for drinking entirely from items in actor inventory (without position components)
 * @see src/logic/operationHandlers/drinkEntirelyHandler.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Drink Entirely - Inventory Items Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:drink_entirely');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Drinking entirely from inventory', () => {
    it('should successfully drink entirely from bottle in inventory without position component', async () => {
      // Arrange - Create actor and bottle in inventory (no position component)
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Whiskey Bottle',
      ]);

      // Add bottle to actor's inventory
      fixture.entityManager.addComponent(actor.id, 'items:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle drinkable liquid container
      fixture.entityManager.addComponent(bottle.id, 'items:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: 500,
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'Smooth whiskey with a smoky finish.',
      });
      fixture.entityManager.addComponent(bottle.id, 'items:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items:portable', {});

      // Remove position component from bottle (simulating it being picked up into inventory)
      // Items in inventory shouldn't have position components
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Verify bottle has NO position component
      expect(
        fixture.entityManager.hasComponent(bottle.id, 'core:position')
      ).toBe(false);

      // Act - Execute drink_entirely action
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert - Should succeed without warnings
      // Note: The DRINK_ENTIRELY handler doesn't directly update hydration - it dispatches
      // an event (LIQUID_CONSUMED_ENTIRELY_EVENT) that other systems handle.
      // We're testing that the operation succeeds, not the full hydration workflow.

      // Verify operation succeeded
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true); // Action wasn't blocked

      // Bottle should be completely emptied
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'items:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(0);

      // Bottle should no longer be drinkable
      expect(
        fixture.entityManager.hasComponent(bottle.id, 'items:drinkable')
      ).toBe(false);
    });

    it('should work with partially filled containers in inventory', async () => {
      // Arrange
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Whiskey Bottle',
      ]);

      // Add bottle to actor's inventory
      fixture.entityManager.addComponent(actor.id, 'items:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle drinkable with only 50ml remaining
      fixture.entityManager.addComponent(bottle.id, 'items:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: 50, // Almost empty
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'The last drops of whiskey.',
      });
      fixture.entityManager.addComponent(bottle.id, 'items:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items:portable', {});

      // Remove position component
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Act - Execute drink_entirely action
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Should consume all remaining liquid
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'items:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(0);
    });

    it('should handle full containers in inventory', async () => {
      // Arrange
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Whiskey Bottle',
      ]);

      // Add bottle to actor's inventory
      fixture.entityManager.addComponent(actor.id, 'items:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle drinkable with full capacity
      const maxCapacity = 750;
      fixture.entityManager.addComponent(bottle.id, 'items:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: maxCapacity, // Full bottle
        maxCapacityMilliliters: maxCapacity,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'A full bottle of premium whiskey.',
      });
      fixture.entityManager.addComponent(bottle.id, 'items:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items:portable', {});

      // Remove position component
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Act - Execute drink_entirely action
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Should consume entire bottle
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'items:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(0);
      expect(
        fixture.entityManager.hasComponent(bottle.id, 'items:drinkable')
      ).toBe(false);
    });
  });

  describe('Edge cases with inventory items', () => {
    it('should reject empty container in inventory (missing drinkable component)', async () => {
      // Arrange
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Empty Bottle',
      ]);

      // Add empty bottle to inventory
      fixture.entityManager.addComponent(actor.id, 'items:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle an empty liquid container (no drinkable component)
      fixture.entityManager.addComponent(bottle.id, 'items:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: 0, // Empty
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: '',
      });
      fixture.entityManager.addComponent(bottle.id, 'items:empty', {});
      fixture.entityManager.addComponent(bottle.id, 'items:portable', {});

      // Remove position component
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Act & Assert - Should throw validation error
      await expect(fixture.executeAction(actor.id, bottle.id)).rejects.toThrow(
        'ACTION EXECUTION VALIDATION FAILED'
      );
    });
  });
});
