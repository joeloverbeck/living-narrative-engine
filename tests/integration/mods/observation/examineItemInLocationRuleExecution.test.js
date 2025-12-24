import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import examineItemInLocationRule from '../../../../data/mods/observation/rules/handle_examine_item_in_location.rule.json' assert { type: 'json' };
import eventIsActionExamineItemInLocation from '../../../../data/mods/observation/conditions/event-is-action-examine-item-in-location.condition.json' assert { type: 'json' };

/**
 * Creates a standardized examine item in location scenario with actor and location item.
 *
 * @param {string} actorName - Name of the actor
 * @param {string} locationId - ID of the location
 * @param {object} item - Item configuration with id, description, and portable flag
 * @returns {object} Scenario with room, actor, and item entities
 */
function setupExamineItemInLocationScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  item = {
    id: 'horseshoe-1',
    description: 'A rusty iron horseshoe.',
    portable: true,
  }
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .build();

  const itemBuilder = new ModEntityBuilder(item.id)
    .withName(item.id)
    .atLocation(locationId)
    .withComponent('items-core:item', {})
    .withComponent('core:description', { text: item.description });

  if (item.portable) {
    itemBuilder.withComponent('items-core:portable', {});
  }

  const itemEntity = itemBuilder.build();

  return { room, actor, item: itemEntity };
}

/**
 * Asserts that the provided events include a successful turn end.
 *
 * @param {Array} events - Array of dispatched events
 * @returns {object} The turn ended event
 */
function expectSuccessfulTurnEnd(events) {
  const turnEndedEvent = events.find(
    (event) => event.eventType === 'core:turn_ended'
  );
  expect(turnEndedEvent).toBeDefined();
  expect(turnEndedEvent.payload.success).toBe(true);
  return turnEndedEvent;
}

