/**
 * @file Integration tests for drinkable items workflow
 * Tests the complete drink → empty → refill cycle
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ModTestFixture from '../../../common/mods/ModTestFixture.js';

describe('Drinkable Items Workflow', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:drink_from');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('drink_from action', () => {
    it('should consume one serving from a drinkable container', async () => {
      // Arrange
      const actor = fixture.createEntity('Actor', ['core:name', 'items:inventory']);
      const cup = fixture.createEntity('Cup of Tea', [
        'core:name',
        'items:item',
        'items:drinkable',
        'items:portable',
        'items:liquid_container',
      ]);

      fixture.setComponentData(cup, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 250,
        maxVolumeMl: 250,
        servingSizeMl: 50,
        isRefillable: true,
        flavorText: 'The warm tea soothes your throat.',
      });

      // Add cup to actor's inventory
      fixture.setComponentData(actor, 'items:inventory', {
        items: [{ itemId: cup }],
        capacity: { maxWeight: 10, maxItems: 10 },
      });

      // Act
      await fixture.executeAction(actor, cup);

      // Assert
      const updatedContainer = fixture.getComponentData(cup, 'items:liquid_container');
      expect(updatedContainer.currentVolumeMl).toBe(200); // 250 - 50
    });

    it('should fail when container has insufficient liquid', async () => {
      // Arrange
      const actor = fixture.createEntity('Actor', ['core:name', 'items:inventory']);
      const cup = fixture.createEntity('Cup of Tea', [
        'core:name',
        'items:item',
        'items:drinkable',
        'items:portable',
        'items:liquid_container',
      ]);

      fixture.setComponentData(cup, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 25, // Less than serving size
        maxVolumeMl: 250,
        servingSizeMl: 50,
        isRefillable: true,
      });

      fixture.setComponentData(actor, 'items:inventory', {
        items: [{ itemId: cup }],
        capacity: { maxWeight: 10, maxItems: 10 },
      });

      // Act & Assert
      await expect(fixture.executeAction(actor, cup)).rejects.toThrow();
    });
  });

  describe('drink_entirely action', () => {
    beforeEach(async () => {
      fixture = await ModTestFixture.forAction('items', 'items:drink_entirely');
    });

    it('should empty a container completely', async () => {
      // Arrange
      const actor = fixture.createEntity('Actor', ['core:name', 'items:inventory']);
      const cup = fixture.createEntity('Cup of Tea', [
        'core:name',
        'items:item',
        'items:drinkable',
        'items:portable',
        'items:liquid_container',
      ]);

      fixture.setComponentData(cup, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 250,
        maxVolumeMl: 250,
        servingSizeMl: 50,
        isRefillable: true,
      });

      fixture.setComponentData(actor, 'items:inventory', {
        items: [{ itemId: cup }],
        capacity: { maxWeight: 10, maxItems: 10 },
      });

      // Act
      await fixture.executeAction(actor, cup);

      // Assert
      const updatedContainer = fixture.getComponentData(cup, 'items:liquid_container');
      expect(updatedContainer.currentVolumeMl).toBe(0);
    });

    it('should fail when container is already empty', async () => {
      // Arrange
      const actor = fixture.createEntity('Actor', ['core:name', 'items:inventory']);
      const cup = fixture.createEntity('Cup of Tea', [
        'core:name',
        'items:item',
        'items:drinkable',
        'items:portable',
        'items:liquid_container',
      ]);

      fixture.setComponentData(cup, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 0,
        maxVolumeMl: 250,
        servingSizeMl: 50,
        isRefillable: true,
      });

      fixture.setComponentData(actor, 'items:inventory', {
        items: [{ itemId: cup }],
        capacity: { maxWeight: 10, maxItems: 10 },
      });

      // Act & Assert
      await expect(fixture.executeAction(actor, cup)).rejects.toThrow();
    });
  });

  describe('refill_container action', () => {
    beforeEach(async () => {
      fixture = await ModTestFixture.forAction('items', 'items:refill_container');
    });

    it('should transfer liquid from source to target container', async () => {
      // Arrange
      const actor = fixture.createEntity('Actor', [
        'core:name',
        'core:position',
        'items:inventory',
      ]);
      const emptyCup = fixture.createEntity('Empty Cup', [
        'core:name',
        'items:item',
        'items:drinkable',
        'items:portable',
        'items:liquid_container',
      ]);
      const teapot = fixture.createEntity('Teapot', [
        'core:name',
        'items:item',
        'items:liquid_container',
      ]);

      // Set location for actor and teapot
      fixture.setComponentData(actor, 'core:position', {
        locationId: 'test-location',
      });

      fixture.setComponentData(emptyCup, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 0,
        maxVolumeMl: 250,
        servingSizeMl: 50,
        isRefillable: true,
      });

      fixture.setComponentData(teapot, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 1000,
        maxVolumeMl: 1000,
        servingSizeMl: 100,
        isRefillable: false,
      });

      fixture.setComponentData(actor, 'items:inventory', {
        items: [{ itemId: emptyCup }],
        capacity: { maxWeight: 10, maxItems: 10 },
      });

      // Act
      await fixture.executeAction(actor, emptyCup, teapot);

      // Assert
      const updatedTarget = fixture.getComponentData(emptyCup, 'items:liquid_container');
      const updatedSource = fixture.getComponentData(teapot, 'items:liquid_container');

      expect(updatedTarget.currentVolumeMl).toBe(250); // Filled to capacity
      expect(updatedSource.currentVolumeMl).toBe(750); // 1000 - 250
    });

    it('should fail when liquid types do not match', async () => {
      // Arrange
      const actor = fixture.createEntity('Actor', [
        'core:name',
        'core:position',
        'items:inventory',
      ]);
      const cup = fixture.createEntity('Cup', [
        'core:name',
        'items:item',
        'items:drinkable',
        'items:portable',
        'items:liquid_container',
      ]);
      const beerKeg = fixture.createEntity('Beer Keg', [
        'core:name',
        'items:item',
        'items:liquid_container',
      ]);

      fixture.setComponentData(actor, 'core:position', {
        locationId: 'test-location',
      });

      fixture.setComponentData(cup, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 0,
        maxVolumeMl: 250,
        servingSizeMl: 50,
        isRefillable: true,
      });

      fixture.setComponentData(beerKeg, 'items:liquid_container', {
        liquidType: 'beer',
        currentVolumeMl: 5000,
        maxVolumeMl: 5000,
        servingSizeMl: 100,
        isRefillable: false,
      });

      fixture.setComponentData(actor, 'items:inventory', {
        items: [{ itemId: cup }],
        capacity: { maxWeight: 10, maxItems: 10 },
      });

      // Act & Assert
      await expect(fixture.executeAction(actor, cup, beerKeg)).rejects.toThrow();
    });

    it('should fail when target container is not refillable', async () => {
      // Arrange
      const actor = fixture.createEntity('Actor', [
        'core:name',
        'core:position',
        'items:inventory',
      ]);
      const bottle = fixture.createEntity('Beer Bottle', [
        'core:name',
        'items:item',
        'items:drinkable',
        'items:portable',
        'items:liquid_container',
      ]);
      const keg = fixture.createEntity('Beer Keg', [
        'core:name',
        'items:item',
        'items:liquid_container',
      ]);

      fixture.setComponentData(actor, 'core:position', {
        locationId: 'test-location',
      });

      fixture.setComponentData(bottle, 'items:liquid_container', {
        liquidType: 'beer',
        currentVolumeMl: 0,
        maxVolumeMl: 330,
        servingSizeMl: 110,
        isRefillable: false, // Not refillable
      });

      fixture.setComponentData(keg, 'items:liquid_container', {
        liquidType: 'beer',
        currentVolumeMl: 5000,
        maxVolumeMl: 5000,
        servingSizeMl: 100,
        isRefillable: false,
      });

      fixture.setComponentData(actor, 'items:inventory', {
        items: [{ itemId: bottle }],
        capacity: { maxWeight: 10, maxItems: 10 },
      });

      // Act & Assert
      await expect(fixture.executeAction(actor, bottle, keg)).rejects.toThrow();
    });
  });

  describe('complete drink → empty → refill workflow', () => {
    it('should support full consumption and refill cycle', async () => {
      // Arrange - Create entities
      const actor = fixture.createEntity('Actor', [
        'core:name',
        'core:position',
        'items:inventory',
      ]);
      const cup = fixture.createEntity('Cup of Tea', [
        'core:name',
        'items:item',
        'items:drinkable',
        'items:portable',
        'items:liquid_container',
      ]);
      const teapot = fixture.createEntity('Teapot', [
        'core:name',
        'items:item',
        'items:liquid_container',
      ]);

      fixture.setComponentData(actor, 'core:position', {
        locationId: 'test-location',
      });

      fixture.setComponentData(cup, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 250,
        maxVolumeMl: 250,
        servingSizeMl: 50,
        isRefillable: true,
        flavorText: 'The warm tea soothes your throat.',
      });

      fixture.setComponentData(teapot, 'items:liquid_container', {
        liquidType: 'tea',
        currentVolumeMl: 1000,
        maxVolumeMl: 1000,
        servingSizeMl: 100,
        isRefillable: false,
      });

      fixture.setComponentData(actor, 'items:inventory', {
        items: [{ itemId: cup }],
        capacity: { maxWeight: 10, maxItems: 10 },
      });

      // Act - Drink 5 servings to empty the cup
      for (let i = 0; i < 5; i++) {
        await fixture.executeAction(actor, cup);
      }

      // Assert - Cup should be empty
      let containerState = fixture.getComponentData(cup, 'items:liquid_container');
      expect(containerState.currentVolumeMl).toBe(0);

      // Act - Refill the cup from teapot
      const refillFixture = await ModTestFixture.forAction('items', 'items:refill_container');
      await refillFixture.executeAction(actor, cup, teapot);

      // Assert - Cup should be full again
      containerState = refillFixture.getComponentData(cup, 'items:liquid_container');
      expect(containerState.currentVolumeMl).toBe(250);

      refillFixture.cleanup();
    });
  });
});
