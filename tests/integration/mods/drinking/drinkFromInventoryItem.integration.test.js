/**
 * @file Integration tests for drinking from items in actor inventory (without position components)
 * @see src/logic/operationHandlers/drinkFromHandler.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Drink From - Inventory Items Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('drinking', 'drinking:drink_from');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Drinking from inventory', () => {
    it('should successfully drink from bottle in inventory without position component', async () => {
      // Arrange - Create actor and bottle in inventory (no position component)
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Whiskey Bottle',
      ]);

      // Add bottle to actor's inventory
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle drinkable liquid container
      fixture.entityManager.addComponent(bottle.id, 'containers-core:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: 500,
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'Smooth whiskey with a smoky finish.',
      });
      fixture.entityManager.addComponent(bottle.id, 'drinking:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items-core:portable', {});

      // Remove position component from bottle (simulating it being picked up into inventory)
      // Items in inventory shouldn't have position components
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Verify bottle has NO position component
      expect(
        fixture.entityManager.hasComponent(bottle.id, 'core:position')
      ).toBe(false);

      // Act - Execute drink_from action
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert - Should succeed without warnings
      // Note: The DRINK_FROM handler doesn't directly update hydration - it dispatches
      // an event (LIQUID_CONSUMED_EVENT) that other systems handle.
      // We're testing that the operation succeeds, not the full hydration workflow.

      // Verify operation succeeded
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true); // Action wasn't blocked

      // Verify liquid was reduced by serving size
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(400); // 500 - 100 serving
    });

    it('should work with partially filled containers in inventory', async () => {
      // Arrange
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Whiskey Bottle',
      ]);

      // Add bottle to actor's inventory
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle drinkable with only 150ml remaining
      fixture.entityManager.addComponent(bottle.id, 'containers-core:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: 150,
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'The last of the whiskey.',
      });
      fixture.entityManager.addComponent(bottle.id, 'drinking:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items-core:portable', {});

      // Remove position component
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Act - Execute drink_from action
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Should have consumed one serving
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(50); // 150 - 100
    });

    it('should handle containers with exactly one serving left', async () => {
      // Arrange
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Whiskey Bottle',
      ]);

      // Add bottle to actor's inventory
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle drinkable with exactly one serving
      fixture.entityManager.addComponent(bottle.id, 'containers-core:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: 100, // Exactly one serving
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'The final serving.',
      });
      fixture.entityManager.addComponent(bottle.id, 'drinking:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items-core:portable', {});

      // Remove position component
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Act - Execute drink_from action
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Should be completely empty
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(0);
      expect(
        fixture.entityManager.hasComponent(bottle.id, 'drinking:drinkable')
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
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle an empty liquid container (no drinkable component)
      fixture.entityManager.addComponent(bottle.id, 'containers-core:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: 0, // Empty
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: '',
      });
      fixture.entityManager.addComponent(bottle.id, 'drinking:empty', {});
      fixture.entityManager.addComponent(bottle.id, 'items-core:portable', {});

      // Remove position component
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Act & Assert - Should throw validation error
      await expect(fixture.executeAction(actor.id, bottle.id)).rejects.toThrow(
        'ACTION EXECUTION VALIDATION FAILED'
      );
    });
  });
});
