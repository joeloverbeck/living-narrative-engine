/**
 * @file Integration tests for drink_entirely action rule execution
 * @description Tests the complete rule execution flow for drinking all liquid from containers
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('drinking:drink_entirely Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'drinking',
      'drinking:drink_entirely'
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('successful drinking scenarios', () => {
    it('should successfully drink entire container and empty it completely', async () => {
      // Arrange - Create actor and drinkable container
      const { actor, target: container } = fixture.createStandardActorTarget([
        'Alice',
        'Small Potion',
      ]);

      // Set up container as drinkable liquid container
      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'healing_potion',
          currentVolumeMilliliters: 100,
          maxCapacityMilliliters: 100,
          servingSizeMilliliters: 50,
          isRefillable: false,
          flavorText: 'A glowing red liquid.',
        }
      );
      fixture.entityManager.addComponent(container.id, 'drinking:drinkable', {});

      // Give actor inventory with the container
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [container.id],
        maxWeightKg: 50,
      });

      // Act - Execute drink_entirely action
      const result = await fixture.executeAction(actor.id, container.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Verify all liquid was consumed
      const liquidContainer = fixture.entityManager.getComponentData(
        container.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(0);

      // Verify drinkable component was removed and empty component added
      expect(
        fixture.entityManager.hasComponent(container.id, 'drinking:drinkable')
      ).toBe(false);
      expect(
        fixture.entityManager.hasComponent(container.id, 'drinking:empty')
      ).toBe(true);
    });

    it('should handle large containers with multiple servings', async () => {
      // Arrange
      const { actor, target: container } = fixture.createStandardActorTarget([
        'Bob',
        'Large Wine Bottle',
      ]);

      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'wine',
          currentVolumeMilliliters: 750,
          maxCapacityMilliliters: 750,
          servingSizeMilliliters: 150,
          isRefillable: true,
          flavorText: 'A fine vintage.',
        }
      );
      fixture.entityManager.addComponent(container.id, 'drinking:drinkable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [container.id],
        maxWeightKg: 50,
      });

      // Act
      const result = await fixture.executeAction(actor.id, container.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Verify entire bottle was consumed
      const liquidContainer = fixture.entityManager.getComponentData(
        container.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle container with minimal liquid remaining', async () => {
      // Arrange
      const { actor, target: container } = fixture.createStandardActorTarget([
        'Charlie',
        'Almost Empty Vial',
      ]);

      // Set up container with only trace amount
      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'water',
          currentVolumeMilliliters: 5, // Very small amount
          maxCapacityMilliliters: 100,
          servingSizeMilliliters: 25,
          isRefillable: true,
          flavorText: 'Just droplets.',
        }
      );
      fixture.entityManager.addComponent(container.id, 'drinking:drinkable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [container.id],
        maxWeightKg: 50,
      });

      // Act
      const result = await fixture.executeAction(actor.id, container.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Verify all remaining liquid was consumed
      const liquidContainer = fixture.entityManager.getComponentData(
        container.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(0);
    });
  });
});
