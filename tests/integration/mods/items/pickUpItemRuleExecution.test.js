/**
 * @file Integration tests for the items:pick_up_item action and rule.
 * @description Tests the rule execution after the pick_up_item action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import pickUpItemRule from '../../../../data/mods/items/rules/handle_pick_up_item.rule.json' assert { type: 'json' };
import eventIsActionPickUpItem from '../../../../data/mods/items/conditions/event-is-action-pick-up-item.condition.json' assert { type: 'json' };

/**
 * Creates a standardized pick up item scenario with actor, location, and items.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {Array<{id: string, weight: number}>} items - Items at the location
 * @param {object} actorCapacity - Inventory capacity for actor
 * @param {Array<string>} existingInventory - Items already in inventory
 * @returns {object} Object with room, actor, and item entities
 */
function setupPickUpItemScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  items = [{ id: 'letter-1', weight: 0.05 }],
  actorCapacity = { maxWeight: 50, maxItems: 10 },
  existingInventory = []
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: existingInventory,
      capacity: actorCapacity,
    })
    .build();

  const itemEntities = items.map((item) =>
    new ModEntityBuilder(item.id)
      .withName(item.id)
      .atLocation(locationId)
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: item.weight })
      .build()
  );

  return { room, actor, items: itemEntities };
}

