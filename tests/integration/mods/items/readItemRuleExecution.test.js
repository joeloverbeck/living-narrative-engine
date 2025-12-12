/**
 * @file Integration tests for the items:read_item action and rule.
 * @description Verifies rule execution for reading readable items and related side effects.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import readItemRule from '../../../../data/mods/items/rules/handle_read_item.rule.json' assert { type: 'json' };
import eventIsActionReadItem from '../../../../data/mods/items/conditions/event-is-action-read-item.condition.json' assert { type: 'json' };

/**
 * Creates a standard read item scenario with configurable items.
 *
 * @param {string} actorName - Actor display name.
 * @param {string} locationId - Scenario location identifier.
 * @param {Array<{id: string, text: string, inInventory: boolean}>} items - Items to include.
 * @returns {{ room: object, actor: object, items: Array<object> }}
 */
function setupReadItemScenario(
  actorName = 'Reader',
  locationId = 'reading_room',
  items = [
    {
      id: 'readable-item-1',
      text: 'Sample readable entry.',
      inInventory: true,
    },
  ]
) {
  const room = new ModEntityBuilder(locationId).asRoom('Reading Room').build();

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
      .withComponent('items:readable', { text: item.text });

    if (!item.inInventory) {
      builder.atLocation(locationId);
    }

    return builder.build();
  });

  return { room, actor, items: itemEntities };
}

describe('items:read_item action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:read_item',
      readItemRule,
      eventIsActionReadItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful reading scenarios', () => {
    it('delivers readable text privately when item is in inventory', async () => {
      const scenario = setupReadItemScenario('Alice', 'library', [
        {
          id: 'journal-entry-1',
          text: 'Entry 1: Supplies are running low.',
          inInventory: true,
        },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'journal-entry-1');

      const perceptibleEvent = testFixture.events.find(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.perceptionType === 'item.examine'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(
        'Alice reads journal-entry-1: Entry 1: Supplies are running low.'
      );
      expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
      expect(perceptibleEvent.payload.targetId).toBe('journal-entry-1');
      expect(perceptibleEvent.payload.contextualData?.recipientIds).toEqual([
        'test:actor1',
      ]);

      const successMessage = testFixture.events.find(
        (event) => event.eventType === 'core:display_successful_action_result'
      );
      expect(successMessage).toBeDefined();
      expect(successMessage.payload.message).toBe(
        'Alice reads journal-entry-1.'
      );

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      const actorAfter =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfter.components['items:inventory'].items).toContain(
        'journal-entry-1'
      );
    });

    it('delivers readable text for location items without moving them', async () => {
      const scenario = setupReadItemScenario('Bob', 'study', [
        {
          id: 'notice-board',
          text: 'Notice: All patrols report to the captain.',
          inInventory: false,
        },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'notice-board');

      const perceptibleEvent = testFixture.events.find(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.targetId === 'notice-board'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(
        'Bob reads notice-board: Notice: All patrols report to the captain.'
      );

      const itemAfter =
        testFixture.entityManager.getEntityInstance('notice-board');
      expect(itemAfter.components['core:position']).toBeDefined();
      expect(itemAfter.components['core:position'].locationId).toBe('study');
    });

    it('preserves multi-sentence readable text verbatim', async () => {
      const scenario = setupReadItemScenario('Clara', 'archive', [
        {
          id: 'ancient-scroll',
          text: 'Line one whispers secrets. Line two warns of danger. Line three promises treasure.',
          inInventory: true,
        },
      ]);
      testFixture.reset([scenario.room, scenario.actor, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'ancient-scroll');

      const perceptibleEvent = testFixture.events.find(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.targetId === 'ancient-scroll'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(
        'Clara reads ancient-scroll: Line one whispers secrets. Line two warns of danger. Line three promises treasure.'
      );
    });

    it('restricts perception log entries to the acting actor', async () => {
      const scenario = setupReadItemScenario('Darius', 'archives', [
        {
          id: 'sealed-letter',
          text: 'Darius, meet me at midnight behind the chapel.',
          inInventory: true,
        },
      ]);

      const observer = new ModEntityBuilder('observer-1')
        .withName('Onlooker')
        .atLocation('archives')
        .asActor()
        .withComponent('core:perception_log', {
          maxEntries: 10,
          logEntries: [],
        })
        .build();

      const actorWithLog = new ModEntityBuilder('test:actor1')
        .withName('Darius')
        .atLocation('archives')
        .asActor()
        .withComponent('items:inventory', {
          items: ['sealed-letter'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('core:perception_log', {
          maxEntries: 10,
          logEntries: [],
        })
        .build();

      const readableItem = new ModEntityBuilder('sealed-letter')
        .withName('sealed-letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Darius, meet me at midnight behind the chapel.',
        })
        .build();

      testFixture.reset([scenario.room, actorWithLog, observer, readableItem]);

      await testFixture.executeAction('test:actor1', 'sealed-letter');

      const perceptibleEvent = testFixture.events.find(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.actorId === 'test:actor1'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.contextualData?.recipientIds).toEqual([
        'test:actor1',
      ]);

      const perceptionLogHandler = new AddPerceptionLogEntryHandler({
        entityManager: testFixture.entityManager,
        logger: testFixture.logger,
        safeEventDispatcher: { dispatch: () => {} },
      });

      await perceptionLogHandler.execute({
        location_id: perceptibleEvent.payload.locationId,
        entry: {
          descriptionText: perceptibleEvent.payload.descriptionText,
          timestamp: perceptibleEvent.payload.timestamp,
          perceptionType: perceptibleEvent.payload.perceptionType,
          actorId: perceptibleEvent.payload.actorId,
          targetId: perceptibleEvent.payload.targetId,
          involvedEntities: perceptibleEvent.payload.involvedEntities,
        },
        originating_actor_id: perceptibleEvent.payload.actorId,
        recipient_ids: perceptibleEvent.payload.contextualData?.recipientIds,
      });

      const observerEntity =
        testFixture.entityManager.getEntityInstance('observer-1');
      const observerLog =
        observerEntity.components['core:perception_log'].logEntries;
      expect(observerLog).toHaveLength(0);
    });
  });

  describe('failure scenarios', () => {
    it('fails gracefully when item lacks readable component', async () => {
      const room = new ModEntityBuilder('study').asRoom('Study').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Elias')
        .atLocation('study')
        .asActor()
        .withComponent('items:inventory', {
          items: ['blank-book'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const nonReadableItem = new ModEntityBuilder('blank-book')
        .withName('blank-book')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, nonReadableItem]);

      await testFixture.executeAction('test:actor1', 'blank-book', {
        skipDiscovery: true,
      });

      const failureEvent = testFixture.events.find(
        (event) => event.eventType === 'core:display_failed_action_result'
      );
      expect(failureEvent).toBeDefined();
      expect(failureEvent.payload.message).toBe(
        'Elias cannot read blank-book.'
      );

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeUndefined();

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);
    });
  });
});
