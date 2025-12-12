/**
 * @file Integration tests for the items:jot_down_notes action and rule.
 * @description Tests the rule execution after the jot_down_notes action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import jotDownNotesRule from '../../../../data/mods/items/rules/handle_jot_down_notes.rule.json' assert { type: 'json' };
import eventIsActionJotDownNotes from '../../../../data/mods/items/conditions/event-is-action-jot-down-notes.condition.json' assert { type: 'json' };

/**
 * Creates a standardized jot down notes scenario with actor, location, and notebook.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {boolean} notebookInInventory - Whether notebook is in inventory
 * @returns {object} Object with room, actor, and notebook entities
 */
function setupJotDownNotesScenario(
  actorName = 'Alice',
  locationId = 'office1',
  notebookInInventory = true
) {
  const room = new ModEntityBuilder(locationId).asRoom('Office').build();

  const inventoryItems = notebookInInventory ? ['notebook-1'] : [];

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: inventoryItems,
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const notebookBuilder = new ModEntityBuilder('notebook-1')
    .withName('Field Notebook')
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('items:readable', {
      text: 'Previously written notes about patrol observations.',
    });

  // Only add position if notebook is NOT in inventory
  if (!notebookInInventory) {
    notebookBuilder.atLocation(locationId);
  }

  const notebook = notebookBuilder.build();

  return { room, actor, notebook };
}

/**
 * Asserts that the provided events include a successful turn end.
 *
 * @param {Array<object>} events - Events emitted during the action execution
 * @returns {object} The matching turn ended event
 */
function expectSuccessfulTurnEnd(events) {
  const turnEndedEvent = events.find(
    (event) => event.eventType === 'core:turn_ended'
  );
  expect(turnEndedEvent).toBeDefined();
  expect(turnEndedEvent.payload.success).toBe(true);
  return turnEndedEvent;
}

