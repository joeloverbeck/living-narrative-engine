/**
 * @file Integration tests for the items:drink_from action and rule.
 * @description Tests the rule execution after the drink_from action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import drinkFromRule from '../../../../data/mods/items/rules/handle_drink_from.rule.json' assert { type: 'json' };
import eventIsActionDrinkFrom from '../../../../data/mods/items/conditions/event-is-action-drink-from.condition.json' assert { type: 'json' };

/**
 * Creates a standardized drink from scenario with actor, location, and drinkable container.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {string} containerId - ID for the drinkable container
 * @param {number} currentVolume - Current volume in milliliters
 * @param {number} servingSize - Serving size in milliliters
 * @param {string} flavorText - Flavor description
 * @param {boolean} isEmpty - Whether container has empty component
 * @param {string} containerName - Display name for the container
 * @returns {object} Object with room, actor, and container entities
 */
function setupDrinkFromScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  containerId = 'water-bottle-1',
  currentVolume = 500,
  servingSize = 200,
  flavorText = 'The water is refreshing.',
  isEmpty = false,
  containerName = 'Water Bottle'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .build();

  const containerBuilder = new ModEntityBuilder(containerId)
    .withName(containerName)
    .atLocation(locationId)
    .withComponent('containers-core:liquid_container', {
      currentVolumeMilliliters: currentVolume,
      maxCapacityMilliliters: currentVolume,
      servingSizeMilliliters: servingSize,
      isRefillable: true,
      flavorText: flavorText || 'No particular taste.',
    })
    .withComponent('items:drinkable', {});

  if (isEmpty) {
    containerBuilder.withComponent('items:empty', {});
  }

  const container = containerBuilder.build();

  return { room, actor, container };
}

