/**
 * @file Integration tests for drink_from action prerequisites
 * @description Tests the prerequisite evaluation for the drink_from action
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('drinking:drink_from Prerequisites', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('drinking', 'drinking:drink_from');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('required components', () => {
    it('should require target to have drinkable component', async () => {
      // Arrange - Create actor and container WITHOUT drinkable component
      const { actor, target: container } = fixture.createStandardActorTarget([
        'Alice',
        'Plain Flask',
      ]);

      // Set up container as liquid container but NOT drinkable
      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'oil', // Not drinkable
          currentVolumeMilliliters: 500,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'Lamp oil.',
        }
      );
      // Note: NOT adding drinking:drinkable component

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [container.id],
        maxWeightKg: 50,
      });

      // Act & Assert - Should reject due to missing drinkable component
      await expect(
        fixture.executeAction(actor.id, container.id)
      ).rejects.toThrow('ACTION EXECUTION VALIDATION FAILED');
    });

    it('should require target to have liquid_container component', async () => {
      // Arrange
      const { actor, target: item } = fixture.createStandardActorTarget([
        'Bob',
        'Rock',
      ]);

      // Only add drinkable but not liquid_container (invalid state)
      fixture.entityManager.addComponent(item.id, 'drinking:drinkable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [item.id],
        maxWeightKg: 50,
      });

      // Act & Assert
      await expect(fixture.executeAction(actor.id, item.id)).rejects.toThrow();
    });
  });

  describe('forbidden components', () => {
    it('should reject containers marked as empty', async () => {
      // Arrange
      const { actor, target: container } = fixture.createStandardActorTarget([
        'Charlie',
        'Empty Flask',
      ]);

      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'water',
          currentVolumeMilliliters: 0,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: '',
        }
      );
      // Add empty component (forbidden for drink_from)
      fixture.entityManager.addComponent(container.id, 'drinking:empty', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [container.id],
        maxWeightKg: 50,
      });

      // Act & Assert - Should reject due to empty component
      await expect(
        fixture.executeAction(actor.id, container.id)
      ).rejects.toThrow('ACTION EXECUTION VALIDATION FAILED');
    });
  });

  describe('liquid availability', () => {
    it('should allow drinking from container with liquid', async () => {
      // Arrange - Valid drinkable container with liquid
      const { actor, target: container } = fixture.createStandardActorTarget([
        'David',
        'Full Flask',
      ]);

      fixture.entityManager.addComponent(
        container.id,
        'containers-core:liquid_container',
        {
          liquidType: 'water',
          currentVolumeMilliliters: 500,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'Fresh water.',
        }
      );
      fixture.entityManager.addComponent(container.id, 'drinking:drinkable', {});

      fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
        items: [container.id],
        maxWeightKg: 50,
      });

      // Act & Assert - Should succeed
      const result = await fixture.executeAction(actor.id, container.id);
      expect(result).toBeDefined();
      expect(result.blocked).not.toBe(true);
    });
  });
});