describe('items:jot_down_notes action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:jot_down_notes',
      jotDownNotesRule,
      eventIsActionJotDownNotes
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful jot down notes operations', () => {
    it('successfully executes jot down notes action', async () => {
      // Arrange: Setup scenario with notebook in inventory
      const scenario = setupJotDownNotesScenario('Alice', 'office1', true);
      testFixture.reset([scenario.room, scenario.actor, scenario.notebook]);

      // Store initial notebook content
      const notebookBefore =
        testFixture.entityManager.getEntityInstance('notebook-1');
      const readableContentBefore =
        notebookBefore.components['items:readable'].text;

      // Act: Jot down notes in notebook
      await testFixture.executeAction('test:actor1', 'notebook-1');

      // Assert: Verify perceptible event with expected message
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const jotNotesEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'communication.notes'
      );
      expect(jotNotesEvent).toBeDefined();
      expect(jotNotesEvent.payload.descriptionText).toBe(
        'Alice jots down notes on Field Notebook.'
      );
      expect(jotNotesEvent.payload.locationId).toBe('office1');
      expect(jotNotesEvent.payload.actorId).toBe('test:actor1');
      expect(jotNotesEvent.payload.targetId).toBe('notebook-1');

      // Assert: Verify success message
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Alice jots down notes on Field Notebook.'
      );

      // Assert: Verify turn ended successfully
      expectSuccessfulTurnEnd(testFixture.events);

      // Assert: Verify notebook content unchanged (static content)
      const notebookAfter =
        testFixture.entityManager.getEntityInstance('notebook-1');
      expect(notebookAfter.components['items:readable'].text).toBe(
        readableContentBefore
      );

      // Assert: Verify notebook still in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('notebook-1');
    });

    it('works with any readable item', async () => {
      // Arrange: Create a book (not specifically a notebook)
      const room = new ModEntityBuilder('library1').asRoom('Library').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Bob')
        .atLocation('library1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['book-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const book = new ModEntityBuilder('book-1')
        .withName('Old Journal')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', { text: 'Old journal entries.' })
        .build();

      testFixture.reset([room, actor, book]);

      // Act: Jot down notes in the journal (works on any readable item)
      await testFixture.executeAction('test:actor1', 'book-1');

      // Assert: Action succeeds
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Bob jots down notes on Old Journal.'
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('event structure validation', () => {
    it('includes all required perceptible event fields', async () => {
      const scenario = setupJotDownNotesScenario('Charlie', 'cabin', true);
      testFixture.reset([scenario.room, scenario.actor, scenario.notebook]);

      await testFixture.executeAction('test:actor1', 'notebook-1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const jotNotesEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'communication.notes'
      );

      // Verify all required fields
      expect(jotNotesEvent.payload.locationId).toBe('cabin');
      expect(jotNotesEvent.payload.perceptionType).toBe('communication.notes');
      expect(jotNotesEvent.payload.actorId).toBe('test:actor1');
      expect(jotNotesEvent.payload.targetId).toBe('notebook-1');
      expect(jotNotesEvent.payload.descriptionText).toContain('Charlie');
      expect(jotNotesEvent.payload.descriptionText).toContain('Field Notebook');

      expectSuccessfulTurnEnd(testFixture.events);
    });

    it('only dispatches expected events (no unexpected side effects)', async () => {
      const scenario = setupJotDownNotesScenario('Dave', 'station', true);
      testFixture.reset([scenario.room, scenario.actor, scenario.notebook]);

      await testFixture.executeAction('test:actor1', 'notebook-1');

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
      expect(eventTypes).not.toContain('items:item_modified');

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('no state changes', () => {
    it('does not modify notebook content', async () => {
      const scenario = setupJotDownNotesScenario('Eve', 'tent', true);
      testFixture.reset([scenario.room, scenario.actor, scenario.notebook]);

      // Get initial notebook state
      const notebookBefore =
        testFixture.entityManager.getEntityInstance('notebook-1');
      const readableContentBefore = JSON.parse(
        JSON.stringify(notebookBefore.components['items:readable'])
      );

      await testFixture.executeAction('test:actor1', 'notebook-1');

      // Get notebook state after jotting
      const notebookAfter =
        testFixture.entityManager.getEntityInstance('notebook-1');

      // Content should be unchanged
      expect(notebookAfter.components['items:readable']).toEqual(
        readableContentBefore
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });

    it('does not modify inventory', async () => {
      const scenario = setupJotDownNotesScenario('Frank', 'bunker', true);
      testFixture.reset([scenario.room, scenario.actor, scenario.notebook]);

      // Get initial inventory state
      const actorBefore =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const inventoryBefore = [
        ...actorBefore.components['items:inventory'].items,
      ];

      await testFixture.executeAction('test:actor1', 'notebook-1');

      // Get inventory after jotting
      const actorAfter =
        testFixture.entityManager.getEntityInstance('test:actor1');

      // Inventory should be unchanged
      expect(actorAfter.components['items:inventory'].items).toEqual(
        inventoryBefore
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('multiple jotting scenarios', () => {
    it('can jot down notes multiple times sequentially', async () => {
      const scenario = setupJotDownNotesScenario('Grace', 'outpost', true);
      testFixture.reset([scenario.room, scenario.actor, scenario.notebook]);

      // First jotting
      const firstActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'notebook-1');

      const firstActionEvents = testFixture.events.slice(firstActionStart);
      expectSuccessfulTurnEnd(firstActionEvents);

      const firstJotEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'communication.notes'
      );
      expect(firstJotEvent).toBeDefined();

      // Second jotting
      const secondActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'notebook-1');

      const secondActionEvents = testFixture.events.slice(secondActionStart);
      expectSuccessfulTurnEnd(secondActionEvents);

      const allJotEvents = testFixture.events.filter(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.perceptionType === 'communication.notes'
      );
      expect(allJotEvents).toHaveLength(2);

      // Content should still be unchanged
      const notebookAfter =
        testFixture.entityManager.getEntityInstance('notebook-1');
      expect(notebookAfter.components['items:readable'].text).toBe(
        'Previously written notes about patrol observations.'
      );
    });
  });
});
