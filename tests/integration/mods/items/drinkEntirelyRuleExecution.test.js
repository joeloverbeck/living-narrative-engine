/**
 * @file Integration tests for the items:drink_entirely action and rule.
 * @description Tests the rule execution after the drink_entirely action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import drinkEntirelyRule from '../../../../data/mods/items/rules/handle_drink_entirely.rule.json' assert { type: 'json' };
import eventIsActionDrinkEntirely from '../../../../data/mods/items/conditions/event-is-action-drink-entirely.condition.json' assert { type: 'json' };

/**
 * Creates a standardized drink entirely scenario with actor, location, and drinkable container.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {string} containerId - ID for the drinkable container
 * @param {number} currentVolume - Current volume in milliliters
 * @param {number} servingSize - Serving size in milliliters (ignored by drink_entirely)
 * @param {string} flavorText - Flavor description
 * @param {boolean} isEmpty - Whether container has empty component
 * @param {string} containerName - Display name for the container
 * @returns {object} Object with room, actor, and container entities
 */
function setupDrinkEntirelyScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  containerId = 'whiskey-bottle-1',
  currentVolume = 500,
  servingSize = 200,
  flavorText = 'You drink it all in one go.',
  isEmpty = false,
  containerName = 'Whiskey Bottle'
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
    .withComponent('items:liquid_container', {
      currentVolumeMilliliters: currentVolume,
      servingSizeMilliliters: servingSize,
      flavorText,
    })
    .withComponent('items:drinkable', {});

  if (isEmpty) {
    containerBuilder.withComponent('items:empty', {});
  }

  const container = containerBuilder.build();

  return { room, actor, container };
}

