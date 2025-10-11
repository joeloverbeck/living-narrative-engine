/**
 * @file Integration tests for the items:examine_item action and rule.
 * @description Tests the rule execution after the examine_item action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import examineItemRule from '../../../../data/mods/items/rules/handle_examine_item.rule.json' assert { type: 'json' };
import eventIsActionExamineItem from '../../../../data/mods/items/conditions/event-is-action-examine-item.condition.json' assert { type: 'json' };

/**
 * Creates a standardized examine item scenario with actor, location, and items.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {Array<{id: string, description: string, inInventory: boolean}>} items - Items to create
 * @returns {object} Object with room, actor, and item entities
 */
function setupExamineItemScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  items = [{ id: 'letter-1', description: 'A weathered letter.', inInventory: false }]
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const inventoryItems = items
    .filter((item) => item.inInventory)
    .map((item) => item.id);

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: inventoryItems,
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const itemEntities = items.map((item) => {
    const builder = new ModEntityBuilder(item.id)
      .withName(item.id)
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:description', { text: item.description });

    // Only add position if item is NOT in inventory
    if (!item.inInventory) {
      builder.atLocation(locationId);
    }

    return builder.build();
  });

  return { room, actor, items: itemEntities };
}

describe('items:examine_item action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:examine_item',
      examineItemRule,
      eventIsActionExamineItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful examination operations', () => {
    it('successfully executes examine item action on inventory item', async () => {
      // Arrange: Setup scenario with item in inventory
      const scenario = setupExamineItemScenario('Alice', 'saloon1', [
        { id: 'letter-1', description: 'A weathered letter.', inInventory: true },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Act: Examine letter from inventory
      await testFixture.executeAction('test:actor1', 'letter-1');

      // Assert: Verify perceptible event with full description
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );
      expect(examineEvent).toBeDefined();
      expect(examineEvent.payload.descriptionText).toBe(
        'Alice examines letter-1: A weathered letter.'
      );
      expect(examineEvent.payload.locationId).toBe('saloon1');
      expect(examineEvent.payload.actorId).toBe('test:actor1');
      expect(examineEvent.payload.targetId).toBe('letter-1');

      // Assert: Verify brief success message
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe('Alice examines letter-1.');

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // Assert: Verify item state unchanged (still in inventory)
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('letter-1');
    });

    it('successfully executes examine item action on location item', async () => {
      // Arrange: Setup scenario with item at location
      const scenario = setupExamineItemScenario('Bob', 'stable', [
        {
          id: 'horseshoe-1',
          description: 'A rusty iron horseshoe.',
          inInventory: false,
        },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Act: Examine horseshoe at location
      await testFixture.executeAction('test:actor1', 'horseshoe-1');

      // Assert: Verify perceptible event with full description
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );
      expect(examineEvent).toBeDefined();
      expect(examineEvent.payload.descriptionText).toBe(
        'Bob examines horseshoe-1: A rusty iron horseshoe.'
      );

      // Assert: Verify item still at location (no state change)
      const item = testFixture.entityManager.getEntityInstance('horseshoe-1');
      expect(item.components['core:position']).toBeDefined();
      expect(item.components['core:position'].locationId).toBe('stable');
    });

    it('handles examination with detailed multi-sentence description', async () => {
      const scenario = setupExamineItemScenario('Charlie', 'library', [
        {
          id: 'old-book',
          description:
            'An ancient leather-bound tome. The pages are yellowed and brittle. Strange symbols cover the binding.',
          inInventory: true,
        },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'old-book');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );
      expect(examineEvent).toBeDefined();
      expect(examineEvent.payload.descriptionText).toBe(
        'Charlie examines old-book: An ancient leather-bound tome. The pages are yellowed and brittle. Strange symbols cover the binding.'
      );
    });
  });

  describe('event structure validation', () => {
    it('includes all required perceptible event fields', async () => {
      const scenario = setupExamineItemScenario('Dave', 'workshop', [
        { id: 'tool-1', description: 'A well-worn hammer.', inInventory: false },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'tool-1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_examined'
      );

      // Verify all required fields
      expect(examineEvent.payload.locationId).toBe('workshop');
      expect(examineEvent.payload.perceptionType).toBe('item_examined');
      expect(examineEvent.payload.actorId).toBe('test:actor1');
      expect(examineEvent.payload.targetId).toBe('tool-1');
      expect(examineEvent.payload.descriptionText).toContain('Dave');
      expect(examineEvent.payload.descriptionText).toContain('tool-1');
      expect(examineEvent.payload.descriptionText).toContain(
        'A well-worn hammer.'
      );
    });

    it('only dispatches expected events (no unexpected side effects)', async () => {
      const scenario = setupExamineItemScenario('Eve', 'cellar', [
        { id: 'wine-bottle', description: 'A dusty wine bottle.', inInventory: true },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'wine-bottle');

      // Count event types
      const eventTypes = testFixture.events.map((e) => e.eventType);

      // Should have exactly these event types
      expect(eventTypes).toContain('core:perceptible_event');
      expect(eventTypes).toContain('core:display_successful_action_result');
      expect(eventTypes).toContain('core:turn_ended');

      // Should NOT have any item state change events
      expect(eventTypes).not.toContain('items:item_picked_up');
      expect(eventTypes).not.toContain('items:item_dropped');
      expect(eventTypes).not.toContain('items:item_transferred');
    });
  });

  describe('no state changes', () => {
    it('does not modify item position for location items', async () => {
      const scenario = setupExamineItemScenario('Frank', 'barn', [
        { id: 'hay-bale', description: 'A large bale of hay.', inInventory: false },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Get initial item state
      const itemBefore =
        testFixture.entityManager.getEntityInstance('hay-bale');
      const positionBefore = itemBefore.components['core:position'];

      await testFixture.executeAction('test:actor1', 'hay-bale');

      // Get item state after examination
      const itemAfter = testFixture.entityManager.getEntityInstance('hay-bale');

      // Position should be unchanged
      expect(itemAfter.components['core:position']).toEqual(positionBefore);
      expect(itemAfter.components['core:position'].locationId).toBe('barn');
    });

    it('does not modify inventory for inventory items', async () => {
      const scenario = setupExamineItemScenario('Grace', 'kitchen', [
        { id: 'key-1', description: 'A brass key.', inInventory: true },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Get initial inventory state
      const actorBefore =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const inventoryBefore = [
        ...actorBefore.components['items:inventory'].items,
      ];

      await testFixture.executeAction('test:actor1', 'key-1');

      // Get inventory after examination
      const actorAfter =
        testFixture.entityManager.getEntityInstance('test:actor1');

      // Inventory should be unchanged
      expect(actorAfter.components['items:inventory'].items).toEqual(
        inventoryBefore
      );
    });
  });

  describe('multiple items scenarios', () => {
    it('can examine multiple items sequentially', async () => {
      const scenario = setupExamineItemScenario('Henry', 'study', [
        { id: 'map-1', description: 'A treasure map.', inInventory: true },
        { id: 'compass-1', description: 'A brass compass.', inInventory: true },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Examine first item
      await testFixture.executeAction('test:actor1', 'map-1');

      const firstExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'map-1'
      );
      expect(firstExamineEvent).toBeDefined();
      expect(firstExamineEvent.payload.descriptionText).toContain(
        'A treasure map.'
      );

      // Examine second item
      await testFixture.executeAction('test:actor1', 'compass-1');

      const secondExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'compass-1'
      );
      expect(secondExamineEvent).toBeDefined();
      expect(secondExamineEvent.payload.descriptionText).toContain(
        'A brass compass.'
      );
    });

    it('handles examination of both inventory and location items', async () => {
      const scenario = setupExamineItemScenario('Iris', 'garden', [
        { id: 'flower-1', description: 'A red rose.', inInventory: false },
        { id: 'shears-1', description: 'Garden shears.', inInventory: true },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Examine location item
      await testFixture.executeAction('test:actor1', 'flower-1');
      const locationExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'flower-1'
      );
      expect(locationExamineEvent).toBeDefined();

      // Examine inventory item
      await testFixture.executeAction('test:actor1', 'shears-1');
      const inventoryExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'shears-1'
      );
      expect(inventoryExamineEvent).toBeDefined();
    });
  });
});
