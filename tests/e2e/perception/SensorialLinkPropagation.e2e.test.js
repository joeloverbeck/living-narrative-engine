/**
 * @file SensorialLinkPropagation.e2e.test.js
 * @description E2E coverage for sensorial link propagation in perceptible events.
 *
 * Tests validate propagation across `locations:sensorial_links` including:
 * - Linked locations receive prefixed entries "(From <origin>) ..."
 * - `origin_location_id` prevents propagation loops
 * - Originating actor is excluded from propagated logs
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import logPerceptibleEventsRule from '../../../data/mods/core/rules/log_perceptible_events.rule.json' assert { type: 'json' };

describe('Sensorial Link Propagation E2E', () => {
  const originLocationId = 'origin_room';
  const linkedLocationId = 'linked_room';
  const unlinkedLocationId = 'unlinked_room';
  const originActorId = 'origin_actor';
  const linkedActorId = 'linked_actor';
  const unlinkedActorId = 'unlinked_actor';
  let testEnv;

  /**
   * Builds a basic test scenario with two linked locations and one unlinked.
   * - originLocationId has sensorial_links pointing to linkedLocationId
   * - linkedLocationId has an actor who should receive prefixed logs
   * - unlinkedLocationId has an actor who should NOT receive logs
   */
  const buildEntitiesWithSensorialLinks = () => [
    // Origin location with sensorial links to linked location
    {
      id: originLocationId,
      components: {
        'core:name': { text: 'Origin Room' },
        'locations:sensorial_links': {
          targets: [linkedLocationId],
        },
      },
    },
    // Linked location (receives propagated events)
    {
      id: linkedLocationId,
      components: {
        'core:name': { text: 'Linked Room' },
      },
    },
    // Unlinked location (should not receive propagated events)
    {
      id: unlinkedLocationId,
      components: {
        'core:name': { text: 'Unlinked Room' },
      },
    },
    // Actor in origin location (event source)
    {
      id: originActorId,
      components: {
        'core:actor': { name: 'Origin Actor' },
        'core:position': { locationId: originLocationId },
        'core:perception_log': { logEntries: [], maxEntries: 50 },
      },
    },
    // Actor in linked location (should receive prefixed propagated log)
    {
      id: linkedActorId,
      components: {
        'core:actor': { name: 'Linked Actor' },
        'core:position': { locationId: linkedLocationId },
        'core:perception_log': { logEntries: [], maxEntries: 50 },
      },
    },
    // Actor in unlinked location (should NOT receive log)
    {
      id: unlinkedActorId,
      components: {
        'core:actor': { name: 'Unlinked Actor' },
        'core:position': { locationId: unlinkedLocationId },
        'core:perception_log': { logEntries: [], maxEntries: 50 },
      },
    },
  ];

  const awaitDispatches = async (startIndex) => {
    const pending = testEnv.eventBus.dispatch.mock.results
      .slice(startIndex)
      .map((result) => result.value)
      .filter((value) => value && typeof value.then === 'function');
    if (pending.length > 0) {
      await Promise.all(pending);
    }
  };

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      createHandlers:
        ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
          ModTestHandlerFactory
        ),
      entities: buildEntitiesWithSensorialLinks(),
      rules: [logPerceptibleEventsRule],
      actions: [],
    });
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('Prefixed Propagation', () => {
    it('propagates events to linked locations with "(From <origin>)" prefix', async () => {
      const description = 'A loud noise echoes.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      // Origin actor should receive the original (non-prefixed) log
      const originLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originLog?.logEntries?.length).toBe(1);
      expect(originLog.logEntries[0].descriptionText).toBe(description);
      expect(originLog.logEntries[0].descriptionText).not.toContain(
        '(From Origin Room)'
      );

      // Linked actor should receive the prefixed log
      const linkedLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(linkedLog?.logEntries?.length).toBe(1);
      expect(linkedLog.logEntries[0].descriptionText).toBe(
        `(From Origin Room) ${description}`
      );

      // Unlinked actor should NOT receive any log
      const unlinkedLog = testEnv.entityManager.getComponentData(
        unlinkedActorId,
        'core:perception_log'
      );
      expect(unlinkedLog?.logEntries?.length).toBe(0);
    });

    it('uses location ID as prefix when location has no name', async () => {
      // Remove the name from the origin location
      testEnv.entityManager.addComponent(originLocationId, 'core:name', {});

      const description = 'A whisper floats through.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      const linkedLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(linkedLog?.logEntries?.length).toBe(1);
      // Should use location ID when name is missing
      expect(linkedLog.logEntries[0].descriptionText).toBe(
        `(From ${originLocationId}) ${description}`
      );
    });
  });

  describe('Loop Prevention', () => {
    it('prevents propagation loops via origin_location_id', async () => {
      // Create a bidirectional link scenario that would cause infinite loops
      // without proper origin_location_id handling
      const bidirectionalEntities = [
        {
          id: originLocationId,
          components: {
            'core:name': { text: 'Room A' },
            'locations:sensorial_links': {
              targets: [linkedLocationId],
            },
          },
        },
        {
          id: linkedLocationId,
          components: {
            'core:name': { text: 'Room B' },
            'locations:sensorial_links': {
              targets: [originLocationId], // Bidirectional link
            },
          },
        },
        {
          id: originActorId,
          components: {
            'core:actor': { name: 'Actor A' },
            'core:position': { locationId: originLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: linkedActorId,
          components: {
            'core:actor': { name: 'Actor B' },
            'core:position': { locationId: linkedLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      // Reset with new bidirectional entities
      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers:
          ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
            ModTestHandlerFactory
          ),
        entities: bidirectionalEntities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      const description = 'A sound travels.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      // Origin actor should have exactly 1 entry (not multiple from loops)
      const originLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originLog?.logEntries?.length).toBe(1);

      // Linked actor should have exactly 1 entry (not multiple from loops)
      const linkedLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(linkedLog?.logEntries?.length).toBe(1);

      // The linked actor's entry should be prefixed
      expect(linkedLog.logEntries[0].descriptionText).toContain('(From Room A)');
    });

    it('does not propagate when origin_location_id matches current location', async () => {
      // Directly invoke ADD_PERCEPTION_LOG_ENTRY with origin_location_id
      // that matches the target location - simulating a re-propagation attempt
      const description = 'Should not propagate.';

      await testEnv.operationInterpreter.execute(
        {
          type: 'ADD_PERCEPTION_LOG_ENTRY',
          parameters: {
            location_id: linkedLocationId,
            origin_location_id: originLocationId, // Set origin to prevent re-propagation back
            entry: {
              descriptionText: description,
              timestamp: new Date().toISOString(),
              perceptionType: 'environment.sound',
              actorId: originActorId,
              targetId: null,
              involvedEntities: [],
            },
          },
        },
        { evaluationContext: {} }
      );

      // Linked actor should have the entry
      const linkedLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(linkedLog?.logEntries?.length).toBe(1);

      // Origin actor should NOT have received a propagated entry
      // (propagation is skipped when origin_location_id is set differently from current location)
      const originLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originLog?.logEntries?.length).toBe(0);
    });
  });

  describe('Originating Actor Exclusion', () => {
    it('excludes originating actor from propagated logs in linked locations', async () => {
      // Create scenario where origin actor has moved to linked location
      // They should not receive the propagated version of their own event
      const movedActorEntities = [
        {
          id: originLocationId,
          components: {
            'core:name': { text: 'Origin Room' },
            'locations:sensorial_links': {
              targets: [linkedLocationId],
            },
          },
        },
        {
          id: linkedLocationId,
          components: {
            'core:name': { text: 'Linked Room' },
          },
        },
        // Origin actor - now in linked location
        {
          id: originActorId,
          components: {
            'core:actor': { name: 'Origin Actor' },
            'core:position': { locationId: linkedLocationId }, // Moved to linked
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        // Observer in origin location
        {
          id: 'observer_in_origin',
          components: {
            'core:actor': { name: 'Origin Observer' },
            'core:position': { locationId: originLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        // Another actor in linked location
        {
          id: linkedActorId,
          components: {
            'core:actor': { name: 'Linked Actor' },
            'core:position': { locationId: linkedLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers:
          ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
            ModTestHandlerFactory
          ),
        entities: movedActorEntities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      const description = 'Something happens in origin.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      // Event originates in origin location, but originating actor is in linked location
      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      // Observer in origin should receive the non-prefixed log
      const originObserverLog = testEnv.entityManager.getComponentData(
        'observer_in_origin',
        'core:perception_log'
      );
      expect(originObserverLog?.logEntries?.length).toBe(1);
      expect(originObserverLog.logEntries[0].descriptionText).toBe(description);

      // Linked actor should receive the prefixed log
      const linkedLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(linkedLog?.logEntries?.length).toBe(1);
      expect(linkedLog.logEntries[0].descriptionText).toBe(
        `(From Origin Room) ${description}`
      );

      // Origin actor (now in linked location) should NOT receive the propagated log
      // because they are the originating actor
      const originActorLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originActorLog?.logEntries?.length).toBe(0);
    });

    it('includes originating actor in origin location log but excludes from propagation', async () => {
      const description = 'Actor performs an action.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      // Origin actor SHOULD receive the log in their own location
      const originLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originLog?.logEntries?.length).toBe(1);
      expect(originLog.logEntries[0].descriptionText).toBe(description);

      // Linked actor should receive the prefixed version
      const linkedLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(linkedLog?.logEntries?.length).toBe(1);
      expect(linkedLog.logEntries[0].descriptionText).toBe(
        `(From Origin Room) ${description}`
      );
    });
  });

  describe('Multiple Linked Locations', () => {
    it('propagates to all linked locations', async () => {
      const secondLinkedLocationId = 'second_linked_room';
      const secondLinkedActorId = 'second_linked_actor';

      const multiLinkEntities = [
        {
          id: originLocationId,
          components: {
            'core:name': { text: 'Origin Room' },
            'locations:sensorial_links': {
              targets: [linkedLocationId, secondLinkedLocationId],
            },
          },
        },
        {
          id: linkedLocationId,
          components: {
            'core:name': { text: 'First Linked Room' },
          },
        },
        {
          id: secondLinkedLocationId,
          components: {
            'core:name': { text: 'Second Linked Room' },
          },
        },
        {
          id: originActorId,
          components: {
            'core:actor': { name: 'Origin Actor' },
            'core:position': { locationId: originLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: linkedActorId,
          components: {
            'core:actor': { name: 'First Linked Actor' },
            'core:position': { locationId: linkedLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: secondLinkedActorId,
          components: {
            'core:actor': { name: 'Second Linked Actor' },
            'core:position': { locationId: secondLinkedLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers:
          ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
            ModTestHandlerFactory
          ),
        entities: multiLinkEntities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      const description = 'A broadcast message.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      // Origin actor receives original
      const originLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originLog?.logEntries?.length).toBe(1);

      // First linked actor receives prefixed
      const firstLinkedLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(firstLinkedLog?.logEntries?.length).toBe(1);
      expect(firstLinkedLog.logEntries[0].descriptionText).toBe(
        `(From Origin Room) ${description}`
      );

      // Second linked actor also receives prefixed
      const secondLinkedLog = testEnv.entityManager.getComponentData(
        secondLinkedActorId,
        'core:perception_log'
      );
      expect(secondLinkedLog?.logEntries?.length).toBe(1);
      expect(secondLinkedLog.logEntries[0].descriptionText).toBe(
        `(From Origin Room) ${description}`
      );
    });
  });

  describe('Explicit Recipients Block Propagation', () => {
    it('does not propagate when explicit recipients are specified', async () => {
      const secondActorInOrigin = 'second_origin_actor';
      const entitiesWithTwoInOrigin = [
        {
          id: originLocationId,
          components: {
            'core:name': { text: 'Origin Room' },
            'locations:sensorial_links': {
              targets: [linkedLocationId],
            },
          },
        },
        {
          id: linkedLocationId,
          components: {
            'core:name': { text: 'Linked Room' },
          },
        },
        {
          id: originActorId,
          components: {
            'core:actor': { name: 'Origin Actor' },
            'core:position': { locationId: originLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: secondActorInOrigin,
          components: {
            'core:actor': { name: 'Second Origin Actor' },
            'core:position': { locationId: originLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: linkedActorId,
          components: {
            'core:actor': { name: 'Linked Actor' },
            'core:position': { locationId: linkedLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers:
          ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
            ModTestHandlerFactory
          ),
        entities: entitiesWithTwoInOrigin,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      const description = 'A private message.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      // Specify explicit recipients - should not propagate
      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
            contextual_data: {
              recipientIds: [secondActorInOrigin],
            },
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      // Specified recipient should receive the log
      const secondOriginLog = testEnv.entityManager.getComponentData(
        secondActorInOrigin,
        'core:perception_log'
      );
      expect(secondOriginLog?.logEntries?.length).toBe(1);

      // Origin actor (not in recipient list) should NOT receive
      const originLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originLog?.logEntries?.length).toBe(0);

      // Linked actor should NOT receive (propagation blocked by explicit recipients)
      const linkedLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(linkedLog?.logEntries?.length).toBe(0);
    });
  });

  describe('Empty Linked Locations', () => {
    it('handles propagation to empty linked locations gracefully', async () => {
      // Linked location has no actors
      const entitiesWithEmptyLinked = [
        {
          id: originLocationId,
          components: {
            'core:name': { text: 'Origin Room' },
            'locations:sensorial_links': {
              targets: [linkedLocationId],
            },
          },
        },
        {
          id: linkedLocationId,
          components: {
            'core:name': { text: 'Empty Linked Room' },
          },
        },
        {
          id: originActorId,
          components: {
            'core:actor': { name: 'Origin Actor' },
            'core:position': { locationId: originLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers:
          ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
            ModTestHandlerFactory
          ),
        entities: entitiesWithEmptyLinked,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      const description = 'A sound in an empty hall.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      // Should complete without error and origin actor receives log
      const originLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originLog?.logEntries?.length).toBe(1);
      expect(originLog.logEntries[0].descriptionText).toBe(description);
    });
  });

  describe('No Sensorial Links', () => {
    it('does not propagate when location has no sensorial links', async () => {
      const entitiesWithoutLinks = [
        {
          id: originLocationId,
          components: {
            'core:name': { text: 'Isolated Room' },
            // No sensorial_links component
          },
        },
        {
          id: linkedLocationId,
          components: {
            'core:name': { text: 'Other Room' },
          },
        },
        {
          id: originActorId,
          components: {
            'core:actor': { name: 'Origin Actor' },
            'core:position': { locationId: originLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: linkedActorId,
          components: {
            'core:actor': { name: 'Other Actor' },
            'core:position': { locationId: linkedLocationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers:
          ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
            ModTestHandlerFactory
          ),
        entities: entitiesWithoutLinks,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      const description = 'A local event.';
      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: originLocationId,
            description_text: description,
            perception_type: 'social.interaction',
            actor_id: originActorId,
          },
        },
        { evaluationContext: {} }
      );

      await awaitDispatches(dispatchStart);

      // Origin actor receives log
      const originLog = testEnv.entityManager.getComponentData(
        originActorId,
        'core:perception_log'
      );
      expect(originLog?.logEntries?.length).toBe(1);

      // Actor in other location does NOT receive log (no sensorial link)
      const otherLog = testEnv.entityManager.getComponentData(
        linkedActorId,
        'core:perception_log'
      );
      expect(otherLog?.logEntries?.length).toBe(0);
    });
  });
});