describe('items:drink_entirely action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:drink_entirely',
      drinkEntirelyRule,
      eventIsActionDrinkEntirely
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful drink entirely operations', () => {
    it('successfully executes drink entirely action emptying container', async () => {
      // Arrange: Setup scenario with drinkable container
      const scenario = setupDrinkEntirelyScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Act: Drink entirely from container
      await testFixture.executeAction('test:actor1', 'whiskey-bottle-1');

      // Assert: Verify volume set to 0
      const container =
        testFixture.entityManager.getEntityInstance('whiskey-bottle-1');
      expect(
        container.components['items:liquid_container'].currentVolumeMilliliters
      ).toBe(0);

      // Assert: Verify empty component added
      expect(container.components['items:empty']).toBeDefined();

      // Assert: Verify drinkable component removed
      expect(container.components['items:drinkable']).toBeUndefined();

      // Assert: Verify public perceptible event dispatched
      const publicEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed_entirely' &&
          (!e.payload.contextualData?.recipientIds ||
            e.payload.contextualData.recipientIds.length === 0)
      );
      expect(publicEvent).toBeDefined();
      expect(publicEvent.payload.descriptionText).toContain(
        'Alice drinks entirely from Whiskey Bottle, emptying it.'
      );
      expect(publicEvent.payload.descriptionText).not.toContain('one go');

      // Assert: Verify private perceptible event dispatched (with flavor)
      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed_entirely' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent).toBeDefined();
      expect(privateEvent.payload.contextualData.recipientIds).toEqual([
        'test:actor1',
      ]);
      expect(privateEvent.payload.descriptionText).toContain(
        'You drink it all in one go.'
      );

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('dispatches liquid_consumed_entirely event', async () => {
      const scenario = setupDrinkEntirelyScenario(
        'Bob',
        'tavern',
        'mug-1',
        400,
        100,
        'Strong drink.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'mug-1');

      // Find the liquid_consumed_entirely event
      const consumedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:liquid_consumed_entirely'
      );
      expect(consumedEvent).toBeDefined();
      expect(consumedEvent.payload.actorEntity).toBe('test:actor1');
      expect(consumedEvent.payload.containerEntity).toBe('mug-1');
      expect(consumedEvent.payload.volumeConsumed).toBe(400);
    });

    it('empties container with small volume remaining', async () => {
      // Arrange: Container with less than one serving
      const scenario = setupDrinkEntirelyScenario(
        'Charlie',
        'cabin',
        'flask-1',
        50,
        200,
        'Last drops.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Act: Drink entirely from container
      await testFixture.executeAction('test:actor1', 'flask-1');

      // Assert: Verify all volume consumed
      const container = testFixture.entityManager.getEntityInstance('flask-1');
      expect(
        container.components['items:liquid_container'].currentVolumeMilliliters
      ).toBe(0);

      // Assert: Verify empty component added
      expect(container.components['items:empty']).toBeDefined();

      // Assert: Verify drinkable component removed
      expect(container.components['items:drinkable']).toBeUndefined();

      // Assert: Verify private event shows correct volume
      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent.payload.contextualData.volumeConsumed).toBe(50);
    });

    it('empties container with large volume remaining', async () => {
      // Arrange: Container with multiple servings worth
      const scenario = setupDrinkEntirelyScenario(
        'Dave',
        'camp',
        'canteen-1',
        2000,
        200,
        'Huge gulp.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Act: Drink entirely from container
      await testFixture.executeAction('test:actor1', 'canteen-1');

      // Assert: Verify all volume consumed (not just one serving)
      const container =
        testFixture.entityManager.getEntityInstance('canteen-1');
      expect(
        container.components['items:liquid_container'].currentVolumeMilliliters
      ).toBe(0);

      // Assert: Verify empty component added
      expect(container.components['items:empty']).toBeDefined();

      // Assert: Verify drinkable component removed
      expect(container.components['items:drinkable']).toBeUndefined();

      // Assert: Verify private event shows full volume consumed
      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent.payload.contextualData.volumeConsumed).toBe(2000);
    });

    it('ignores serving size and empties completely', async () => {
      // Arrange: Container where volume doesn't match serving size
      const scenario = setupDrinkEntirelyScenario(
        'Eve',
        'inn',
        'pitcher-1',
        350,
        100,
        'Odd amount.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Act: Drink entirely
      await testFixture.executeAction('test:actor1', 'pitcher-1');

      // Assert: Verify ALL volume consumed, not just serving size increments
      const container =
        testFixture.entityManager.getEntityInstance('pitcher-1');
      expect(
        container.components['items:liquid_container'].currentVolumeMilliliters
      ).toBe(0);
      expect(container.components['items:empty']).toBeDefined();

      // Verify exactly 350ml consumed, not 300ml (3 servings)
      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent.payload.contextualData.volumeConsumed).toBe(350);
    });
  });

  describe('perception system behavior', () => {
    it('sends public message without flavor text to all observers', async () => {
      const scenario = setupDrinkEntirelyScenario(
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
          e.payload.perceptionType === 'liquid_consumed_entirely' &&
          (!e.payload.contextualData?.recipientIds ||
            e.payload.contextualData.recipientIds.length === 0)
      );

      expect(publicEvents).toHaveLength(1);
      const publicEvent = publicEvents[0];
      expect(publicEvent.payload.descriptionText).toContain(
        'Frank drinks entirely from glass-1, emptying it.'
      );
      expect(publicEvent.payload.descriptionText).not.toContain(
        'private flavor'
      );
    });

    it('excludes acting actor from public perceptible event', async () => {
      const scenario = setupDrinkEntirelyScenario(
        'Alice',
        'tavern',
        'ale-mug-1',
        600,
        200,
        'Strong and bitter.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'ale-mug-1');

      // Find public perceptible event
      const publicEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed_entirely' &&
          (!e.payload.contextualData?.recipientIds ||
            e.payload.contextualData.recipientIds.length === 0)
      );

      expect(publicEvent).toBeDefined();
      expect(publicEvent.payload.contextualData.excludedActorIds).toEqual([
        'test:actor1',
      ]);
      expect(publicEvent.payload.descriptionText).not.toContain('bitter');
    });

    it('sends private message with flavor text only to actor', async () => {
      const scenario = setupDrinkEntirelyScenario(
        'Grace',
        'tavern',
        'cup-1',
        500,
        100,
        'Secret magical taste.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'cup-1');

      const privateEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'liquid_consumed_entirely' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );

      expect(privateEvents).toHaveLength(1);
      const privateEvent = privateEvents[0];
      expect(privateEvent.payload.contextualData.recipientIds).toEqual([
        'test:actor1',
      ]);
      expect(privateEvent.payload.descriptionText).toContain(
        'Secret magical taste.'
      );
      expect(privateEvent.payload.contextualData.flavorText).toBe(
        'Secret magical taste.'
      );
    });

    it('handles missing flavor text gracefully', async () => {
      const scenario = setupDrinkEntirelyScenario(
        'Henry',
        'camp',
        'bottle-1',
        400,
        200,
        '', // Empty flavor text
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
        'Henry drinks entirely from bottle-1, emptying it.'
      );
      // Should still dispatch event even with empty flavor
      expect(privateEvent.payload.contextualData.flavorText).toBe('');
    });

    it('dispatches UI success message', async () => {
      const scenario = setupDrinkEntirelyScenario(
        'Bob',
        'saloon',
        'whiskey-bottle-1',
        500,
        100,
        'Smooth and potent.',
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
        'Bob drinks entirely from whiskey-bottle-1, emptying it.'
      );
    });
  });

  describe('empty container behavior', () => {
    it('prevents drinking from already empty container', async () => {
      // Note: This scenario shouldn't normally happen due to forbidden_components in action definition,
      // but we test the handler behavior directly
      const scenario = setupDrinkEntirelyScenario(
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
    it('handles very small volumes', async () => {
      const scenario = setupDrinkEntirelyScenario(
        'Julia',
        'lab',
        'vial-1',
        10,
        200,
        'Tiny amount.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'vial-1');

      const container = testFixture.entityManager.getEntityInstance('vial-1');
      expect(
        container.components['items:liquid_container'].currentVolumeMilliliters
      ).toBe(0);
      expect(container.components['items:empty']).toBeDefined();

      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent.payload.contextualData.volumeConsumed).toBe(10);
    });

    it('handles very large volumes', async () => {
      const scenario = setupDrinkEntirelyScenario(
        'Kevin',
        'brewery',
        'barrel-1',
        5000,
        250,
        'Epic chug.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'barrel-1');

      const container = testFixture.entityManager.getEntityInstance('barrel-1');
      expect(
        container.components['items:liquid_container'].currentVolumeMilliliters
      ).toBe(0);
      expect(container.components['items:empty']).toBeDefined();

      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent.payload.contextualData.volumeConsumed).toBe(5000);
    });

    it('handles volume not divisible by serving size', async () => {
      const scenario = setupDrinkEntirelyScenario(
        'Laura',
        'kitchen',
        'jar-1',
        275,
        100,
        'Odd volume.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'jar-1');

      const container = testFixture.entityManager.getEntityInstance('jar-1');
      expect(
        container.components['items:liquid_container'].currentVolumeMilliliters
      ).toBe(0);
      expect(container.components['items:empty']).toBeDefined();

      // Verify exactly 275ml consumed
      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent.payload.contextualData.volumeConsumed).toBe(275);
    });
  });

  describe('comparison with drink_from', () => {
    it('drink_entirely empties container regardless of serving size', async () => {
      // This test demonstrates the key difference: drink_entirely ignores serving size
      const scenario = setupDrinkEntirelyScenario(
        'Mike',
        'hall',
        'jug-1',
        750,
        100,
        'All at once.'
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'jug-1');

      // Verify ALL 750ml consumed, not just 100ml (one serving)
      const container = testFixture.entityManager.getEntityInstance('jug-1');
      expect(
        container.components['items:liquid_container'].currentVolumeMilliliters
      ).toBe(0);
      expect(container.components['items:empty']).toBeDefined();

      const privateEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.contextualData?.recipientIds?.length > 0
      );
      expect(privateEvent.payload.contextualData.volumeConsumed).toBe(750);
    });
  });
});