describe('items:drink_from action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:drink_from',
      drinkFromRule,
      eventIsActionDrinkFrom
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful drink operations', () => {
    it('successfully executes drink from action with normal serving', async () => {
      // Arrange: Setup scenario with drinkable container
      const scenario = setupDrinkFromScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Act: Drink from container
      await testFixture.executeAction('test:actor1', 'water-bottle-1');

      // Assert: Verify volume reduced by serving size
      const container =
        testFixture.entityManager.getEntityInstance('water-bottle-1');
      expect(
        container.components['containers-core:liquid_container'].currentVolumeMilliliters
      ).toBe(300);

      // Assert: Verify drinkable component still present
      expect(container.components['items:drinkable']).toBeDefined();

      // Assert: Verify empty component NOT added
      expect(container.components['items:empty']).toBeUndefined();

      // Assert: Verify public perceptible event dispatched
      const publicEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed' &&
          (!e.payload.contextualData?.recipientIds ||
            e.payload.contextualData.recipientIds.length === 0)
      );
      expect(publicEvent).toBeDefined();
      expect(publicEvent.payload.descriptionText).toContain(
        'Alice drinks from Water Bottle.'
      );
      expect(publicEvent.payload.descriptionText).not.toContain('refreshing');

      // Assert: Verify private perceptible event dispatched (with flavor)
      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent).toBeDefined();
      expect(privateEvent.payload.contextualData.recipientIds).toEqual([
        'test:actor1',
      ]);
      expect(privateEvent.payload.descriptionText).toContain(
        'The water is refreshing.'
      );

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('dispatches liquid_consumed event', async () => {
      const scenario = setupDrinkFromScenario(
        'Bob',
        'tavern',
        'mug-1',
        400,
        100,
        'Cold ale.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'mug-1');

      // Find the liquid_consumed event
      const consumedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:liquid_consumed'
      );
      expect(consumedEvent).toBeDefined();
      expect(consumedEvent.payload.actorEntity).toBe('test:actor1');
      expect(consumedEvent.payload.containerEntity).toBe('mug-1');
      expect(consumedEvent.payload.volumeConsumed).toBe(100);
    });

    it('successfully drinks when volume equals serving size', async () => {
      // Arrange: Container with exactly one serving
      const scenario = setupDrinkFromScenario(
        'Charlie',
        'cabin',
        'flask-1',
        200,
        200,
        'Final sip.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Act: Drink from container
      await testFixture.executeAction('test:actor1', 'flask-1');

      // Assert: Verify container emptied
      const container = testFixture.entityManager.getEntityInstance('flask-1');
      expect(
        container.components['containers-core:liquid_container'].currentVolumeMilliliters
      ).toBe(0);

      // Assert: Verify empty component added
      expect(container.components['items:empty']).toBeDefined();

      // Assert: Verify drinkable component removed
      expect(container.components['items:drinkable']).toBeUndefined();
    });

    it('successfully drinks multiple times until empty', async () => {
      // Arrange: Container with multiple servings
      const scenario = setupDrinkFromScenario(
        'Dave',
        'inn',
        'pitcher-1',
        600,
        200,
        'Good wine.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Act: First drink
      await testFixture.executeAction('test:actor1', 'pitcher-1');
      let container = testFixture.entityManager.getEntityInstance('pitcher-1');
      expect(
        container.components['containers-core:liquid_container'].currentVolumeMilliliters
      ).toBe(400);
      expect(container.components['items:drinkable']).toBeDefined();

      // Act: Second drink
      await testFixture.executeAction('test:actor1', 'pitcher-1');
      container = testFixture.entityManager.getEntityInstance('pitcher-1');
      expect(
        container.components['containers-core:liquid_container'].currentVolumeMilliliters
      ).toBe(200);
      expect(container.components['items:drinkable']).toBeDefined();

      // Act: Third drink (empties container)
      await testFixture.executeAction('test:actor1', 'pitcher-1');
      container = testFixture.entityManager.getEntityInstance('pitcher-1');
      expect(
        container.components['containers-core:liquid_container'].currentVolumeMilliliters
      ).toBe(0);
      expect(container.components['items:drinkable']).toBeUndefined();
      expect(container.components['items:empty']).toBeDefined();
    });
  });

  describe('perception system behavior', () => {
    it('sends public message without flavor text to all observers', async () => {
      const scenario = setupDrinkFromScenario(
        'Frank',
        'bar',
        'glass-1',
        300,
        150,
        'This is the private flavor text.',
        false,
        'glass-1'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'glass-1');

      const publicEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed' &&
          (!e.payload.contextualData?.recipientIds ||
            e.payload.contextualData.recipientIds.length === 0)
      );

      expect(publicEvents).toHaveLength(1);
      const publicEvent = publicEvents[0];
      expect(publicEvent.payload.descriptionText).toBe(
        'Frank drinks from glass-1.'
      );
      expect(publicEvent.payload.descriptionText).not.toContain(
        'private flavor'
      );
    });

    it('excludes acting actor from public perceptible event', async () => {
      const scenario = setupDrinkFromScenario(
        'Alice',
        'tavern',
        'mug-1',
        400,
        100,
        'The flavor is complex.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'mug-1');

      // Find public perceptible event
      const publicEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed' &&
          (!e.payload.contextualData?.recipientIds ||
            e.payload.contextualData.recipientIds.length === 0)
      );

      expect(publicEvent).toBeDefined();
      expect(publicEvent.payload.contextualData.excludedActorIds).toEqual([
        'test:actor1',
      ]);
      expect(publicEvent.payload.descriptionText).not.toContain('complex');
    });

    it('sends private message with flavor text only to actor', async () => {
      const scenario = setupDrinkFromScenario(
        'Grace',
        'tavern',
        'cup-1',
        500,
        100,
        'Secret spicy flavor.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'cup-1');

      const privateEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );

      expect(privateEvents).toHaveLength(1);
      const privateEvent = privateEvents[0];
      expect(privateEvent.payload.contextualData.recipientIds).toEqual([
        'test:actor1',
      ]);
      expect(privateEvent.payload.descriptionText).toContain(
        'Secret spicy flavor.'
      );
      expect(privateEvent.payload.contextualData.flavorText).toBe(
        'Secret spicy flavor.'
      );
    });

    it('handles missing flavor text gracefully', async () => {
      const scenario = setupDrinkFromScenario(
        'Henry',
        'camp',
        'bottle-1',
        400,
        200,
        '', // Empty flavor text - will use default
        false,
        'bottle-1'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'bottle-1');

      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent).toBeDefined();
      expect(privateEvent.payload.descriptionText).toContain(
        'Henry drinks from bottle-1.'
      );
      // Should use default flavor text when empty string provided
      expect(privateEvent.payload.descriptionText).toContain(
        'No particular taste.'
      );
      expect(privateEvent.payload.contextualData.flavorText).toBe(
        'No particular taste.'
      );
    });

    it('dispatches UI success message', async () => {
      const scenario = setupDrinkFromScenario(
        'Bob',
        'saloon',
        'whiskey-bottle-1',
        500,
        100,
        'Smooth and warming.',
        false,
        'whiskey-bottle-1' // Use ID as name for predictable message
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'whiskey-bottle-1');

      // Find the UI success message event
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );

      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Bob drinks from whiskey-bottle-1.'
      );
    });
  });

  describe('empty container behavior', () => {
    it('prevents drinking from already empty container', async () => {
      // Note: Action validation should catch this due to forbidden_components
      const scenario = setupDrinkFromScenario(
        'Ian',
        'desert',
        'empty-canteen-1',
        0,
        200,
        '',
        true // isEmpty = true
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Attempt to drink from empty container - should throw ActionValidationError
      await expect(
        testFixture.executeAction('test:actor1', 'empty-canteen-1')
      ).rejects.toThrow('ACTION EXECUTION VALIDATION FAILED');
    });
  });

  describe('edge cases', () => {
    it('handles very small serving sizes', async () => {
      const scenario = setupDrinkFromScenario(
        'Julia',
        'lab',
        'vial-1',
        50,
        10,
        'Concentrated potion.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'vial-1');

      const container = testFixture.entityManager.getEntityInstance('vial-1');
      expect(
        container.components['containers-core:liquid_container'].currentVolumeMilliliters
      ).toBe(40);
    });

    it('handles very large volumes', async () => {
      const scenario = setupDrinkFromScenario(
        'Kevin',
        'brewery',
        'barrel-1',
        5000,
        250,
        'Fresh beer.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'barrel-1');

      const container = testFixture.entityManager.getEntityInstance('barrel-1');
      expect(
        container.components['containers-core:liquid_container'].currentVolumeMilliliters
      ).toBe(4750);
    });
  });
});