describe('items:pick_up_item action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:pick_up_item',
      pickUpItemRule,
      eventIsActionPickUpItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful pick up operations', () => {
    it('successfully executes pick up item action', async () => {
      // Arrange: Setup scenario
      const scenario = setupPickUpItemScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Act: Pick up letter from location
      await testFixture.executeAction('test:actor1', 'letter-1');

      // Assert: Verify item added to inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('letter-1');

      // Assert: Verify item no longer has position component
      const item = testFixture.entityManager.getEntityInstance('letter-1');
      expect(item.components['core:position']).toBeUndefined();

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('adds item to inventory and preserves capacity settings', async () => {
      const scenario = setupPickUpItemScenario(
        'Sarah',
        'garden',
        [{ id: 'revolver-1', weight: 1.2 }],
        { maxWeight: 50, maxItems: 10 }
      );

      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'revolver-1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');

      // Verify item added
      expect(actor.components['items:inventory'].items).toContain('revolver-1');

      // Verify capacity preserved
      expect(actor.components['items:inventory'].capacity).toEqual({
        maxWeight: 50,
        maxItems: 10,
      });
    });

    it('picks up multiple items sequentially', async () => {
      const scenario = setupPickUpItemScenario(
        'Bob',
        'stable',
        [
          { id: 'horseshoe-1', weight: 0.5 },
          { id: 'rope-1', weight: 1.0 },
        ],
        { maxWeight: 50, maxItems: 10 }
      );

      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Pick up first item
      await testFixture.executeAction('test:actor1', 'horseshoe-1');

      // Pick up second item
      await testFixture.executeAction('test:actor1', 'rope-1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('horseshoe-1');
      expect(actor.components['items:inventory'].items).toContain('rope-1');
      expect(actor.components['items:inventory'].items).toHaveLength(2);
    });

    it('adds to existing inventory', async () => {
      const scenario = setupPickUpItemScenario(
        'Charlie',
        'store',
        [{ id: 'gold-bar-1', weight: 2.0 }],
        { maxWeight: 50, maxItems: 10 },
        ['existing-item-1', 'existing-item-2']
      );

      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'gold-bar-1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toHaveLength(3);
      expect(actor.components['items:inventory'].items).toContain('existing-item-1');
      expect(actor.components['items:inventory'].items).toContain('existing-item-2');
      expect(actor.components['items:inventory'].items).toContain('gold-bar-1');
    });
  });

  describe('capacity validation', () => {
    it('prevents pickup when weight capacity exceeded', async () => {
      const scenario = setupPickUpItemScenario(
        'Dave',
        'mine',
        [{ id: 'heavy-rock-1', weight: 60.0 }],
        { maxWeight: 50, maxItems: 10 }
      );

      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'heavy-rock-1');

      // Verify item NOT added to inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain('heavy-rock-1');

      // Verify item still has position at location
      const item = testFixture.entityManager.getEntityInstance('heavy-rock-1');
      expect(item.components['core:position']).toBeDefined();
      expect(item.components['core:position'].locationId).toBe('mine');

      // Verify turn ended with failure
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);
    });

    it('prevents pickup when item count capacity exceeded', async () => {
      const existingItems = Array.from({ length: 10 }, (_, i) => `item-${i}`);
      const scenario = setupPickUpItemScenario(
        'Eve',
        'warehouse',
        [{ id: 'one-more-item', weight: 0.1 }],
        { maxWeight: 50, maxItems: 10 },
        existingItems
      );

      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'one-more-item');

      // Verify item NOT added to inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain('one-more-item');
      expect(actor.components['items:inventory'].items).toHaveLength(10);
    });
  });

  describe('perception logging', () => {
    it('creates perception log for successful pickup', async () => {
      const scenario = setupPickUpItemScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'letter-1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const pickupEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_picked_up'
      );
      expect(pickupEvent).toBeDefined();
      expect(pickupEvent.payload.locationId).toBe('saloon1');
      expect(pickupEvent.payload.actorId).toBe('test:actor1');
    });

    it('creates perception log for failed pickup', async () => {
      const scenario = setupPickUpItemScenario(
        'Frank',
        'room',
        [{ id: 'too-heavy', weight: 100.0 }],
        { maxWeight: 50, maxItems: 10 }
      );

      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'too-heavy');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const failedEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_pickup_failed'
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.payload.locationId).toBe('room');
    });
  });

  describe('round-trip with drop', () => {
    it('can pick up an item that was previously dropped', async () => {
      const scenario = setupPickUpItemScenario(
        'Grace',
        'cabin',
        [],
        { maxWeight: 50, maxItems: 10 },
        ['letter-1']
      );

      // Create the item entity (simulating it being in inventory)
      const letterItem = new ModEntityBuilder('letter-1')
        .withName('letter-1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      testFixture.reset([scenario.room, scenario.actor, letterItem]);

      // First, the item is in inventory (already set up)
      let actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('letter-1');

      // Drop it (would need drop_item action, but we can simulate)
      // For this test, we'll manually set up the "dropped" state
      const droppedLetterItem = new ModEntityBuilder('letter-1')
        .withName('letter-1')
        .atLocation('cabin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      const actorAfterDrop = new ModEntityBuilder('test:actor1')
        .withName('Grace')
        .atLocation('cabin')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([scenario.room, actorAfterDrop, droppedLetterItem]);

      // Now pick it up again
      await testFixture.executeAction('test:actor1', 'letter-1');

      actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('letter-1');

      const item = testFixture.entityManager.getEntityInstance('letter-1');
      expect(item.components['core:position']).toBeUndefined();
    });
  });

  describe('Pick Up Item - Additional Edge Cases', () => {
    it('should remove position component after pickup', async () => {
      // Setup item at location
      const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();
      const item = new ModEntityBuilder('letter-1')
        .withName('Letter')
        .atLocation('saloon1') // This adds core:position component
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      testFixture.reset([room, actor, item]);

      // Pick up the item
      await testFixture.executeAction('test:actor1', 'letter-1');

      // Verify position component removed
      const itemAfter = testFixture.entityManager.getEntityInstance('letter-1');
      expect(itemAfter.components['core:position']).toBeUndefined();
    });

    it('should respect weight capacity limits', async () => {
      const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Bob')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 1, maxItems: 10 }, // Very low weight capacity
        })
        .build();
      const heavyItem = new ModEntityBuilder('gold-bar-1')
        .withName('Gold Bar')
        .atLocation('saloon1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 12.0 }) // Too heavy
        .build();

      testFixture.reset([room, actor, heavyItem]);

      await testFixture.executeAction('test:actor1', 'gold-bar-1');

      // Verify failure event dispatched
      const failureEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_failed_action_result'
      );
      expect(failureEvent).toBeDefined();
      expect(failureEvent.payload.message).toContain('max_weight_exceeded');

      // Verify item still at location
      const itemAfter = testFixture.entityManager.getEntityInstance('gold-bar-1');
      expect(itemAfter.components['core:position']).toBeDefined();
      expect(itemAfter.components['core:position'].locationId).toBe('saloon1');
    });

    it('should respect item count capacity limits', async () => {
      const room = new ModEntityBuilder('tavern').asRoom('Tavern').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Charlie')
        .atLocation('tavern')
        .asActor()
        .withComponent('items:inventory', {
          items: ['item-1', 'item-2'],
          capacity: { maxWeight: 50, maxItems: 2 }, // At max items
        })
        .build();
      const newItem = new ModEntityBuilder('item-3')
        .withName('Item 3')
        .atLocation('tavern')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.1 })
        .build();

      testFixture.reset([room, actor, newItem]);

      await testFixture.executeAction('test:actor1', 'item-3');

      // Verify failure event
      const failureEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_failed_action_result'
      );
      expect(failureEvent).toBeDefined();
      expect(failureEvent.payload.message).toContain('max_items_exceeded');

      // Verify item not added to inventory
      const actorAfter = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfter.components['items:inventory'].items).not.toContain('item-3');
    });
  });
});
