/**
 * @file Integration tests for drink_from action rule execution
 * @description Tests the complete rule execution flow for drinking from liquid containers
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('drinking:drink_from Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('drinking', 'drinking:drink_from');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('successful drinking scenarios', () => {
    it('should successfully drink from a container and reduce liquid volume', async () => {
      // Arrange - Create actor and drinkable container
      const { actor, target: container } = fixture.createStandardActorTarget([
        'Alice',
        'Water Flask',
      ]);

      // Set up container as drinkable liquid container
      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'water',
          currentVolumeMilliliters: 500,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'Fresh spring water.',
        }
      );
      fixture.entityManager.addComponent(container.id, 'drinking:drinkable', {});

      // Give actor inventory with the container
      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [container.id],
        maxWeightKg: 50,
      });

      // Act - Execute drink_from action
      const result = await fixture.executeAction(actor.id, container.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);

      // Verify liquid was consumed (reduced by serving size)
      const liquidContainer = fixture.entityManager.getComponentData(
        container.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(400); // 500 - 100 serving
    });

    it('should handle drinking last serving and mark container as empty', async () => {
      // Arrange
      const { actor, target: container } = fixture.createStandardActorTarget([
        'Bob',
        'Nearly Empty Flask',
      ]);

      // Set up container with only one serving left
      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'water',
          currentVolumeMilliliters: 100, // Exactly one serving
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'The last drops.',
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

      // Verify container is now empty
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
  });

  describe('edge cases', () => {
    it('should fail drinking when less liquid than serving size remains', async () => {
      // Arrange
      const { actor, target: container } = fixture.createStandardActorTarget([
        'Charlie',
        'Almost Empty Flask',
      ]);

      // Set up container with less than one serving
      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'water',
          currentVolumeMilliliters: 50, // Less than serving size
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'Just a sip left.',
        }
      );
      fixture.entityManager.addComponent(container.id, 'drinking:drinkable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [container.id],
        maxWeightKg: 50,
      });

      // Act
      const result = await fixture.executeAction(actor.id, container.id);

      // Assert - DRINK_FROM requires a full serving size, so it should fail
      // when there's insufficient volume. Use drink_entirely to consume partial amounts.
      expect(result).toBeDefined();

      // Verify liquid volume unchanged (operation failed)
      const liquidContainer = fixture.entityManager.getComponentData(
        container.id,
        'containers-core:liquid_container'
      );
      expect(liquidContainer.currentVolumeMilliliters).toBe(50);
    });
  });
});
