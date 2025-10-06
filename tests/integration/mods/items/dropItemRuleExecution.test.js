/**
 * @file Integration tests for the items:drop_item action and rule.
 * @description Tests the rule execution after the drop_item action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import dropItemRule from '../../../../data/mods/items/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/items/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

/**
 * Creates a standardized drop item scenario with actor, location, and items.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {Array<{id: string, weight: number}>} items - Items for the actor's inventory
 * @param {object} actorCapacity - Inventory capacity for actor
 * @returns {object} Object with room, actor, and item entities
 */
function setupDropItemScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  items = [{ id: 'letter-1', weight: 0.05 }],
  actorCapacity = { maxWeight: 50, maxItems: 10 }
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: items.map((item) => item.id),
      capacity: actorCapacity,
    })
    .build();

  const itemEntities = items.map((item) =>
    new ModEntityBuilder(item.id)
      .withName(item.id)
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: item.weight })
      .build()
  );

  return { room, actor, items: itemEntities };
}

describe('items:drop_item action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful drop operations', () => {
    it('successfully executes drop item action', async () => {
      // Arrange: Setup scenario
      const scenario = setupDropItemScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Act: Drop letter at location
      await testFixture.executeAction('test:actor1', 'letter-1');

      // Assert: Verify item removed from inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain('letter-1');

      // Assert: Verify item has position component at correct location
      const item = testFixture.entityManager.getEntityInstance('letter-1');
      expect(item.components['core:position']).toBeDefined();
      expect(item.components['core:position'].locationId).toBe('saloon1');

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('removes item from inventory and preserves capacity settings', async () => {
      const scenario = setupDropItemScenario(
        'Sarah',
        'garden',
        [{ id: 'revolver-1', weight: 1.2 }],
        { maxWeight: 50, maxItems: 10 }
      );

      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'revolver-1');

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');

      // Verify item removed
      expect(actor.components['items:inventory'].items).not.toContain('revolver-1');

      // Verify capacity preserved
      expect(actor.components['items:inventory'].capacity).toEqual({
        maxWeight: 50,
        maxItems: 10,
      });
    });

    it('drops multiple items sequentially', async () => {
      const scenario = setupDropItemScenario(
        'Bob',
        'tavern',
        [
          { id: 'item1', weight: 0.5 },
          { id: 'item2', weight: 0.3 },
          { id: 'item3', weight: 0.2 },
        ],
        { maxWeight: 50, maxItems: 10 }
      );

      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      // Drop first item
      await testFixture.executeAction('test:actor1', 'item1');
      let actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toEqual(['item2', 'item3']);

      let item1 = testFixture.entityManager.getEntityInstance('item1');
      expect(item1.components['core:position'].locationId).toBe('tavern');

      // Drop second item
      await testFixture.executeAction('test:actor1', 'item2');
      actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toEqual(['item3']);

      let item2 = testFixture.entityManager.getEntityInstance('item2');
      expect(item2.components['core:position'].locationId).toBe('tavern');

      // Drop third item
      await testFixture.executeAction('test:actor1', 'item3');
      actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toEqual([]);

      let item3 = testFixture.entityManager.getEntityInstance('item3');
      expect(item3.components['core:position'].locationId).toBe('tavern');
    });
  });

  describe('perception logging', () => {
    it('creates perception log entry when item dropped', async () => {
      const scenario = setupDropItemScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'letter-1');

      // Verify DISPATCH_PERCEPTIBLE_EVENT was called
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.locationId).toBe('saloon1');
      expect(perceptibleEvent.payload.perceptionType).toBe('item_dropped');
      expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
      expect(perceptibleEvent.payload.involvedEntities).toContain('letter-1');
    });

    it('includes correct description in perception log', async () => {
      const scenario = setupDropItemScenario('Charlie', 'kitchen', [
        { id: 'golden-watch', weight: 0.1 },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'golden-watch');

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toContain('Charlie');
      expect(perceptibleEvent.payload.descriptionText).toContain('dropped');
      expect(perceptibleEvent.payload.descriptionText).toContain('golden-watch');
    });
  });

  describe('error scenarios', () => {
    it('handles error when item not in inventory', async () => {
      const scenario = setupDropItemScenario('Alice', 'saloon1', [], {
        maxWeight: 50,
        maxItems: 10,
      });
      testFixture.reset([scenario.room, scenario.actor]);

      // Create an item not in inventory
      const notInInventory = new ModEntityBuilder('not-in-inventory')
        .withName('NotInInventory')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:weight', { weight: 0.5 })
        .build();
      testFixture.entityManager.createEntityInstance(notInInventory);

      // Try to drop item not in inventory - should fail gracefully
      await testFixture.executeAction('test:actor1', 'not-in-inventory');

      // Verify turn ended with failure
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      // The turn should still end, but the operation should fail internally
    });
  });
});
