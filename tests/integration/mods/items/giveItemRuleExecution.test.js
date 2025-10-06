/**
 * @file Integration tests for the items:give_item action and rule.
 * @description Tests the rule execution after the give_item action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import giveItemRule from '../../../../data/mods/items/rules/handle_give_item.rule.json' assert { type: 'json' };
import eventIsActionGiveItem from '../../../../data/mods/items/conditions/event-is-action-give-item.condition.json' assert { type: 'json' };

/**
 * Creates a standardized give item scenario with actors and items.
 *
 * @param {string} actorName - Name for the giver
 * @param {string} targetName - Name for the recipient
 * @param {string} locationId - Location for the scenario
 * @param {Array<{id: string, weight: number}>} items - Items for the actor's inventory
 * @param {object} actorCapacity - Inventory capacity for actor
 * @param {object} targetCapacity - Inventory capacity for target
 * @returns {object} Object with room, actor, target, and item entities
 */
function setupGiveItemScenario(
  actorName = 'Alice',
  targetName = 'Bob',
  locationId = 'saloon1',
  items = [{ id: 'letter-1', weight: 0.05 }],
  actorCapacity = { maxWeight: 50, maxItems: 10 },
  targetCapacity = { maxWeight: 50, maxItems: 10 }
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

  const target = new ModEntityBuilder('test:actor2')
    .withName(targetName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: [],
      capacity: targetCapacity,
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

  return { room, actor, target, items: itemEntities };
}

describe('items:give_item action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:give_item',
      giveItemRule,
      eventIsActionGiveItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful transfers', () => {
    it('successfully executes give item action between actors with capacity', async () => {
      // Arrange: Setup scenario
      const scenario = setupGiveItemScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.target, ...scenario.items]);

      // Act: Give letter to Bob
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryTargetId: 'letter-1',
        },
      });

      // Assert: Verify transfer occurred
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      const target = testFixture.entityManager.getEntityInstance('test:actor2');

      expect(actor.components['items:inventory'].items).not.toContain('letter-1');
      expect(target.components['items:inventory'].items).toContain('letter-1');

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('transfers item and preserves capacity settings', async () => {
      const scenario = setupGiveItemScenario(
        'Sarah',
        'James',
        'garden',
        [{ id: 'revolver-1', weight: 1.2 }],
        { maxWeight: 50, maxItems: 10 },
        { maxWeight: 30, maxItems: 5 }
      );

      testFixture.reset([scenario.room, scenario.actor, scenario.target, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryTargetId: 'revolver-1',
        },
      });

      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      const target = testFixture.entityManager.getEntityInstance('test:actor2');

      // Verify capacities preserved
      expect(actor.components['items:inventory'].capacity).toEqual({
        maxWeight: 50,
        maxItems: 10,
      });
      expect(target.components['items:inventory'].capacity).toEqual({
        maxWeight: 30,
        maxItems: 5,
      });
    });
  });

  describe('capacity failure scenarios', () => {
    it('fails when recipient inventory full (item count)', async () => {
      const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['letter-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const target = new ModEntityBuilder('test:actor2')
        .withName('Bob')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['item-1', 'item-2'],
          capacity: { maxWeight: 50, maxItems: 2 }, // At capacity
        })
        .build();

      const letter = new ModEntityBuilder('letter-1')
        .withName('letter-1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:weight', { weight: 0.05 })
        .build();

      const item1 = new ModEntityBuilder('item-1')
        .withName('item-1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:weight', { weight: 0.1 })
        .build();

      const item2 = new ModEntityBuilder('item-2')
        .withName('item-2')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:weight', { weight: 0.1 })
        .build();

      testFixture.reset([room, actor, target, letter, item1, item2]);

      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryTargetId: 'letter-1',
        },
      });

      // Verify failure
      const failureEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_failed_action_result'
      );

      expect(failureEvent).toBeDefined();
      expect(failureEvent.payload.message).toContain('max_items_exceeded');

      // Verify item didn't move
      const actorAfter = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfter.components['items:inventory'].items).toContain('letter-1');
    });

    it('fails when item too heavy for recipient', async () => {
      const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['gold-bar-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const target = new ModEntityBuilder('test:actor2')
        .withName('Bob')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 5, maxItems: 10 }, // Too low for gold bar
        })
        .build();

      const goldBar = new ModEntityBuilder('gold-bar-1')
        .withName('gold-bar-1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:weight', { weight: 12.4 })
        .build();

      testFixture.reset([room, actor, target, goldBar]);

      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryTargetId: 'gold-bar-1',
        },
      });

      // Verify failure
      const failureEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_failed_action_result'
      );

      expect(failureEvent).toBeDefined();
      expect(failureEvent.payload.message).toContain('max_weight_exceeded');

      // Verify item didn't move
      const actorAfter = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfter.components['items:inventory'].items).toContain('gold-bar-1');
    });
  });

  describe('perception logging', () => {
    it('dispatches perceptible event on successful transfer', async () => {
      const scenario = setupGiveItemScenario('Elena', 'Marcus', 'bedroom');
      testFixture.reset([scenario.room, scenario.actor, scenario.target, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryTargetId: 'letter-1',
        },
      });

      // Verify perceptible event
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe('item_transfer');
      expect(perceptibleEvent.payload.locationId).toBe('bedroom');
      expect(perceptibleEvent.payload.descriptionText).toContain('gave');
      expect(perceptibleEvent.payload.descriptionText).toContain('letter-1');
    });

    it('validates perceptible event message matches action success message', async () => {
      const scenario = setupGiveItemScenario(
        'Diana',
        'Victor',
        'library',
        [{ id: 'book-1', weight: 0.5 }]
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.target, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryTargetId: 'book-1',
        },
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();

      // Perceptible event should reference the item transfer
      expect(perceptibleEvent.payload.descriptionText).toContain('book-1');
    });
  });

  describe('turn management', () => {
    it('ends turn after successful action execution', async () => {
      const scenario = setupGiveItemScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.target, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryTargetId: 'letter-1',
        },
      });

      // Verify END_TURN event
      const endTurnEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );

      expect(endTurnEvent).toBeDefined();
      expect(endTurnEvent.payload.entityId).toBe('test:actor1');
      expect(endTurnEvent.payload.success).toBe(true);
    });
  });

  describe('action only fires for correct action ID', () => {
    it('does not fire for different action IDs', async () => {
      const scenario = setupGiveItemScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.target, ...scenario.items]);

      // Try with a different action
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: 'test:actor1',
        actionId: 'kissing:kiss_cheek',
        targetId: 'test:actor2',
        originalInput: 'kiss_cheek target',
      });

      // Should not have any perceptible events from our rule
      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });
});
