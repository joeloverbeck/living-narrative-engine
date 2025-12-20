/**
 * @file PerceptionLogLimits.e2e.test.js
 * @description E2E coverage for perception log limits and batch update paths.
 *
 * Tests validate storage behavior under repeated writes including:
 * - maxEntries truncation respects configured limits
 * - Batch update path maintains correct FIFO ordering
 * - Multiple recipients are updated atomically
 * - Recovery from corrupted log shapes
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import logPerceptibleEventsRule from '../../../data/mods/core/rules/log_perceptible_events.rule.json' assert { type: 'json' };

describe('Perception Log Limits and Batch Updates E2E', () => {
  const locationId = 'test_room';
  const actorAId = 'actor_a';
  const actorBId = 'actor_b';
  const actorCId = 'actor_c';
  let testEnv;

  /**
   * Builds entities with varying maxEntries configurations.
   *
   * @param root0
   * @param root0.actorAMax
   * @param root0.actorBMax
   * @param root0.actorCMax
   */
  const buildEntitiesWithLimits = ({
    actorAMax = 5,
    actorBMax = 3,
    actorCMax = 50,
  } = {}) => [
    {
      id: locationId,
      components: {
        'core:name': { text: 'Test Room' },
      },
    },
    {
      id: actorAId,
      components: {
        'core:actor': { name: 'Actor A' },
        'core:position': { locationId },
        'core:perception_log': { logEntries: [], maxEntries: actorAMax },
      },
    },
    {
      id: actorBId,
      components: {
        'core:actor': { name: 'Actor B' },
        'core:position': { locationId },
        'core:perception_log': { logEntries: [], maxEntries: actorBMax },
      },
    },
    {
      id: actorCId,
      components: {
        'core:actor': { name: 'Actor C' },
        'core:position': { locationId },
        'core:perception_log': { logEntries: [], maxEntries: actorCMax },
      },
    },
  ];

  /**
   * Dispatches a perceptible event and waits for all pending handlers.
   *
   * @param {string} description - Description text for the event.
   */
  const dispatchAndAwait = async (description) => {
    const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

    await testEnv.operationInterpreter.execute(
      {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          location_id: locationId,
          description_text: description,
          perception_type: 'social.interaction',
          actor_id: actorAId,
        },
      },
      { evaluationContext: {} }
    );

    // Await all pending dispatches
    const pending = testEnv.eventBus.dispatch.mock.results
      .slice(dispatchStart)
      .map((result) => result.value)
      .filter((value) => value && typeof value.then === 'function');
    if (pending.length > 0) {
      await Promise.all(pending);
    }
  };

  /**
   * Helper to get log entries for an actor.
   *
   * @param actorId
   */
  const getLogEntries = (actorId) => {
    const log = testEnv.entityManager.getComponentData(
      actorId,
      'core:perception_log'
    );
    return log?.logEntries ?? [];
  };

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      createHandlers:
        ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
          ModTestHandlerFactory
        ),
      entities: buildEntitiesWithLimits(),
      rules: [logPerceptibleEventsRule],
      actions: [],
    });
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('maxEntries Truncation', () => {
    it('truncates log entries when exceeding maxEntries limit', async () => {
      // Actor A has maxEntries=5, dispatch 7 events
      for (let i = 1; i <= 7; i++) {
        await dispatchAndAwait(`Event ${i}`);
      }

      const actorALog = getLogEntries(actorAId);

      // Should only have 5 entries (the most recent ones)
      expect(actorALog.length).toBe(5);

      // Verify FIFO ordering - oldest events truncated, newest preserved
      expect(actorALog[0].descriptionText).toBe('Event 3');
      expect(actorALog[1].descriptionText).toBe('Event 4');
      expect(actorALog[2].descriptionText).toBe('Event 5');
      expect(actorALog[3].descriptionText).toBe('Event 6');
      expect(actorALog[4].descriptionText).toBe('Event 7');
    });

    it('respects different maxEntries limits per actor', async () => {
      // Dispatch 6 events (exceeds actorA's 5 limit and actorB's 3 limit)
      for (let i = 1; i <= 6; i++) {
        await dispatchAndAwait(`Message ${i}`);
      }

      const actorALog = getLogEntries(actorAId);
      const actorBLog = getLogEntries(actorBId);
      const actorCLog = getLogEntries(actorCId);

      // Actor A (maxEntries=5) should have 5 entries
      expect(actorALog.length).toBe(5);
      expect(actorALog[0].descriptionText).toBe('Message 2');
      expect(actorALog[4].descriptionText).toBe('Message 6');

      // Actor B (maxEntries=3) should have 3 entries
      expect(actorBLog.length).toBe(3);
      expect(actorBLog[0].descriptionText).toBe('Message 4');
      expect(actorBLog[2].descriptionText).toBe('Message 6');

      // Actor C (maxEntries=50) should have all 6 entries
      expect(actorCLog.length).toBe(6);
      expect(actorCLog[0].descriptionText).toBe('Message 1');
      expect(actorCLog[5].descriptionText).toBe('Message 6');
    });

    it('handles maxEntries=1 edge case', async () => {
      // Recreate with maxEntries=1 for actorA
      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers:
          ModTestHandlerFactory.createHandlersWithPerceptionLogging.bind(
            ModTestHandlerFactory
          ),
        entities: buildEntitiesWithLimits({ actorAMax: 1 }),
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      await dispatchAndAwait('First');
      await dispatchAndAwait('Second');
      await dispatchAndAwait('Third');

      const actorALog = getLogEntries(actorAId);

      // Should only have the most recent entry
      expect(actorALog.length).toBe(1);
      expect(actorALog[0].descriptionText).toBe('Third');
    });
  });

  describe('Batch Update Ordering', () => {
    it('maintains chronological ordering in batch updates', async () => {
      // Dispatch events and verify they appear in correct order
      await dispatchAndAwait('Alpha');
      await dispatchAndAwait('Beta');
      await dispatchAndAwait('Gamma');

      const actorALog = getLogEntries(actorAId);

      expect(actorALog.length).toBe(3);
      expect(actorALog[0].descriptionText).toBe('Alpha');
      expect(actorALog[1].descriptionText).toBe('Beta');
      expect(actorALog[2].descriptionText).toBe('Gamma');

      // Verify timestamps are in ascending order (ISO strings compare lexicographically correctly)
      expect(actorALog[0].timestamp <= actorALog[1].timestamp).toBe(true);
      expect(actorALog[1].timestamp <= actorALog[2].timestamp).toBe(true);
    });

    it('updates all recipients atomically in same batch', async () => {
      await dispatchAndAwait('Shared event');

      // All actors in location should receive the same entry
      const actorALog = getLogEntries(actorAId);
      const actorBLog = getLogEntries(actorBId);
      const actorCLog = getLogEntries(actorCId);

      expect(actorALog.length).toBe(1);
      expect(actorBLog.length).toBe(1);
      expect(actorCLog.length).toBe(1);

      // All should have same description and timestamp
      expect(actorALog[0].descriptionText).toBe('Shared event');
      expect(actorBLog[0].descriptionText).toBe('Shared event');
      expect(actorCLog[0].descriptionText).toBe('Shared event');
      expect(actorALog[0].timestamp).toBe(actorBLog[0].timestamp);
      expect(actorBLog[0].timestamp).toBe(actorCLog[0].timestamp);
    });
  });

  describe('Edge Cases and Recovery', () => {
    it('handles pre-existing entries correctly during truncation', async () => {
      // Pre-populate actorA with 4 entries (limit is 5)
      testEnv.entityManager.addComponent(actorAId, 'core:perception_log', {
        maxEntries: 5,
        logEntries: [
          { descriptionText: 'Pre-1', timestamp: 1000, perceptionType: 'test' },
          { descriptionText: 'Pre-2', timestamp: 2000, perceptionType: 'test' },
          { descriptionText: 'Pre-3', timestamp: 3000, perceptionType: 'test' },
          { descriptionText: 'Pre-4', timestamp: 4000, perceptionType: 'test' },
        ],
      });

      // Dispatch 3 new events (4 + 3 = 7 > maxEntries 5)
      await dispatchAndAwait('New-1');
      await dispatchAndAwait('New-2');
      await dispatchAndAwait('New-3');

      const actorALog = getLogEntries(actorAId);

      // Should have 5 entries: Pre-3, Pre-4, New-1, New-2, New-3
      expect(actorALog.length).toBe(5);
      expect(actorALog[0].descriptionText).toBe('Pre-3');
      expect(actorALog[1].descriptionText).toBe('Pre-4');
      expect(actorALog[2].descriptionText).toBe('New-1');
      expect(actorALog[3].descriptionText).toBe('New-2');
      expect(actorALog[4].descriptionText).toBe('New-3');
    });

    it('recovers from corrupted logEntries (non-array)', async () => {
      // Corrupt actorA's logEntries
      testEnv.entityManager.addComponent(actorAId, 'core:perception_log', {
        maxEntries: 5,
        logEntries: 'not an array', // corrupted
      });

      await dispatchAndAwait('Recovery test');

      const actorALog = getLogEntries(actorAId);

      // Should recover and have 1 entry
      expect(Array.isArray(actorALog)).toBe(true);
      expect(actorALog.length).toBe(1);
      expect(actorALog[0].descriptionText).toBe('Recovery test');
    });

    it('recovers from corrupted maxEntries (invalid number)', async () => {
      // Set invalid maxEntries
      testEnv.entityManager.addComponent(actorAId, 'core:perception_log', {
        maxEntries: 'invalid', // corrupted
        logEntries: [],
      });

      // Dispatch 55 events (more than default 50)
      for (let i = 1; i <= 55; i++) {
        await dispatchAndAwait(`Event ${i}`);
      }

      const actorALog = getLogEntries(actorAId);

      // Should use default maxEntries (50)
      expect(actorALog.length).toBe(50);
      // Newest should be the last event
      expect(actorALog[49].descriptionText).toBe('Event 55');
    });

    it('handles empty location gracefully (no recipients)', async () => {
      const emptyLocationId = 'empty_room';

      // Create an empty location
      testEnv.entityManager.addComponent(emptyLocationId, 'core:name', {
        text: 'Empty Room',
      });

      const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

      await testEnv.operationInterpreter.execute(
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            location_id: emptyLocationId,
            description_text: 'Ghost whispers...',
            perception_type: 'social.interaction',
            actor_id: actorAId,
          },
        },
        { evaluationContext: {} }
      );

      const pending = testEnv.eventBus.dispatch.mock.results
        .slice(dispatchStart)
        .map((result) => result.value)
        .filter((value) => value && typeof value.then === 'function');
      if (pending.length > 0) {
        await Promise.all(pending);
      }

      // Should not throw, and actors in other locations should be unaffected
      expect(getLogEntries(actorAId).length).toBe(0);
      expect(getLogEntries(actorBId).length).toBe(0);
    });
  });

  describe('Burst Writing Behavior', () => {
    it('handles rapid sequential writes correctly', async () => {
      // Rapidly dispatch 10 events without awaiting between dispatches
      const promises = [];
      for (let i = 1; i <= 10; i++) {
        promises.push(dispatchAndAwait(`Burst ${i}`));
      }
      await Promise.all(promises);

      const actorALog = getLogEntries(actorAId);
      const actorBLog = getLogEntries(actorBId);

      // Actor A (maxEntries=5) should have last 5
      expect(actorALog.length).toBe(5);
      // Actor B (maxEntries=3) should have last 3
      expect(actorBLog.length).toBe(3);

      // All entries should be present in chronological order
      const actorADescriptions = actorALog.map((e) => e.descriptionText);
      expect(actorADescriptions).toEqual([
        'Burst 6',
        'Burst 7',
        'Burst 8',
        'Burst 9',
        'Burst 10',
      ]);

      const actorBDescriptions = actorBLog.map((e) => e.descriptionText);
      expect(actorBDescriptions).toEqual([
        'Burst 8',
        'Burst 9',
        'Burst 10',
      ]);
    });
  });
});