describe('observation:examine_item_in_location rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'observation',
      'observation:examine_item_in_location',
      examineItemInLocationRule,
      eventIsActionExamineItemInLocation
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful examination operations', () => {
    it('successfully executes examine item in location action on portable location item', async () => {
      // Arrange: Setup scenario with portable item at location
      const scenario = setupExamineItemInLocationScenario('Bob', 'stable', {
        id: 'horseshoe-1',
        description: 'A rusty iron horseshoe.',
        portable: true,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      // Act: Examine horseshoe at location
      await testFixture.executeAction('test:actor1', 'horseshoe-1');

      // Assert: Verify perceptible event with full description (no possessive)
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item.examine'
      );
      expect(examineEvent).toBeDefined();
      // Per payload contract: descriptionText is brief third-person message
      // Item description is in actor_description (not in payload)
      expect(examineEvent.payload.descriptionText).toBe(
        'Bob examines horseshoe-1.'
      );
      expect(examineEvent.payload.descriptionText).not.toContain('their');

      expectSuccessfulTurnEnd(testFixture.events);

      // Assert: Verify item still at location (no state change)
      const item = testFixture.entityManager.getEntityInstance('horseshoe-1');
      expect(item.components['core:position']).toBeDefined();
      expect(item.components['core:position'].locationId).toBe('stable');
    });

    it('successfully executes examine item in location action on non-portable location item', async () => {
      // Arrange: Setup scenario with non-portable item at location
      const scenario = setupExamineItemInLocationScenario('Frank', 'room1', {
        id: 'heavy_furniture',
        description: 'A massive oak wardrobe',
        portable: false,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      // Act: Examine furniture at location
      await testFixture.executeAction('test:actor1', 'heavy_furniture');

      // Assert: Verify perceptible event with full description (no possessive)
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item.examine'
      );
      expect(examineEvent).toBeDefined();
      // Per payload contract: descriptionText is brief third-person message
      // Item description is in actor_description (not in payload)
      expect(examineEvent.payload.descriptionText).toBe(
        'Frank examines heavy_furniture.'
      );
      expect(examineEvent.payload.descriptionText).not.toContain('their');

      expectSuccessfulTurnEnd(testFixture.events);

      // Assert: Verify item still at location (no state change)
      const item =
        testFixture.entityManager.getEntityInstance('heavy_furniture');
      expect(item.components['core:position']).toBeDefined();
      expect(item.components['core:position'].locationId).toBe('room1');
    });

    it('handles examination with detailed multi-sentence description', async () => {
      const scenario = setupExamineItemInLocationScenario(
        'Charlie',
        'library',
        {
          id: 'old-book',
          description:
            'An ancient leather-bound tome. The pages are yellowed and brittle. Strange symbols cover the binding.',
          portable: true,
        }
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'old-book');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item.examine'
      );
      expect(examineEvent).toBeDefined();
      // Per payload contract: descriptionText is brief third-person message
      // Item description is in actor_description (not in payload)
      expect(examineEvent.payload.descriptionText).toBe(
        'Charlie examines old-book.'
      );
      expect(examineEvent.payload.descriptionText).not.toContain('their');

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('event structure validation', () => {
    it('includes all required perceptible event fields', async () => {
      const scenario = setupExamineItemInLocationScenario('Dave', 'workshop', {
        id: 'tool-1',
        description: 'A well-worn hammer.',
        portable: true,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'tool-1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const examineEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item.examine'
      );

      // Verify all required fields
      expect(examineEvent.payload.locationId).toBe('workshop');
      expect(examineEvent.payload.perceptionType).toBe('item.examine');
      expect(examineEvent.payload.actorId).toBe('test:actor1');
      expect(examineEvent.payload.targetId).toBe('tool-1');
      // Per payload contract: descriptionText is brief third-person message
      // Item description ("A well-worn hammer.") is in actor_description (not in payload)
      expect(examineEvent.payload.descriptionText).toContain('Dave');
      expect(examineEvent.payload.descriptionText).not.toContain('their');
      expect(examineEvent.payload.descriptionText).toContain('tool-1');
      expect(examineEvent.payload.descriptionText).toBe(
        'Dave examines tool-1.'
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });

    it('only dispatches expected events (no unexpected side effects)', async () => {
      const scenario = setupExamineItemInLocationScenario('Eve', 'cellar', {
        id: 'wine-bottle',
        description: 'A dusty wine bottle.',
        portable: true,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

      await testFixture.executeAction('test:actor1', 'wine-bottle');

      // Count event types
      const eventTypes = testFixture.events.map((e) => e.eventType);

      // Should have exactly these event types
      expect(eventTypes).toContain('core:perceptible_event');
      expect(eventTypes).toContain('core:display_successful_action_result');
      expect(eventTypes).toContain('core:turn_ended');

      // Should NOT have any item state change events
      expect(eventTypes).not.toContain('items-core:item_picked_up');
      expect(eventTypes).not.toContain('items-core:item_dropped');
      expect(eventTypes).not.toContain('items-core:item_transferred');

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('no state changes', () => {
    it('does not modify item position for location items', async () => {
      const scenario = setupExamineItemInLocationScenario('Frank', 'barn', {
        id: 'hay-bale',
        description: 'A large bale of hay.',
        portable: false,
      });
      testFixture.reset([scenario.room, scenario.actor, scenario.item]);

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

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('multiple items scenarios', () => {
    it('can examine multiple location items sequentially', async () => {
      const room = new ModEntityBuilder('study').asRoom('Study').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Henry')
        .atLocation('study')
        .asActor()
        .build();

      const map = new ModEntityBuilder('map-1')
        .withName('map-1')
        .atLocation('study')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:description', { text: 'A treasure map.' })
        .build();

      const compass = new ModEntityBuilder('compass-1')
        .withName('compass-1')
        .atLocation('study')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:description', { text: 'A brass compass.' })
        .build();

      testFixture.reset([room, actor, map, compass]);

      // Examine first item
      const firstActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'map-1');

      const firstActionEvents = testFixture.events.slice(firstActionStart);
      expectSuccessfulTurnEnd(firstActionEvents);

      const firstExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'map-1'
      );
      expect(firstExamineEvent).toBeDefined();
      // Per payload contract: descriptionText is brief third-person message
      expect(firstExamineEvent.payload.descriptionText).toBe(
        'Henry examines map-1.'
      );
      expect(firstExamineEvent.payload.descriptionText).not.toContain('their');

      // Examine second item
      const secondActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'compass-1');

      const secondActionEvents = testFixture.events.slice(secondActionStart);
      expectSuccessfulTurnEnd(secondActionEvents);

      const secondExamineEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.targetId === 'compass-1'
      );
      expect(secondExamineEvent).toBeDefined();
      // Per payload contract: descriptionText is brief third-person message
      expect(secondExamineEvent.payload.descriptionText).toBe(
        'Henry examines compass-1.'
      );
      expect(secondExamineEvent.payload.descriptionText).not.toContain('their');

      const examineEvents = testFixture.events.filter(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.perceptionType === 'item.examine'
      );
      expect(examineEvents).toHaveLength(2);
    });
  });
});
