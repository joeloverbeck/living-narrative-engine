/**
 * @file Integration tests for the writing:sign_document action and rule.
 * @description Tests the rule execution after the sign_document action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import signDocumentRule from '../../../../data/mods/writing/rules/handle_sign_document.rule.json' assert { type: 'json' };
import eventIsActionSignDocument from '../../../../data/mods/writing/conditions/event-is-action-sign-document.condition.json' assert { type: 'json' };

/**
 * Creates a standardized sign document scenario with actor, location, document, and pencil.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {boolean} documentInInventory - Whether document is in inventory
 * @returns {object} Object with room, actor, document, and pencil entities
 */
function setupSignDocumentScenario(
  actorName = 'Alice',
  locationId = 'office1',
  documentInInventory = true
) {
  const room = new ModEntityBuilder(locationId).asRoom('Office').build();

  const inventoryItems = documentInInventory
    ? ['contract-1', 'pencil-1']
    : ['pencil-1'];

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('inventory:inventory', {
      items: inventoryItems,
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const documentBuilder = new ModEntityBuilder('contract-1')
    .withName('Employment Contract')
    .withComponent('items-core:item', {})
    .withComponent('items-core:portable', {})
    .withComponent('writing:signable', {});

  // Only add position if document is NOT in inventory
  if (!documentInInventory) {
    documentBuilder.atLocation(locationId);
  }

  const document = documentBuilder.build();

  const pencil = new ModEntityBuilder('pencil-1')
    .withName('pencil')
    .withComponent('items-core:item', {})
    .withComponent('items-core:portable', {})
    .withComponent('writing:allows_writing', {})
    .build();

  return { room, actor, document, pencil };
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

describe('writing:sign_document action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'writing',
      'writing:sign_document',
      signDocumentRule,
      eventIsActionSignDocument
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful sign document operations', () => {
    it('successfully executes sign document action', async () => {
      // Arrange: Setup scenario with document and pencil in inventory
      const scenario = setupSignDocumentScenario('Alice', 'office1', true);
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.document,
        scenario.pencil,
      ]);

      // Act: Sign document using pencil
      await testFixture.executeAction('test:actor1', 'contract-1', {
        additionalPayload: { secondaryId: 'pencil-1' },
      });

      // Assert: Verify perceptible event with expected message
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const signEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'communication.notes'
      );
      expect(signEvent).toBeDefined();
      expect(signEvent.payload.descriptionText).toBe(
        'Alice signs Employment Contract using pencil.'
      );
      expect(signEvent.payload.locationId).toBe('office1');
      expect(signEvent.payload.actorId).toBe('test:actor1');
      expect(signEvent.payload.targetId).toBe('contract-1');
      expect(signEvent.payload.involvedEntities).toContain('pencil-1');

      // Assert: Verify success message
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Alice signs Employment Contract using pencil.'
      );

      // Assert: Verify turn ended successfully
      expectSuccessfulTurnEnd(testFixture.events);

      // Assert: Verify document and pencil still in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['inventory:inventory'].items).toContain('contract-1');
      expect(actor.components['inventory:inventory'].items).toContain('pencil-1');
    });

    it('works with any signable item and writing utensil', async () => {
      // Arrange: Create a letter and quill (not specifically a contract and pencil)
      const room = new ModEntityBuilder('library1').asRoom('Library').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Bob')
        .atLocation('library1')
        .asActor()
        .withComponent('inventory:inventory', {
          items: ['letter-1', 'quill-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const letter = new ModEntityBuilder('letter-1')
        .withName('Official Letter')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('writing:signable', {})
        .build();

      const quill = new ModEntityBuilder('quill-1')
        .withName('quill')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, letter, quill]);

      // Act: Sign the letter using quill
      await testFixture.executeAction('test:actor1', 'letter-1', {
        additionalPayload: { secondaryId: 'quill-1' },
      });

      // Assert: Action succeeds
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(
        'Bob signs Official Letter using quill.'
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('event structure validation', () => {
    it('includes all required perceptible event fields', async () => {
      const scenario = setupSignDocumentScenario('Charlie', 'cabin', true);
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.document,
        scenario.pencil,
      ]);

      await testFixture.executeAction('test:actor1', 'contract-1', {
        additionalPayload: { secondaryId: 'pencil-1' },
      });

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      const signEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'communication.notes'
      );

      // Verify all required fields
      expect(signEvent.payload.locationId).toBe('cabin');
      expect(signEvent.payload.perceptionType).toBe('communication.notes');
      expect(signEvent.payload.actorId).toBe('test:actor1');
      expect(signEvent.payload.targetId).toBe('contract-1');
      expect(signEvent.payload.descriptionText).toContain('Charlie');
      expect(signEvent.payload.descriptionText).toContain('Employment Contract');
      expect(signEvent.payload.descriptionText).toContain('pencil');
      expect(signEvent.payload.involvedEntities).toContain('pencil-1');

      expectSuccessfulTurnEnd(testFixture.events);
    });

    it('includes perspective-aware fields for actor-specific routing', async () => {
      const scenario = setupSignDocumentScenario('Diana', 'study', true);
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.document,
        scenario.pencil,
      ]);

      await testFixture.executeAction('test:actor1', 'contract-1', {
        additionalPayload: { secondaryId: 'pencil-1' },
      });

      const signEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'communication.notes'
      );
      expect(signEvent).toBeDefined();

      // Verify perspective-aware routing fields are set
      // description_text is third-person for observers
      expect(signEvent.payload.descriptionText).toBe(
        'Diana signs Employment Contract using pencil.'
      );
      // actor_id is set for perspective-aware routing
      expect(signEvent.payload.actorId).toBe('test:actor1');

      expectSuccessfulTurnEnd(testFixture.events);
    });

    it('only dispatches expected events (no unexpected side effects)', async () => {
      const scenario = setupSignDocumentScenario('Dave', 'station', true);
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.document,
        scenario.pencil,
      ]);

      await testFixture.executeAction('test:actor1', 'contract-1', {
        additionalPayload: { secondaryId: 'pencil-1' },
      });

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
      expect(eventTypes).not.toContain('items-core:item_modified');

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('no state changes', () => {
    it('does not modify document components', async () => {
      const scenario = setupSignDocumentScenario('Eve', 'tent', true);
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.document,
        scenario.pencil,
      ]);

      // Get initial document state
      const documentBefore =
        testFixture.entityManager.getEntityInstance('contract-1');
      const signableComponentBefore = JSON.parse(
        JSON.stringify(documentBefore.components['writing:signable'])
      );

      await testFixture.executeAction('test:actor1', 'contract-1', {
        additionalPayload: { secondaryId: 'pencil-1' },
      });

      // Get document state after signing
      const documentAfter =
        testFixture.entityManager.getEntityInstance('contract-1');

      // Component should be unchanged
      expect(documentAfter.components['writing:signable']).toEqual(
        signableComponentBefore
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });

    it('does not modify inventory', async () => {
      const scenario = setupSignDocumentScenario('Frank', 'bunker', true);
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.document,
        scenario.pencil,
      ]);

      // Get initial inventory state
      const actorBefore =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const inventoryBefore = [
        ...actorBefore.components['inventory:inventory'].items,
      ];

      await testFixture.executeAction('test:actor1', 'contract-1', {
        additionalPayload: { secondaryId: 'pencil-1' },
      });

      // Get inventory after signing
      const actorAfter =
        testFixture.entityManager.getEntityInstance('test:actor1');

      // Inventory should be unchanged
      expect(actorAfter.components['inventory:inventory'].items).toEqual(
        inventoryBefore
      );

      expectSuccessfulTurnEnd(testFixture.events);
    });
  });

  describe('multiple signing scenarios', () => {
    it('can sign documents multiple times sequentially', async () => {
      const scenario = setupSignDocumentScenario('Grace', 'outpost', true);
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.document,
        scenario.pencil,
      ]);

      // First signing
      const firstActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'contract-1', {
        additionalPayload: { secondaryId: 'pencil-1' },
      });

      const firstActionEvents = testFixture.events.slice(firstActionStart);
      expectSuccessfulTurnEnd(firstActionEvents);

      const firstSignEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'communication.notes'
      );
      expect(firstSignEvent).toBeDefined();

      // Second signing
      const secondActionStart = testFixture.events.length;
      await testFixture.executeAction('test:actor1', 'contract-1', {
        additionalPayload: { secondaryId: 'pencil-1' },
      });

      const secondActionEvents = testFixture.events.slice(secondActionStart);
      expectSuccessfulTurnEnd(secondActionEvents);

      const allSignEvents = testFixture.events.filter(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.perceptionType === 'communication.notes'
      );
      expect(allSignEvents).toHaveLength(2);
    });
  });
});
