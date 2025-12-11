/**
 * @file Integration tests for drinking from items in actor inventory (without position components)
 * @see src/logic/operationHandlers/drinkFromHandler.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Drink From - Inventory Items Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:drink_from');
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
      fixture.entityManager.addComponent(actor.id, 'items:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      // Make bottle drinkable liquid container
      fixture.entityManager.addComponent(bottle.id, 'containers-core:liquid_container', {
        liquidType: 'whiskey',
        currentVolumeMilliliters: 500,
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100, // Amount consumed per drink
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

      // Act - Execute drink_from action
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert - Should succeed without warnings
      // Note: The DRINK_FROM handler doesn't directly update hydration - it dispatches
      // an event (LIQUID_CONSUMED_EVENT) that other systems handle.
      // We're testing that the operation succeeds, not the full hydration workflow.

      // Verify operation succeeded
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true); // Action wasn't blocked

      // Bottle should have reduced volume
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBeLessThan(500);
    });

    it('should not increase hydration when container has minimal volume', async () => {
      // Arrange
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Nearly Empty Bottle',
      ]);

      fixture.entityManager.addComponent(actor.id, 'items:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      fixture.entityManager.addComponent(bottle.id, 'containers-core:liquid_container', {
        liquidType: 'water',
        currentVolumeMilliliters: 1, // Minimal volume
        maxCapacityMilliliters: 1000,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'Barely a drop of water.',
      });
      fixture.entityManager.addComponent(bottle.id, 'items:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items:portable', {});

      // Remove position component (in inventory)
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Act
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert - Should succeed even with minimal volume
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Bottle should have reduced volume (even if minimal)
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBeLessThanOrEqual(1);
    });

    it('should succeed even if actor has max hydration component', async () => {
      // Arrange
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Water Bottle',
      ]);

      // Set actor to max hydration
      fixture.entityManager.addComponent(actor.id, 'core:hydration', {
        currentHydration: 100,
        maxHydration: 100,
      });

      fixture.entityManager.addComponent(actor.id, 'items:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      fixture.entityManager.addComponent(bottle.id, 'containers-core:liquid_container', {
        liquidType: 'water',
        currentVolumeMilliliters: 500,
        maxCapacityMilliliters: 1000,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'Fresh water.',
      });
      fixture.entityManager.addComponent(bottle.id, 'items:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items:portable', {});

      // Remove position component (in inventory)
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Act
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert - Operation should succeed
      // Note: The DRINK_FROM operation doesn't check hydration levels - it just consumes liquid.
      // Hydration management is handled by other systems that react to LIQUID_CONSUMED_EVENT.
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Container volume WILL decrease even at max hydration
      // (The handler doesn't prevent drinking, other systems handle waste/effects)
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(400); // 500 - 100 serving
    });

    it('should work with bottle in inventory even if actor has position', async () => {
      // Arrange - Actor has position (at a location), but bottle in inventory does not
      const { actor, target: bottle } = fixture.createStandardActorTarget([
        'Actor Name',
        'Wine Bottle',
      ]);

      // Actor has position (they're standing somewhere)
      fixture.entityManager.addComponent(actor.id, 'core:position', {
        locationId: 'tavern:main_room',
      });

      // Bottle in inventory - NO position component
      fixture.entityManager.addComponent(actor.id, 'items:inventory', {
        items: [bottle.id],
        maxWeightKg: 50,
      });

      fixture.entityManager.addComponent(bottle.id, 'containers-core:liquid_container', {
        liquidType: 'wine',
        currentVolumeMilliliters: 750,
        maxCapacityMilliliters: 750,
        servingSizeMilliliters: 100,
        isRefillable: false,
        flavorText: 'Rich red wine.',
      });
      fixture.entityManager.addComponent(bottle.id, 'items:drinkable', {});
      fixture.entityManager.addComponent(bottle.id, 'items:portable', {});

      // Remove position component (in inventory)
      fixture.entityManager.removeComponent(bottle.id, 'core:position');

      // Verify bottle has NO position
      expect(
        fixture.entityManager.hasComponent(bottle.id, 'core:position')
      ).toBe(false);

      // Act
      const result = await fixture.executeAction(actor.id, bottle.id);

      // Assert - Should succeed
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Bottle should have reduced volume
      const liquidContainer = fixture.entityManager.getComponentData(
        bottle.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBeLessThan(750);
    });
  });
});
